/**
 * Génère les icônes PNG de l'extension (16, 32, 48, 128 px) sans dépendance graphique :
 * formes décrites mathématiquement, anti-crénelage par sur-échantillonnage, encodage PNG via zlib.
 *
 * Usage : npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

type Rgb = readonly [number, number, number];

const OUTPUT_DIR = new URL('../public/icons/', import.meta.url);
const SIZES = [16, 32, 48, 128] as const;

// Même dégradé que le logo du popup (sky-500 → indigo-600)
const GRADIENT_START: Rgb = [14, 165, 233];
const GRADIENT_END: Rgb = [79, 70, 229];
const FOREGROUND: Rgb = [255, 255, 255];

// ─── Formes (coordonnées normalisées 0..1) ────────────────────────────────

function insideRoundedSquare(x: number, y: number, radius: number): boolean {
  const dx = Math.max(Math.abs(x - 0.5) - (0.5 - radius), 0);
  const dy = Math.max(Math.abs(y - 0.5) - (0.5 - radius), 0);
  return Math.hypot(dx, dy) <= radius;
}

/** Anneau "synchronisation" : cercle interrompu par deux ouvertures diagonales. */
function insideSyncRing(x: number, y: number): boolean {
  const distance = Math.hypot(x - 0.5, y - 0.5);
  if (Math.abs(distance - 0.3) > 0.045) return false;
  const angle = (Math.atan2(y - 0.5, x - 0.5) * 180) / Math.PI; // -180..180, 0 = droite
  const gap = 22;
  const inGap = Math.abs(angle - -45) < gap || Math.abs(angle - 135) < gap;
  return !inGap;
}

/** Triangle "lecture" centré optiquement (légèrement décalé vers la droite). */
function insidePlayTriangle(x: number, y: number, scale: number): boolean {
  const cx = 0.5 + 0.03 * scale;
  const [ax, ay] = [cx - 0.13 * scale, 0.5 - 0.15 * scale];
  const [bx, by] = [cx - 0.13 * scale, 0.5 + 0.15 * scale];
  const [px, py] = [cx + 0.15 * scale, 0.5];
  const sign = (x1: number, y1: number, x2: number, y2: number): number => (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2);
  const d1 = sign(ax, ay, bx, by);
  const d2 = sign(bx, by, px, py);
  const d3 = sign(px, py, ax, ay);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

// ─── Rendu ────────────────────────────────────────────────────────────────

function renderIcon(size: number): Buffer {
  // En 16 px, l'anneau serait illisible : triangle seul, agrandi
  const showRing = size >= 32;
  const triangleScale = showRing ? 1 : 1.55;
  const samples = size <= 32 ? 8 : 4;
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let background = 0;
      let foreground = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          if (!insideRoundedSquare(x, y, 0.22)) continue;
          background++;
          if ((showRing && insideSyncRing(x, y)) || insidePlayTriangle(x, y, triangleScale)) foreground++;
        }
      }

      const coverage = background / (samples * samples);
      const fgRatio = background > 0 ? foreground / background : 0;
      const t = (px + py) / (2 * (size - 1)); // dégradé diagonal
      const offset = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) {
        const bg = GRADIENT_START[c] + (GRADIENT_END[c] - GRADIENT_START[c]) * t;
        pixels[offset + c] = Math.round(bg + (FOREGROUND[c] - bg) * fgRatio);
      }
      pixels[offset + 3] = Math.round(coverage * 255);
    }
  }
  return encodePng(size, pixels);
}

// ─── Encodage PNG (RGBA 8 bits) ───────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(8, 8); // 8 bits par canal
  header.writeUInt8(6, 9); // RGBA
  // Chaque ligne est précédée de l'octet de filtre 0 (aucun)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
for (const size of SIZES) {
  writeFileSync(new URL(`icon-${size}.png`, OUTPUT_DIR), renderIcon(size));
  console.log(`icons/icon-${size}.png`);
}
