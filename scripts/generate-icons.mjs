// Gera os ícones do PWA (manifest + apple-touch-icon) sem dependência externa.
// Por que uma marca geométrica e não a foto do logo: ícone de app é lido a 48px
// no meio de dezenas de outros — foto vira borrão. Um duplo chevron (avanço,
// velocidade) em âmbar sobre grafite lê em qualquer tamanho e casa com a marca.
//
// Uso: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const AMBER = [240, 166, 42];   // fundo (full-bleed: exigido por "maskable")
const GRAPHITE = [10, 10, 10];  // marca — mesmo tom do theme_color do app

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filtro none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Duplo chevron centralizado, dentro dos 60% centrais (zona segura maskable).
function mark(x, y, size) {
  const u = size / 100;              // unidade proporcional
  const cx = size / 2, cy = size / 2;
  const stroke = 9 * u;              // espessura do traço
  const h = 26 * u;                  // meia-altura do chevron
  const dx = x - cx, dy = y - cy;

  // Um chevron ">" é |dy| = (x - apex); usamos dois, deslocados no eixo x.
  for (const offset of [-13 * u, 5 * u]) {
    const apex = offset + h;         // ponta do chevron
    if (Math.abs(dy) > h) continue;
    const edge = apex - Math.abs(dy);           // borda interna da diagonal
    if (dx >= edge - stroke && dx <= edge) return GRAPHITE;
  }
  return null;
}

function pixel(x, y, size) {
  const m = mark(x, y, size);
  if (m) return [...m, 255];
  return [...AMBER, 255];
}

mkdirSync('public', { recursive: true });
for (const [file, size] of [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
]) {
  writeFileSync(file, png(size, pixel));
  console.log('gerado', file, `${size}x${size}`);
}
