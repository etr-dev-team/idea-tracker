// Generates the PWA icons with no external dependencies.
// Run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "icons");
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const GLYPH = {
  circle: { cx: 0.5, cy: 0.42, r: 0.234 },
  base: { x0: 0.371, y0: 0.631, x1: 0.629, y1: 0.779, r: 0.0586 },
};

function inCircle(gx, gy) {
  const { cx, cy, r } = GLYPH.circle;
  return (gx - cx) ** 2 + (gy - cy) ** 2 <= r * r;
}

function inRoundedRect(gx, gy) {
  const { x0, y0, x1, y1, r } = GLYPH.base;
  const nx = Math.min(Math.max(gx, x0 + r), x1 - r);
  const ny = Math.min(Math.max(gy, y0 + r), y1 - r);
  return (gx - nx) ** 2 + (gy - ny) ** 2 <= r * r;
}

function inRoundedSquare(u, v, radius) {
  const nx = Math.min(Math.max(u, radius), 1 - radius);
  const ny = Math.min(Math.max(v, radius), 1 - radius);
  return (u - nx) ** 2 + (v - ny) ** 2 <= radius * radius;
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function drawIcon(size, { maskable = false } = {}) {
  const samples = 4;
  const total = samples * samples;
  const rgba = Buffer.alloc(size * size * 4);

  const top = [139, 92, 246];
  const bottom = [79, 70, 229];
  const pad = maskable ? 0.29 : 0.19;
  const span = 1 - pad * 2;
  const radius = maskable ? 1 : 0.22;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let bgHits = 0;
      let glyphHits = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const u = (x + (sx + 0.5) / samples) / size;
          const v = (y + (sy + 0.5) / samples) / size;

          if (inRoundedSquare(u, v, radius)) {
            bgHits += 1;
            const gx = (u - pad) / span;
            const gy = (v - pad) / span;
            if (gx >= 0 && gx <= 1 && gy >= 0 && gy <= 1) {
              if (inCircle(gx, gy) || inRoundedRect(gx, gy)) glyphHits += 1;
            }
          }
        }
      }

      const bg = bgHits / total;
      const glyph = glyphHits / total;
      const gradient = mix(top, bottom, (x / size + y / size) / 2);
      const color = mix(gradient, [255, 255, 255], bg > 0 ? glyph / bg : 0);

      const offset = (y * size + x) * 4;
      rgba[offset] = Math.round(color[0]);
      rgba[offset + 1] = Math.round(color[1]);
      rgba[offset + 2] = Math.round(color[2]);
      rgba[offset + 3] = Math.round(bg * 255);
    }
  }

  return encodePng(size, size, rgba);
}

const files = [
  ["icon-192.png", drawIcon(192)],
  ["icon-512.png", drawIcon(512)],
  ["icon-maskable-512.png", drawIcon(512, { maskable: true })],
  ["apple-touch-icon.png", drawIcon(180)],
];

for (const [name, data] of files) {
  writeFileSync(join(OUT, name), data);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5cf6"/>
      <stop offset="1" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <circle cx="256" cy="215" r="120" fill="#fff"/>
  <rect x="190" y="323" width="132" height="76" rx="30" fill="#fff"/>
</svg>
`;
writeFileSync(join(OUT, "icon.svg"), svg);

console.log(`Wrote ${files.length + 1} icons to icons/`);
