const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const scale = 4, size = 48, high = size * scale;
const pixels = new Uint8Array(high * high * 4);
function paint(x, y, color) {
  if (x < 0 || y < 0 || x >= high || y >= high) return;
  const offset = (y * high + x) * 4;
  pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 255;
}
function circle(cx, cy, radius, color) {
  for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y += 1)
    for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x += 1)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) paint(x, y, color);
}
function ellipse(cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y += 1)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x += 1)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) paint(x, y, color);
}
const white = [246, 247, 250], red = [240, 68, 85];
// A smaller red profile behind the main white profile.
circle(31 * scale, 16 * scale, 4.4 * scale, red);
ellipse(31 * scale, 38 * scale, 10.5 * scale, 15 * scale, red);
circle(18 * scale, 14 * scale, 5.3 * scale, white);
ellipse(18 * scale, 38 * scale, 14 * scale, 18 * scale, white);
const rows = Buffer.alloc(size * (1 + size * 4));
for (let y = 0; y < size; y += 1) {
  const row = y * (1 + size * 4); rows[row] = 0;
  for (let x = 0; x < size; x += 1) {
    let r=0,g=0,b=0,a=0;
    for (let sy=0;sy<scale;sy+=1) for(let sx=0;sx<scale;sx+=1) {
      const i=(((y*scale+sy)*high)+(x*scale+sx))*4;
      r+=pixels[i];g+=pixels[i+1];b+=pixels[i+2];a+=pixels[i+3];
    }
    const out=row+1+x*4, count=scale*scale;
    rows[out]=Math.round(r/count);rows[out+1]=Math.round(g/count);rows[out+2]=Math.round(b/count);rows[out+3]=Math.round(a/count);
  }
}
function crc32(buffer) { let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let k=0;k<8;k+=1)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0; }
function chunk(type,data) { const name=Buffer.from(type);const out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([name,data])),8+data.length);return out; }
const header=Buffer.from([137,80,78,71,13,10,26,10]);
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([header,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
fs.writeFileSync(path.join(__dirname,'..','public','icons','profile-switch.png'),png);
