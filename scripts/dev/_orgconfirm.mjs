import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:5190';
const ALLOC = process.env.ALLOC;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,180)); });
page.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0,180)));

await page.goto(BASE + '/#/login');
await page.waitForTimeout(1800);
await page.getByRole('textbox', { name: 'Email' }).fill('brightfuture.demo@rehome.test');
await page.getByRole('textbox', { name: 'Password' }).fill('Demo@12345');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForTimeout(6000);
console.log('org landed on:', page.url());

console.log('\n--- organization handoffs list ---');
await page.goto(BASE + '/#/app/handoffs');
await page.waitForTimeout(8000);
console.log((await page.locator('main').innerText()).slice(0, 700));

const verifyLink = page.getByRole('link', { name: /Verify and confirm receipt/i });
console.log('\nverify link present:', await verifyLink.count());
if (await verifyLink.count()) {
  const t0 = Date.now();
  await verifyLink.first().click();
  await page.waitForSelector('text=Confirm receipt', { timeout: 30000 }).catch(() => console.log('confirm never appeared'));
  console.log('verify page settled in ms:', Date.now() - t0);
  console.log('\n--- verify page (organization) ---');
  console.log((await page.locator('main').innerText()).slice(0, 700));
  await page.screenshot({ path: 'shot-verify.png', fullPage: true });

  const confirm = page.getByRole('button', { name: /Confirm receipt/i });
  console.log('\nconfirm button present:', await confirm.count());
  if (await confirm.count()) {
    await confirm.first().click();
    await page.waitForTimeout(7000);
    console.log('\n--- after confirming ---');
    console.log((await page.locator('main').innerText()).slice(0, 600));
    await page.screenshot({ path: 'shot-confirmed.png', fullPage: true });
  }
}

console.log('\nerrors:', errs.length ? [...new Set(errs)].join('\n') : 'none');
await browser.close();
