// PNG RGBA → PNG RGB 24 bits (sans canal alpha), sans dépendance : décodage, aplatissement, réencodage.
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const byte of data) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

interface Decoded {
  width: number;
  height: number;
  colorType: number;
  pixels: Buffer;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decode(png: Buffer): Decoded {
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error('Pas un PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG 8 bits non entrelacé attendu');
      colorType = data[9] ?? 0;
    } else if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (bpp === 0) throw new Error(`Type de couleur non géré : ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[src + x] ?? 0;
      const a = x >= bpp ? (pixels[dst + x - bpp] ?? 0) : 0;
      const b = y > 0 ? (pixels[dst - stride + x] ?? 0) : 0;
      const c = x >= bpp && y > 0 ? (pixels[dst - stride + x - bpp] ?? 0) : 0;
      const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? paeth(a, b, c) : 0;
      pixels[dst + x] = (value + predictor) & 0xff;
    }
  }
  return { width, height, colorType, pixels };
}

/** Réencode en RGB 8 bits (type 2) ; l'alpha éventuel est aplati sur `background` */
export function toRgbPng(png: Buffer, background: [number, number, number] = [20, 26, 61]): Buffer {
  const { width, height, colorType, pixels } = decode(png);
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 1; // Filtre « Sub » : bonne compression pour des aplats et dégradés
    const line = Buffer.alloc(stride);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * bpp;
      const alpha = bpp === 4 ? (pixels[i + 3] ?? 255) / 255 : 1;
      for (let c = 0; c < 3; c++) line[x * 3 + c] = Math.round((pixels[i + c] ?? 0) * alpha + background[c] * (1 - alpha));
    }
    for (let x = 0; x < stride; x++) raw[row + 1 + x] = ((line[x] ?? 0) - (x >= 3 ? (line[x - 3] ?? 0) : 0)) & 0xff;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Lecture de l'en-tête : dimensions et type de couleur (2 = RGB sans alpha) */
export function pngInfo(png: Buffer): { width: number; height: number; colorType: number; bitDepth: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), bitDepth: png[24] ?? 0, colorType: png[25] ?? 0 };
}
