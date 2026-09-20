/**
 * Generates the PWA icon set from code, so the repo carries no binary blobs
 * that nobody can edit. Run with: node scripts/generate-icons.mjs
 *
 * The mark is a rising bar chart on the brand blue - flat shapes only, which
 * is all a launcher icon needs and all a hand-rolled PNG encoder can draw.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const BRAND = [0x2a, 0x78, 0xd6];
const WHITE = [0xff, 0xff, 0xff];

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Signed distance to a rounded rectangle, used for anti-aliased edges. */
function roundedRectSdf(x, y, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(x - cx) - (halfW - radius);
  const qy = Math.abs(y - cy) - (halfH - radius);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - radius;
}

function draw(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const s = size / 512; // everything below is authored at 512
  // A maskable icon must survive an aggressive circular crop, so the mark
  // shrinks into the safe zone and the background fills the whole square.
  const pad = maskable ? 0 : 0;
  const bgRadius = maskable ? 0 : 112 * s;
  const markScale = maskable ? 0.72 : 1;

  const bars = [
    { x: 150, w: 56, top: 320 },
    { x: 228, w: 56, top: 232 },
    { x: 306, w: 56, top: 150 },
  ];
  const baseline = 372;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Background
      const bg =
        bgRadius > 0
          ? roundedRectSdf(x, y, size / 2, size / 2, size / 2 - pad, size / 2 - pad, bgRadius)
          : -1;
      const bgAlpha = clampAA(-bg);
      px[i] = BRAND[0];
      px[i + 1] = BRAND[1];
      px[i + 2] = BRAND[2];
      px[i + 3] = Math.round(255 * bgAlpha);

      // Mark, in the icon's own coordinate space
      const mx = (x - size / 2) / (s * markScale) + 256;
      const my = (y - size / 2) / (s * markScale) + 256;

      let coverage = 0;
      for (const bar of bars) {
        const halfW = bar.w / 2;
        const halfH = (baseline - bar.top) / 2;
        const d = roundedRectSdf(
          mx,
          my,
          bar.x + halfW,
          bar.top + halfH,
          halfW,
          halfH,
          Math.min(halfW, 18),
        );
        coverage = Math.max(coverage, clampAA(-d));
      }
      // The baseline rule under the bars
      coverage = Math.max(
        coverage,
        clampAA(-roundedRectSdf(mx, my, 256, 398, 118, 11, 11)),
      );

      if (coverage > 0 && px[i + 3] > 0) {
        px[i] = mix(px[i], WHITE[0], coverage);
        px[i + 1] = mix(px[i + 1], WHITE[1], coverage);
        px[i + 2] = mix(px[i + 2], WHITE[2], coverage);
      }
    }
  }
  return encodePng(size, size, px);
}

const clampAA = (d) => Math.min(1, Math.max(0, d + 0.5));
const mix = (a, b, t) => Math.round(a + (b - a) * t);

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-180.png', 180, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['favicon-32.png', 32, {}],
];

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), draw(size, opts));
  console.log(`✓ ${name} (${size}×${size})`);
}

// A vector version for browsers that prefer one.
writeFileSync(
  join(OUT, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Paisa">
  <rect width="512" height="512" rx="112" fill="#2a78d6"/>
  <g fill="#ffffff">
    <rect x="150" y="320" width="56" height="52" rx="18"/>
    <rect x="228" y="232" width="56" height="140" rx="18"/>
    <rect x="306" y="150" width="56" height="222" rx="18"/>
    <rect x="138" y="387" width="236" height="22" rx="11"/>
  </g>
</svg>
`,
);
console.log('✓ icon.svg');
