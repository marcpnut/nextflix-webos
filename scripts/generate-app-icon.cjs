const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const background = [16, 17, 22];
const accent = [182, 83, 245];
const white = [255, 255, 255];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return output;
}

function png(size) {
  const scale = 4;
  const high = size * scale;
  const pixels = new Uint8Array(high * high * 4);
  for (let y = 0; y < high; y += 1) {
    for (let x = 0; x < high; x += 1) {
      const offset = (y * high + x) * 4;
      pixels[offset] = background[0]; pixels[offset + 1] = background[1]; pixels[offset + 2] = background[2]; pixels[offset + 3] = 255;
    }
  }
  function rect(x, y, width, height, color) {
    for (let py = Math.floor(y * scale); py < Math.ceil((y + height) * scale); py += 1)
      for (let px = Math.floor(x * scale); px < Math.ceil((x + width) * scale); px += 1) {
        const offset = (py * high + px) * 4;
        pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 255;
      }
  }
  function polygon(points, color) {
    const scaled = points.map(([x, y]) => [x * scale, y * scale]);
    const minX = Math.floor(Math.min(...scaled.map(([x]) => x)));
    const maxX = Math.ceil(Math.max(...scaled.map(([x]) => x)));
    const minY = Math.floor(Math.min(...scaled.map(([, y]) => y)));
    const maxY = Math.ceil(Math.max(...scaled.map(([, y]) => y)));
    for (let py = minY; py < maxY; py += 1) for (let px = minX; px < maxX; px += 1) {
      let inside = false;
      for (let i = 0, j = scaled.length - 1; i < scaled.length; j = i, i += 1) {
        const [xi, yi] = scaled[i], [xj, yj] = scaled[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) {
        const offset = (py * high + px) * 4;
        pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 255;
      }
    }
  }

  const unit = size / 130;
  const p = (value) => value * unit;
  // A bold, borderless NF monogram that remains visible when webOS applies its own icon mask.
  rect(p(20), p(29), p(11), p(72), white);
  rect(p(57), p(29), p(11), p(72), white);
  polygon([[p(28), p(29)], [p(40), p(29)], [p(67), p(87)], [p(67), p(101)], [p(56), p(101)]], white);
  // Cut a small play-shaped window into the N's diagonal, then draw a smaller
  // violet play mark inside it to match the selected Direction 03 concept.
  polygon([[p(36), p(54)], [p(54), p(65)], [p(36), p(76)]], background);
  polygon([[p(41), p(59)], [p(51), p(65)], [p(41), p(71)]], accent);
  rect(p(75), p(29), p(12), p(72), accent);
  rect(p(75), p(29), p(43), p(12), accent);
  rect(p(75), p(59), p(35), p(12), accent);

  const rows = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y += 1) {
    const row = y * (1 + size * 4);
    rows[row] = 0;
    for (let x = 0; x < size; x += 1) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < scale; sy += 1) for (let sx = 0; sx < scale; sx += 1) {
        const offset = (((y * scale + sy) * high) + x * scale + sx) * 4;
        r += pixels[offset]; g += pixels[offset + 1]; b += pixels[offset + 2]; a += pixels[offset + 3];
      }
      const output = row + 1 + x * 4;
      const samples = scale * scale;
      rows[output] = Math.round(r / samples); rows[output + 1] = Math.round(g / samples);
      rows[output + 2] = Math.round(b / samples); rows[output + 3] = Math.round(a / samples);
    }
  }
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([header, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

const root = path.resolve(__dirname, '..');
for (const [name, size] of [['icon.png', 80], ['largeIcon.png', 130]]) {
  const data = png(size);
  fs.writeFileSync(path.join(root, name), data);
  fs.writeFileSync(path.join(root, 'public', name), data);
}
