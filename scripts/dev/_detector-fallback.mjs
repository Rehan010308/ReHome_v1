import { chromium } from 'playwright';
const BASE = 'http://localhost:5190';
const FILE = 'C:/Users/rehan/Downloads/ReHome_v1/scripts/dev/_fixture.png';
const browser = await chromium.launch();
const ctx = await browser.newContext({ permissions:['geolocation'], geolocation:{latitude:12.9165,longitude:79.1325}, viewport:{width:1280,height:900} });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push('CONSOLE ' + m.text().slice(0,160)); });
page.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0,220)));
await page.goto(BASE + '/#/login');
await page.waitForTimeout(1500);
await page.getByRole('textbox', { name: 'Email' }).fill('rehome.household.test1@gmail.com');
await page.getByRole('textbox', { name: 'Password' }).fill('rehome-test-1234');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForTimeout(6000);
await page.goto(BASE + '/#/app/scan');
await page.waitForTimeout(2500);
const t0 = Date.now();
await page.setInputFiles('input[type=file]', FILE);
await Promise.race([
  page.waitForSelector('text=What are you rehoming?', { timeout: 60000 }),
  page.waitForSelector('text=Is that right?', { timeout: 60000 }),
]).catch(()=>{});
await page.waitForTimeout(1000);
console.log('elapsed to settle:', Math.round((Date.now()-t0)/1000)+'s');
console.log('MAIN:', (await page.locator('main').innerText()).slice(0,700).replace(/\n+/g,' | '));
await page.screenshot({ path: 'shot-detector-unavailable.png', fullPage: true });
console.log('errors:', errs.length ? [...new Set(errs)].join('\n') : 'none');
await browser.close();
