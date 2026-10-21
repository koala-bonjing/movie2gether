import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcPayload);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, crcPayload, crcBuf]);
}

export function createPng(width, height, drawPixel) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Scanlines
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const idatChunk = makeChunk('IDAT', zlib.deflateSync(rawData, { level: 9 }));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Generate Duet icons
// Dark background: #0F0D12 -> [15, 13, 18]
// Accent rose: #E8A0BF -> [232, 160, 191]
// Warm amber: #F2C57C -> [242, 197, 124]

function drawDuetIcon(x, y, w, h, isMaskable = false) {
  // Normalized coords -1 to 1
  const nx = (x / w) * 2 - 1;
  const ny = (y / h) * 2 - 1;
  const dist = Math.sqrt(nx * nx + ny * ny);

  // Background
  const bg = [15, 13, 18, 255];

  // Scale for content (maskable has safe area margin)
  const scale = isMaskable ? 0.65 : 0.85;
  const sx = nx / scale;
  const sy = ny / scale;

  // Let's draw two overlapping movie frames/play symbols:
  // Left symbol (accent rose): circle or curved rounded rect
  // Right symbol (warm amber): interlocking circle or play mark
  const d1 = Math.sqrt((sx + 0.22) * (sx + 0.22) + sy * sy);
  const d2 = Math.sqrt((sx - 0.22) * (sx - 0.22) + sy * sy);

  const radius = 0.42;
  const inCircle1 = d1 < radius;
  const inCircle2 = d2 < radius;

  if (inCircle1 && inCircle2) {
    // Overlap: blend of rose & amber -> glowing warm peach
    return [245, 185, 150, 255];
  } else if (inCircle1) {
    return [232, 160, 191, 255];
  } else if (inCircle2) {
    return [242, 197, 124, 255];
  }

  return bg;
}

const outDir = path.resolve('public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 192x192
fs.writeFileSync(path.join(outDir, 'icon-192.png'), createPng(192, 192, (x, y, w, h) => drawDuetIcon(x, y, w, h, false)));
// 512x512
fs.writeFileSync(path.join(outDir, 'icon-512.png'), createPng(512, 512, (x, y, w, h) => drawDuetIcon(x, y, w, h, false)));
// 192x192 maskable
fs.writeFileSync(path.join(outDir, 'icon-maskable-192.png'), createPng(192, 192, (x, y, w, h) => drawDuetIcon(x, y, w, h, true)));
// 512x512 maskable
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), createPng(512, 512, (x, y, w, h) => drawDuetIcon(x, y, w, h, true)));

console.log('Successfully generated PWA PNG icons in public/icons');
