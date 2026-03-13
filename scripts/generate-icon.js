/**
 * Generate a 256x256 PNG app icon for USPTO Bulk Search.
 * Uses only Node.js built-in modules (no external deps).
 * Creates a blue rounded-rect background with white "TM" text.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const WIDTH = 256;
const HEIGHT = 256;

// Colors
const BG = [30, 64, 175];       // Blue
const FG = [255, 255, 255];     // White
const ACCENT = [59, 130, 246];  // Lighter blue

function setPixel(data, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 4;
  data[idx] = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
  data[idx + 3] = a;
}

function getPixel(data, x, y) {
  const idx = (y * WIDTH + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

function fillCircle(data, cx, cy, radius, r, g, b) {
  for (let y = Math.max(0, cy - radius); y <= Math.min(HEIGHT - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(WIDTH - 1, cx + radius); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(data, x, y, r, g, b);
      }
    }
  }
}

function fillRoundedRect(data, x0, y0, w, h, radius, r, g, b) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      let inside = false;
      // Check corners
      if (x < x0 + radius && y < y0 + radius) {
        const dx = x - (x0 + radius);
        const dy = y - (y0 + radius);
        inside = dx * dx + dy * dy <= radius * radius;
      } else if (x >= x0 + w - radius && y < y0 + radius) {
        const dx = x - (x0 + w - radius - 1);
        const dy = y - (y0 + radius);
        inside = dx * dx + dy * dy <= radius * radius;
      } else if (x < x0 + radius && y >= y0 + h - radius) {
        const dx = x - (x0 + radius);
        const dy = y - (y0 + h - radius - 1);
        inside = dx * dx + dy * dy <= radius * radius;
      } else if (x >= x0 + w - radius && y >= y0 + h - radius) {
        const dx = x - (x0 + w - radius - 1);
        const dy = y - (y0 + h - radius - 1);
        inside = dx * dx + dy * dy <= radius * radius;
      } else {
        inside = true;
      }
      if (inside) setPixel(data, x, y, r, g, b);
    }
  }
}

function fillRect(data, x0, y0, w, h, r, g, b) {
  for (let y = y0; y < y0 + h && y < HEIGHT; y++) {
    for (let x = x0; x < x0 + w && x < WIDTH; x++) {
      setPixel(data, x, y, r, g, b);
    }
  }
}

// Simple bitmap font for "TM" - each char is defined as filled rectangles
function drawT(data, ox, oy, scale, r, g, b) {
  // Horizontal bar
  fillRect(data, ox, oy, 5 * scale, scale, r, g, b);
  // Vertical stem
  fillRect(data, ox + 2 * scale, oy, scale, 7 * scale, r, g, b);
}

function drawM(data, ox, oy, scale, r, g, b) {
  // Left vertical
  fillRect(data, ox, oy, scale, 7 * scale, r, g, b);
  // Right vertical
  fillRect(data, ox + 4 * scale, oy, scale, 7 * scale, r, g, b);
  // Left diagonal (simplified as steps)
  fillRect(data, ox + scale, oy + scale, scale, scale, r, g, b);
  fillRect(data, ox + 2 * scale, oy + 2 * scale, scale, scale, r, g, b);
  // Right diagonal (simplified as steps)
  fillRect(data, ox + 3 * scale, oy + scale, scale, scale, r, g, b);
  fillRect(data, ox + 2 * scale, oy + 2 * scale, scale, scale, r, g, b);
}

// Draw magnifying glass
function drawMagnifyingGlass(data, cx, cy, outerR, innerR, r, g, b) {
  // Circle ring
  for (let y = cy - outerR; y <= cy + outerR; y++) {
    for (let x = cx - outerR; x <= cx + outerR; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= outerR && dist >= innerR) {
        setPixel(data, x, y, r, g, b);
      }
    }
  }
  // Handle (diagonal line going bottom-right)
  const handleLen = outerR * 0.8;
  const thickness = outerR * 0.2;
  for (let t = 0; t <= handleLen; t += 0.5) {
    const hx = cx + outerR * 0.65 + t * 0.707;
    const hy = cy + outerR * 0.65 + t * 0.707;
    fillCircle(data, Math.round(hx), Math.round(hy), Math.round(thickness), r, g, b);
  }
}

function createIcon() {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);

  // Transparent background
  pixels.fill(0);

  // Blue rounded rectangle background
  fillRoundedRect(pixels, 8, 8, 240, 240, 40, ...BG);

  // Inner lighter accent rectangle
  fillRoundedRect(pixels, 20, 20, 216, 216, 32, ...ACCENT);

  // Main blue background
  fillRoundedRect(pixels, 24, 24, 208, 208, 30, ...BG);

  // Draw magnifying glass icon (upper portion)
  drawMagnifyingGlass(pixels, 128, 100, 50, 40, ...FG);

  // Draw "TM" text below
  const scale = 5;
  const textY = 170;
  drawT(pixels, 80, textY, scale, ...FG);
  drawM(pixels, 115, textY, scale, ...FG);

  return pixels;
}

function encodePNG(pixels, width, height) {
  // Build raw image data (filter byte + RGBA per row)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // No filter
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = rowOffset + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];     // R
      rawData[dstIdx + 1] = pixels[srcIdx + 1]; // G
      rawData[dstIdx + 2] = pixels[srcIdx + 2]; // B
      rawData[dstIdx + 3] = pixels[srcIdx + 3]; // A
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG CRC32
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }
  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const pixels = createIcon();
const png = encodePNG(pixels, WIDTH, HEIGHT);
const outPath = path.join(__dirname, '..', 'resources', 'icon.png');
fs.writeFileSync(outPath, png);
console.log(`Icon written to ${outPath} (${png.length} bytes)`);
