import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:5191';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:1000} })).newPage();
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,180)); });
page.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0,220)));

await page.goto(BASE + '/#/');
await page.waitForTimeout(5000);
console.log('hero canvas:', await page.locator('canvas').count());
await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.2));
await page.waitForTimeout(5000);
const t = await page.locator('body').innerText();
const i = t.indexOf('Analysis Result');
console.log('ReVision demo:', t.slice(i, i + 260).replace(/\n+/g, ' | '));

await page.goto(BASE + '/#/login');
await page.waitForTimeout(1500);
await page.getByRole('textbox', { name: 'Email' }).fill('rehome.household.test1@gmail.com');
await page.getByRole('textbox', { name: 'Password' }).fill('rehome-test-1234');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForTimeout(7000);
console.log('after login:', page.url());
console.log('command centre:', (await page.locator('main').innerText()).slice(0, 220).replace(/\n+/g, ' | '));
for (const r of ['/#/app/scan', '/#/app/matches', '/#/app/handoffs', '/#/app/impact']) {
  await page.goto(BASE + r);
  await page.waitForTimeout(3500);
  console.log(r, '→', (await page.locator('main').innerText()).slice(0, 90).replace(/\n+/g, ' | '));
}
console.log('errors:', errs.length ? [...new Set(errs)].join('\n') : 'none');
await browser.close();
