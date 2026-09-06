import { chromium } from 'playwright';
const BASE = 'http://localhost:5190';
const FILE = new URL('./_fixture.png', import.meta.url).pathname.replace(/^\//, '');
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] });
const ctx = await browser.newContext({ permissions:['camera','geolocation'], geolocation:{latitude:12.9165,longitude:79.1325}, viewport:{width:1280,height:900} });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,160)); });
page.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0,160)));

await page.goto(BASE + '/#/login');
await page.waitForTimeout(1800);
await page.getByRole('textbox', { name: 'Email' }).fill('rehome.household.test1@gmail.com');
await page.getByRole('textbox', { name: 'Password' }).fill('rehome-test-1234');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForTimeout(6000);

async function runOne(name, category, sub) {
  await page.setInputFiles('input[type=file]', FILE);
  // Either ReHome read the photo, or the detector could not load and the flow
  // asks for a description. Both are valid endings for the analysis step.
  await Promise.race([
    page.waitForSelector('text=Is that right?', { timeout: 90000 }),
    page.waitForSelector('text=What are you rehoming?', { timeout: 90000 }),
  ]);
  const notQuite = page.getByRole('button', { name: /Not quite/i });
  if (await notQuite.isVisible().catch(() => false)) {
    await notQuite.click();
    await page.waitForTimeout(400);
  }
  await page.getByRole('textbox', { name: 'What is it' }).fill(name);
  await page.getByRole('textbox', { name: 'Category', exact: true }).fill(category);
  await page.getByRole('textbox', { name: 'Subcategory' }).fill(sub);
  await page.getByRole('button', { name: /^Continue$/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^Good/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Find destinations/i }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /Add to ReHome/i }).click();
  await page.waitForSelector('text=REHOMING SESSION', { timeout: 90000 });
}

await page.goto(BASE + '/#/app/scan');
await page.waitForTimeout(2000);
console.log('--- item 1 ---');
await runOne('Notebook', 'Education', 'Stationery');
console.log((await page.locator('main').innerText()).slice(0, 600));
await page.screenshot({ path: 'shot-session-1.png', fullPage: true });

console.log('\n--- add another item ---');
await page.getByRole('button', { name: /Add another item/i }).click();
await page.waitForTimeout(1200);
console.log('after add-another, step text:', (await page.locator('main').innerText()).slice(0, 220));

await runOne('Blanket', 'Home', 'Bedding');
console.log('\n--- session after two items ---');
console.log((await page.locator('main').innerText()).slice(0, 800));
await page.screenshot({ path: 'shot-session-2.png', fullPage: true });

console.log('\nerrors:', errs.length ? [...new Set(errs)].join('\n') : 'none');
await browser.close();
