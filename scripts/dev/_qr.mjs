import { chromium } from 'playwright';
import { inflateSync } from 'node:zlib';
import jsQR from 'jsqr';

/** Minimal PNG reader — enough to hand raw RGBA to a QR decoder. */
function decodePng(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    offset += 12 + length;
  }

  if (bitDepth !== 8) throw new Error('unexpected bit depth ' + bitDepth);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('unexpected colour type ' + colorType);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 0xff;
      else if (filter === 2) line[i] = (line[i] + b) & 0xff;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
    }
    for (let x = 0; x < width; x += 1) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      if (channels >= 3) {
        out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2];
        out[d + 3] = channels === 4 ? line[s + 3] : 255;
      } else {
        out[d] = out[d + 1] = out[d + 2] = line[s];
        out[d + 3] = channels === 2 ? line[s + 1] : 255;
      }
    }
    prev = line;
  }
  return { width, height, data: new Uint8ClampedArray(out) };
}

const BASE = process.env.BASE || 'http://localhost:5190';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  permissions: ['geolocation'],
  geolocation: { latitude: 12.9165, longitude: 79.1325 },
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERROR:', m.text().slice(0,200)); });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0,200)));

await page.goto(BASE + '/#/login');
await page.waitForTimeout(1800);
await page.getByRole('textbox', { name: 'Email' }).fill('rehome.household.test1@gmail.com');
await page.getByRole('textbox', { name: 'Password' }).fill('rehome-test-1234');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForTimeout(6000);

async function decodeVisibleQr(label) {
  const svg = page.locator(`svg[role="img"][aria-label^="${label}"]`).first();
  if (!(await svg.count())) return `no QR with label ${label}`;
  const png = await svg.screenshot({ scale: 'device' });
  const image = decodePng(png);
  const found = jsQR(image.data, image.width, image.height);
  return found?.data ?? `FAILED TO DECODE (${image.width}x${image.height})`;
}

await page.goto(BASE + '/#/app/handoffs');
await page.waitForTimeout(8000);
await page.getByRole('button', { name: /Show handoff QR/i }).first().click();
await page.waitForTimeout(1000);
const handoffPayload = await decodeVisibleQr('Handoff code');
console.log('handoff QR decodes to:', handoffPayload);

// Follow the decoded link exactly as a scanner would.
if (handoffPayload.startsWith('http')) {
  await page.goto(handoffPayload);
  await page.waitForTimeout(5000);
  console.log('\n--- what the scanned link opens (donor is signed in) ---');
  console.log((await page.locator('main').innerText()).slice(0, 600));
}

await browser.close();
