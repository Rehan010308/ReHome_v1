import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:5190';
const ID = process.env.ALLOC || '49362cef-d26b-4636-822f-5f96084fc500';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERROR:', m.text().slice(0,200)); });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0,250)));
page.on('response', async r => { if (r.url().includes('match_allocations')) console.log('RESP', r.status(), r.url().slice(0,160)); });

await page.goto(BASE + '/#/login');
await page.waitForTimeout(1800);
await page.getByRole('textbox', { name: 'Email' }).fill('rehome.household.test1@gmail.com');
await page.getByRole('textbox', { name: 'Password' }).fill('rehome-test-1234');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForTimeout(6000);

// Full page load straight at the verify route, exactly like opening a scanned link.
await page.goto(BASE + '/#/app/verify/' + ID);
await page.reload();
await page.waitForTimeout(10000);
console.log('--- verify page ---');
console.log((await page.locator('main').innerText()).slice(0, 800));
await browser.close();
