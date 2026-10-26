// Browser test of the static demo (scripts/build-demo.sh): every section from
// the sidebar, the detail pages behind links, a link that carries a query
// string, a vote, and no errors. Run it with scripts/e2e/run-demo.sh.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL_ = process.env.DEMO_URL ?? 'http://127.0.0.1:4174/beis-demo.html';
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = (page, name) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png` }) : null);

const browser = await chromium.launch();
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // Only the demo's own files are under test: requests elsewhere (the web
  // fonts) get an empty answer, so the test needs no network.
  const origin = new URL(URL_).origin;
  await page.route(u => u.origin !== origin, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));

  await page.goto(URL_);
  await page.getByRole('heading', { level: 1, name: 'בית המדרש' }).first().waitFor({ timeout: 20000 });
  await shot(page, 'beis-01-home');

  // Every section, reached by its link in the sidebar.
  const sections = [
    ['חבורות', '/chaburot'], ['חיבורים', '/chibburim'], ['שלבים', '/seifim'], ['חברים', '/anash'],
    ['בדיקה', '/review'], ['התוועדות', '/farbrengen'], ['הכרעות', '/governance'], ['אוצר', '/treasury'],
    ['תמיכה', '/support'], ['הגדרות', '/settings'],
  ];
  const nav = page.locator('nav, aside').first();
  for (const [label, path] of sections) {
    await nav.getByRole('link', { name: label, exact: false }).first().click();
    await page.waitForFunction(p => location.hash === '#' + p, path, { timeout: 10000 });
    await page.getByRole('heading', { level: 1, name: label }).first().waitFor({ timeout: 10000 });
  }
  console.log(`OK: ${sections.length} sections from the sidebar`);

  // A chaburah, and a new chibbur started from it: the chaburah comes along in the link's query.
  await nav.getByRole('link', { name: 'חבורות' }).first().click();
  await page.locator('main a[href^="#/chaburot/mv-"]').first().click();
  await page.waitForFunction(() => /^#\/chaburot\/mv-[^/]+$/.test(location.hash));
  const mivtzaId = (await page.evaluate(() => location.hash)).split('/').pop();
  await shot(page, 'beis-02-chaburah');
  const newChibbur = page.locator(`a[href="#/chibburim/new?mivtzaId=${mivtzaId}"]`);
  if (await newChibbur.count()) {
    await newChibbur.first().click();
    await page.waitForFunction(() => location.hash.startsWith('#/chibburim/new'));
    const picked = await page.locator('select#mivtza').inputValue();
    if (picked !== mivtzaId) throw new Error(`the new chibbur form did not pick up the chaburah (${picked} ≠ ${mivtzaId})`);
    console.log('OK: a link with a query string carries it into the form');
  }

  // A chibbur and a member.
  await page.goto(URL_ + '#/chibburim');
  await page.locator('main a[href^="#/chibburim/ms-"]').first().click();
  await page.waitForFunction(() => /^#\/chibburim\/ms-[^/]+$/.test(location.hash));
  await shot(page, 'beis-03-chibbur');
  await page.goto(URL_ + '#/anash');
  await page.locator('main a[href^="#/anash/tal-"]').first().click();
  await page.waitForFunction(() => /^#\/anash\/tal-[^/]+$/.test(location.hash));
  await shot(page, 'beis-04-member');

  // Governance: open a proposal and vote for it.
  await page.goto(URL_ + '#/governance');
  await page.locator('main a[href^="#/governance/prop-"]').first().click();
  await page.waitForFunction(() => /^#\/governance\/prop-[^/]+$/.test(location.hash));
  await page.getByRole('button', { name: /^בעד —/ }).click();
  await page.getByText('הצבעת בעד').first().waitFor({ timeout: 5000 });
  await shot(page, 'beis-05-voted');
  console.log('OK: details of a chaburah, a chibbur, a member and a proposal; a vote');

  // The demo says it is one.
  await page.goto(URL_ + '#/');
  await page.getByText('הדגמה · נתונים לדוגמה').waitFor({ timeout: 5000 });

  if (errors.length) throw new Error('console errors:\n' + errors.join('\n'));
  console.log('OK: Beis demo flows, no console errors');
} finally {
  await browser.close();
}
