import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:5190';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,180)); });
page.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0,180)));

await page.goto(BASE + '/#/login');
await page.waitForTimeout(1800);
await page.getByRole('textbox', { name: 'Email' }).fill('donor.aarav.demo@rehome.test');
await page.getByRole('textbox', { name: 'Password' }).fill('Demo@12345');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForTimeout(6000);

// Impact → receipt, following the app's own links.
await page.goto(BASE + '/#/app/impact');
await page.waitForSelector('text=Where your things went', { timeout: 25000 });
await page.waitForTimeout(1500);
const receipt = page.getByRole('link', { name: /View impact receipt/i }).first();
console.log('receipt links:', await page.getByRole('link', { name: /View impact receipt/i }).count());
await receipt.click();
await page.waitForTimeout(6000);
console.log('\n--- impact receipt ---');
console.log((await page.locator('main').innerText()).slice(0, 700));
await page.screenshot({ path: 'shot-receipt.png', fullPage: true });

// Item lifecycle page.
const itemId = await page.evaluate(async () => {
  const key = Object.keys(localStorage).find(k => k.endsWith('-auth-token'));
  const token = JSON.parse(localStorage.getItem(key)).access_token;
  const url = document.querySelector('meta[name="sb"]')?.content;
  return { token: !!token };
});
console.log('\nhas token:', JSON.stringify(itemId));

await browser.close();
console.log('\nerrors:', errs.length ? [...new Set(errs)].join('\n') : 'none');
