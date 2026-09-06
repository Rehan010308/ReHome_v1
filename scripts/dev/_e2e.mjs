import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5190';
const errors = [];

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

async function session(label, { width = 1280, height = 900, geo = true } = {}) {
  const ctx = await browser.newContext({
    permissions: geo ? ['camera', 'geolocation'] : ['camera'],
    geolocation: geo ? { latitude: 12.9165, longitude: 79.1325 } : undefined,
    viewport: { width, height },
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] ${m.text().slice(0, 150)}`); });
  page.on('pageerror', (e) => errors.push(`[${label}] PAGEERROR ${String(e).slice(0, 150)}`));
  return { ctx, page };
}

async function login(page, email, password) {
  await page.goto(BASE + '/#/login');
  await page.waitForTimeout(1800);
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(6000);
  return page.url();
}

const step = (n, t) => console.log(`\n=== ${n} ${t} ===`);

/* ── 1. Donor: command centre, session, handoff, QR ────────────────────── */
{
  const { page } = await session('donor');
  step(1, 'donor login');
  console.log(await login(page, 'donor.aarav.demo@rehome.test', 'Demo@12345'));

  step(2, 'command centre');
  console.log((await page.locator('main').innerText()).slice(0, 420));
  const has3d = await page.locator('canvas').count();
  console.log('canvas elements on command centre:', has3d);

  step(3, 'impact page');
  await page.goto(BASE + '/#/app/impact');
  await page.waitForTimeout(5000);
  console.log((await page.locator('main').innerText()).slice(0, 900));
  await page.screenshot({ path: 'shot-impact.png', fullPage: true });

  step(4, 'handoffs (map + QR)');
  await page.goto(BASE + '/#/app/handoffs');
  await page.waitForTimeout(7000);
  console.log((await page.locator('main').innerText()).slice(0, 500));
  await page.screenshot({ path: 'shot-handoffs.png', fullPage: true });
}

/* ── 2. Donor with fresh location capture on Confirm destination ───────── */
{
  const { page } = await session('confirm');
  step(5, 'household login + scan a hazardous item');
  console.log(await login(page, 'rehome.household.test1@gmail.com', 'rehome-test-1234'));

  await page.goto(BASE + '/#/app/matches');
  await page.waitForTimeout(6000);
  const txt = await page.locator('main').innerText();
  console.log(txt.slice(0, 700));
  await page.screenshot({ path: 'shot-matches.png', fullPage: true });

  const notAFit = page.getByRole('button', { name: /Not a fit/i });
  if (await notAFit.count()) {
    step(6, 'Not a fit → command centre');
    await notAFit.first().click();
    await page.waitForTimeout(4000);
    console.log('url after Not a fit:', page.url());
  }
}

/* ── 3. Organization: dashboard, requirements, verify page ─────────────── */
{
  const { page } = await session('org');
  step(7, 'organization demo login');
  console.log(await login(page, 'brightfuture.demo@rehome.test', 'Demo@12345'));
  await page.waitForTimeout(3000);
  console.log((await page.locator('main').innerText()).slice(0, 900));
  await page.screenshot({ path: 'shot-org.png', fullPage: true });

  step(8, 'organization verify page');
  await page.goto(BASE + '/#/app/verify');
  await page.waitForTimeout(3000);
  console.log((await page.locator('main').innerText()).slice(0, 400));

  step(9, 'organization handoffs');
  await page.goto(BASE + '/#/app/handoffs');
  await page.waitForTimeout(6000);
  console.log((await page.locator('main').innerText()).slice(0, 400));
}

/* ── 4. Mobile ─────────────────────────────────────────────────────────── */
{
  const { page } = await session('mobile', { width: 390, height: 844 });
  step(10, 'mobile command centre + scan');
  await login(page, 'donor.aarav.demo@rehome.test', 'Demo@12345');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log('command centre horizontal overflow:', overflow);
  await page.screenshot({ path: 'shot-mobile-cc.png' });

  await page.goto(BASE + '/#/app/scan');
  await page.waitForTimeout(2500);
  const o2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log('scan horizontal overflow:', o2);

  await page.goto(BASE + '/#/app/handoffs');
  await page.waitForTimeout(7000);
  const o3 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log('handoffs horizontal overflow:', o3);
  await page.screenshot({ path: 'shot-mobile-handoff.png', fullPage: true });
}

console.log('\n=== CONSOLE ERRORS ===');
console.log(errors.length ? [...new Set(errors)].join('\n') : 'none');
await browser.close();
