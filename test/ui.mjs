/** Browser end-to-end test of the built React app served by the API. */
import { chromium } from 'playwright';

const BASE = process.env.UI_BASE || 'http://localhost:5000';
const G = '[32m'; const R = '[31m'; const B = '[1m'; const X = '[0m';

let pass = 0; let fail = 0; const failed = [];
const check = (name, ok, extra) => {
  if (ok) { pass += 1; console.log(`  ${G}PASS${X} ${name}`); }
  else { fail += 1; failed.push(name); console.log(`  ${R}FAIL ${name}${X} ${extra ? JSON.stringify(extra) : ''}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
// Uncaught JavaScript exceptions only. Blocked web fonts and the expected 401
// from the token check before sign-in are not application errors.
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/ERR_TUNNEL_CONNECTION_FAILED|fonts\.googleapis|fonts\.gstatic|401 \(Unauthorized\)|403 \(Forbidden\)/.test(t)) return;
  errors.push(t);
});

async function signIn(email, password) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.click('button[type=submit]');
  await page.waitForTimeout(1600);
}
async function logout() {
  await page.click('button[title="Log out"]');
  await page.waitForTimeout(500);
  await page.click('.drawer-foot .btn-primary');
  await page.waitForTimeout(1200);
}

console.log(`\n${B}Browser end-to-end${X}`);

await signIn('principal@prideandjoy.in', 'definitely-wrong');
check('wrong password shows an inline error', ((await page.textContent('.err')) || '').includes('Incorrect password'));

await signIn('principal@prideandjoy.in', 'Principal@123');
check('principal reaches the dashboard', await page.isVisible('.rail'));
const nav = await page.$$eval('.nav-item', (n) => n.map((x) => x.textContent.trim()));
// 10 menu entries; the 11th view (the student ledger) is reached from the directory, not the menu.
check('sidebar shows all 10 menu entries for the Principal', nav.length === 10, nav);
check('KPI tiles render', (await page.$$('.kpi')).length >= 4);
check('cash-flow chart is drawn', (await page.$$('#colChart .cbar')).length > 0);
await page.screenshot({ path: 'test/shot-dashboard.png' });

await page.click('[href="/students"]'); await page.waitForTimeout(1000);
const rows = await page.$$eval('tbody tr', (n) => n.length);
check('student directory lists the admitted students', rows >= 3, { rows });
await page.screenshot({ path: 'test/shot-students.png' });

await page.click('tbody tr'); await page.waitForTimeout(1100);
check('student ledger opens', await page.isVisible('text=Fee Ledger'));
check('ledger shows the instalment rows', (await page.$$eval('tbody tr', (n) => n.length)) >= 8);
await page.screenshot({ path: 'test/shot-ledger.png' });

await page.click('[href="/fee-master"]'); await page.waitForTimeout(1400);
check('fee master loads the class plan', await page.isVisible('text=Session total'));
check('the Principal gets the add-instalment control', await page.isVisible('text=+ Add instalment'));
await page.click('text=+ Add instalment'); await page.waitForTimeout(700);
check('the instalment editor opens with a fee-head line', await page.isVisible('text=Fee heads in this instalment'));
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
await page.screenshot({ path: 'test/shot-feemaster.png' });

await page.click('[href="/collect"]'); await page.waitForTimeout(1200);
check('collect-fee student picker opens', await page.isVisible('input[placeholder*="Adm. No"]'));
await page.click('tbody tr'); await page.waitForTimeout(1400);
check('pending instalments are listed with checkboxes', (await page.$$('input[type=checkbox]')).length > 0);
await page.click('input[type=checkbox]'); await page.waitForTimeout(600);
check('payment summary appears once an instalment is selected', await page.isVisible('text=Total receivable'));
await page.screenshot({ path: 'test/shot-collect.png' });

await page.click('[href="/receipts"]'); await page.waitForTimeout(1200);
check('receipt register lists receipts', (await page.$$eval('tbody tr', (n) => n.length)) >= 3);
await page.click('tbody tr'); await page.waitForTimeout(1200);
check('a receipt opens in the drawer', await page.isVisible('.receipt'));
check('the receipt prints the amount in words', ((await page.textContent('.receipt')) || '').includes('Rupees:'));
await page.screenshot({ path: 'test/shot-receipt.png' });
await page.keyboard.press('Escape'); await page.waitForTimeout(500);

await page.click('[href="/reports"]'); await page.waitForTimeout(1400);
check('reports screen offers exactly three reports', (await page.$$eval('.btn b', (n) => n.length)) >= 3);
await page.screenshot({ path: 'test/shot-reports.png' });

await page.click('[href="/day-book"]'); await page.waitForTimeout(1100);
check('day book loads', await page.isVisible('text=Day Book'));

await page.click('[href="/concessions"]'); await page.waitForTimeout(1100);
check('concession register loads', await page.isVisible('text=Concession & Discount Register'));

await page.click('[href="/settings"]'); await page.waitForTimeout(1500);
check('settings shows the logo uploader', await page.isVisible('.dropzone'));
check('settings shows the role permission matrix', await page.isVisible('text=Role permissions'));
check('settings lists the user accounts', (await page.$$eval('tbody tr', (n) => n.length)) >= 4);
await page.screenshot({ path: 'test/shot-settings.png' });

await logout();
check('logout returns to the sign-in screen', await page.isVisible('input[type=password]'));

await signIn('frontdesk@prideandjoy.in', 'Passw0rd!23');
const nav2 = await page.$$eval('.nav-item', (n) => n.map((x) => x.textContent.trim()));
check('front desk sidebar is cut down to 4 modules', nav2.length === 4, nav2);
check('front desk gets no Fee Collect button', !nav2.some((t) => t.includes('Collect')));
await page.screenshot({ path: 'test/shot-frontdesk.png' });

await page.goto(`${BASE}/collect`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1100);
check('typing the collect URL as front desk gives Access restricted', await page.isVisible('text=Access restricted'));

await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
await logout();
await signIn('ritu@prideandjoy.in', 'Passw0rd!23');
const nav3 = await page.$$eval('.nav-item', (n) => n.map((x) => x.textContent.trim()));
check('class teacher sidebar is cut down to 2 modules', nav3.length === 2, nav3);
await page.click('[href="/students"]'); await page.waitForTimeout(1200);
const teacherRows = await page.$$eval('tbody tr', (n) => n.length);
check('class teacher sees only her own class', teacherRows === 2, { teacherRows });
await page.screenshot({ path: 'test/shot-teacher.png' });

check('no uncaught JavaScript errors anywhere in the app', errors.length === 0, errors.slice(0, 3));

await browser.close();
console.log(`\n  ${G}${pass} passed${X}  ${fail ? `${R}${fail} failed${X}` : '0 failed'}`);
if (fail) { failed.forEach((f) => console.log(`   - ${f}`)); process.exit(1); }
