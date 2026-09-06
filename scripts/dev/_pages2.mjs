import { chromium } from 'playwright';
const BASE = 'http://localhost:5190';
const ITEM = '3c083027-15f5-44e9-bf41-98cdcbaf95c1';
const ORG = '11111111-1111-4111-8111-111111111111';
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

await page.goto(BASE + '/#/app/item/' + ITEM);
await page.waitForTimeout(6000);
console.log('--- item lifecycle ---');
console.log((await page.locator('main').innerText()).slice(0, 700));
await page.screenshot({ path: 'shot-item.png', fullPage: true });

await page.goto(BASE + '/#/app/destination/' + ORG);
await page.waitForTimeout(6000);
console.log('\n--- destination profile ---');
console.log((await page.locator('main').innerText()).slice(0, 700));
await page.screenshot({ path: 'shot-destination.png', fullPage: true });

console.log('\nerrors:', errs.length ? [...new Set(errs)].join('\n') : 'none');
await browser.close();
