/**
 * Empaquette dist/ en archive prête pour le Chrome Web Store : release/synckai-<version>.zip.
 * Vérifie la version, retire le champ `key` du manifest et refuse les builds non conformes.
 * Écrivain ZIP minimal (deflate via node:zlib), sans dépendance externe.
 *
 * Usage : npm run package
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

interface PackageJson {
  version: string;
}

interface Manifest {
  version: string;
  key?: string;
  [field: string]: unknown;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const RELEASE = join(ROOT, 'release');
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const REQUIRED_LOCALES = ['en', 'fr', 'de'] as const;

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

// ─── Écrivain ZIP (PKZIP 2.0, deflate, sans zip64) ────────────────────────

/** Date/heure DOS fixe (1980-01-01 00:00) → archive reproductible. */
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

function createZip(entries: readonly ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    // Stocke sans compression si deflate n'apporte rien
    const useDeflate = compressed.length < data.length;
    const payload = useDeflate ? compressed : Buffer.from(data);
    const method = useDeflate ? 8 : 0;
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flag UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    // extra, comment, disk, attributs internes/externes : 0
    central.writeUInt32LE(offset, 42);

    localParts.push(local, nameBytes, payload);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + payload.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

// ─── Validation & empaquetage ─────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as PackageJson;
const manifestPath = join(DIST, 'manifest.json');
let manifest: Manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
} catch {
  fail('dist/manifest.json introuvable : lancez `npm run build`.');
}

if (manifest.version !== pkg.version) {
  fail(`Version du manifest (${manifest.version}) ≠ package.json (${pkg.version}).`);
}

for (const locale of REQUIRED_LOCALES) {
  try {
    statSync(join(DIST, '_locales', locale, 'messages.json'));
  } catch {
    fail(`_locales/${locale}/messages.json manquant dans dist/.`);
  }
}

const files = listFiles(DIST).sort();
const entries: ZipEntry[] = [];

for (const file of files) {
  const name = relative(DIST, file).split(sep).join('/');
  if (name.endsWith('.map')) fail(`Source map interdite dans le paquet : ${name}`);
  if (statSync(file).size > MAX_FILE_BYTES) fail(`Fichier > 10 Mo : ${name}`);

  if (name === 'manifest.json') {
    // Le Web Store refuse un manifest contenant `key` (l'ID est attribué par le store)
    const { key: _key, ...storeManifest } = manifest;
    entries.push({ name, data: Buffer.from(`${JSON.stringify(storeManifest, null, 2)}\n`, 'utf8') });
  } else {
    entries.push({ name, data: readFileSync(file) });
  }
}

const zip = createZip(entries);
mkdirSync(RELEASE, { recursive: true });
const zipPath = join(RELEASE, `synckai-${pkg.version}.zip`);
writeFileSync(zipPath, zip);

const packedManifest = entries.find((entry) => entry.name === 'manifest.json');
const packedHasKey =
  packedManifest !== undefined &&
  'key' in (JSON.parse(Buffer.from(packedManifest.data).toString('utf8')) as Manifest);
if (packedHasKey) fail('Le champ `key` est toujours présent dans le manifest empaqueté.');

console.log(`✔ ${relative(ROOT, zipPath)}`);
console.log(`  ${entries.length} fichiers · ${(zip.length / 1024).toFixed(1)} Ko`);
console.log(`  manifest : version ${manifest.version}, key ${manifest.key ? 'retirée' : 'absente'}`);
