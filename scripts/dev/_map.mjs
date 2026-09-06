import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5190';
const errors = [];
const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const ctx = await browser.newContext({
  permissions: ['camera', 'geolocation'],
  geolocation: { latitude: 12.9165, longitude: 79.1325 },
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 160)));

await page.goto(BASE + '/#/login');
await page.waitForTimeout(1800);
await page.getByRole('textbox', { name: 'Email' }).fill('rehome.household.test1@gmail.com');
await page.getByRole('textbox', { name: 'Password' }).fill('rehome-test-1234');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForTimeout(6000);

await page.goto(BASE + '/#/app/handoffs');
await page.waitForTimeout(9000);
console.log('--- handoffs text ---');
console.log((await page.locator('main').innerText()).slice(0, 900));

const tiles = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("img")].filter((i) => i.src.includes("openstreetmap"));
  return {
    count: imgs.length,
    loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    sample: imgs[0]?.src ?? null,
  };
});
console.log('map tiles:', JSON.stringify(tiles));

const qrToggle = page.getByRole('button', { name: /Show handoff QR/i });
console.log('QR toggle present:', await qrToggle.count());
if (await qrToggle.count()) {
  await qrToggle.first().click();
  await page.waitForTimeout(1200);
  const qr = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg[role="img"]')].find((s) =>
      (s.getAttribute('aria-label') || '').startsWith('Handoff code')
    );
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return { label: svg.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height), modules: svg.querySelectorAll('path').length };
  });
  console.log('QR:', JSON.stringify(qr));
}

await page.screenshot({ path: 'shot-journey.png', fullPage: true });
const mapBox = page.locator('img[src*="openstreetmap"]').first();
if (await mapBox.count()) {
  const container = page.locator('div').filter({ has: mapBox }).first();
  await container.screenshot({ path: 'shot-map-only.png' }).catch(() => {});
}

console.log('\nerrors:', errors.length ? [...new Set(errors)].join('\n') : 'none');
await browser.close();
