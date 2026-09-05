/**
 * End-to-end test of every module and every permission rule.
 *   1. npm run dev   (or npm start) in one terminal
 *   2. npm test      in another
 * The test wipes the database it points at, so never run it against production.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import FeeHead from '../src/models/FeeHead.js';
import School from '../src/models/School.js';

const BASE = process.env.TEST_BASE || `http://localhost:${process.env.PORT || 5000}/api`;
const HEADS = [
  ['Tuition Fee', 'tuition', 'recurring'], ['Admission Fee', 'admission', 'one-time'],
  ['Form / Prospectus', 'form', 'one-time'], ['Kit Charges', 'kit', 'one-time'],
  ['Half Annual Fee', 'annual', 'periodic'], ['Late Fee', 'late', 'penalty'],
  ['Previous Session Balance', 'carryforward', 'carry-forward'],
];

let passed = 0; let failed = 0; const failures = [];
const group = (name) => console.log(`\n\x1b[1m${name}\x1b[0m`);
function check(name, cond, extra) {
  if (cond) { passed += 1; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else { failed += 1; failures.push(name); console.log(`  \x1b[31m✗ ${name}\x1b[0m${extra ? `  → ${JSON.stringify(extra)}` : ''}`); }
}
const eq = (name, got, want) => check(`${name} = ${want}`, got === want, { got });

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
}
const GET = (p, t) => call('GET', p, { token: t });
const POST = (p, body, t) => call('POST', p, { token: t, body });
const PATCH = (p, body, t) => call('PATCH', p, { token: t, body });
const PUT = (p, body, t) => call('PUT', p, { token: t, body });
const DEL = (p, t, body) => call('DELETE', p, { token: t, body });

const iso = (d) => new Date(d).toISOString();
const YEAR = 2026;

async function resetDatabase() {
  await mongoose.connect(process.env.MONGO_URI);
  const cols = await mongoose.connection.db.listCollections().toArray();
  for (const c of cols) await mongoose.connection.db.collection(c.name).deleteMany({});
  const school = await School.current();
  Object.assign(school, {
    name: 'The Pride and Joy Preschool', branch: 'Munshipulia, Lucknow', phone: '+91-7388183330',
    email: 'theprideandjoy.munshipulia@gmail.com', payeeName: 'The Pride and Joy Preschool Munshipulia',
    session: '2026-27', receiptPrefix: 'PJ/26-27/', feeWindow: '1st – 10th of month',
    lateFeeFrom: 20, lateFeeAmount: 200, readmissionCharge: 500, advanceConcession: 3000,
  });
  await school.save();
  for (const [name, code, type] of HEADS) await FeeHead.create({ name, code, type });
  const admin = new User({ name: 'Shweta Awasthi', email: 'principal@prideandjoy.in', role: 'principal' });
  await admin.setPassword('Principal@123');
  await admin.save();
}

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with "npm run dev" first.\n`);
    process.exit(1);
  }
  await resetDatabase();

  /* ------------------------------------------------------------------ auth */
  group('1. Authentication');
  let r = await GET('/auth/status');
  eq('status.needsSetup', r.data.needsSetup, false);

  r = await POST('/auth/login', { email: 'principal@prideandjoy.in', password: 'wrong-one' });
  check('wrong password is refused with a clear message', r.status === 401 && /Incorrect password/.test(r.data.message), r.data);

  r = await POST('/auth/login', { email: 'nobody@nowhere.in', password: 'x' });
  check('unknown email is refused', r.status === 401 && /No account/.test(r.data.message), r.data);

  r = await POST('/auth/login', { email: 'principal@prideandjoy.in', password: 'Principal@123' });
  check('principal signs in', r.status === 200 && Boolean(r.data.token), r.data);
  const principal = r.data.token;

  r = await GET('/auth/me', principal);
  eq('me.role', r.data.role.key, 'principal');
  eq('principal sees every module', r.data.role.views.length, 11);

  r = await GET('/roles', principal);
  eq('role matrix roles', r.data.roles.length, 5);
  eq('role matrix permissions', r.data.permissions.length, 9);

  r = await POST('/auth/bootstrap', { name: 'Hacker', email: 'h@x.in', password: 'password123' });
  check('bootstrap is refused once a user exists', r.status === 409, r.data);

  /* ------------------------------------------------------------- fee heads */
  group('2. Fee heads');
  r = await GET('/fee-heads', principal);
  eq('seeded heads', r.data.heads.length, 7);
  const headId = (code) => r.data.heads.find((h) => h.code === code)._id;
  const H = { tuition: headId('tuition'), admission: headId('admission'), form: headId('form'), kit: headId('kit'), annual: headId('annual') };

  r = await POST('/fee-heads', { name: 'Exam Fee', code: 'exam', type: 'periodic' }, principal);
  check('new head created', r.status === 201 && r.data.head.name === 'Exam Fee', r.data);
  const examHead = r.data.head._id;

  r = await PATCH(`/fee-heads/${examHead}`, { name: 'Examination Fee', type: 'periodic' }, principal);
  eq('head renamed', r.data.head.name, 'Examination Fee');

  r = await DEL(`/fee-heads/${examHead}`, principal);
  check('unused head deleted', r.status === 200, r.data);

  /* --------------------------------------------------------------- classes */
  group('3. Classes and the fee plan');
  r = await POST('/classes', { name: 'Playgroup', code: 'PG', status: 'verified', source: 'Fee card scan' }, principal);
  check('class created', r.status === 201, r.data);
  const PG = r.data.class.id;

  r = await POST('/classes', { name: 'Playgroup', code: 'PG2' }, principal);
  check('duplicate class name is refused', r.status === 409, r.data);

  r = await POST('/classes', { name: 'X', code: 'X' }, principal);
  check('short class name is refused with a field message', r.status === 422 && Boolean(r.data.details?.name), r.data);

  // the printed fee card, instalment by instalment
  const T = 2750; const ANNUAL = 3000;
  const P = (head, amount) => ({ head, amount });
  const PLAN = [
    ['I', `${YEAR}-04-10`, [P(H.tuition, T), P(H.admission, 10000), P(H.form, 1000), P(H.kit, 9900)], 23650],
    ['II', `${YEAR}-05-10`, [P(H.tuition, T), P(H.tuition, T)], 5500],
    ['III', `${YEAR}-07-10`, [P(H.tuition, T), P(H.annual, ANNUAL)], 5750],
    ['IV', `${YEAR}-08-10`, [P(H.tuition, T)], 2750],
    ['V', `${YEAR}-09-10`, [P(H.tuition, T), P(H.tuition, T), P(H.annual, ANNUAL)], 8500],
    ['VI', `${YEAR}-11-10`, [P(H.tuition, T)], 2750],
    ['VII', `${YEAR}-12-10`, [P(H.tuition, T), P(H.tuition, T)], 5500],
    ['VIII', `${YEAR + 1}-01-10`, [P(H.tuition, T), P(H.tuition, T)], 5500],
  ];
  let planOk = true; let cls = null;
  for (const [no, dueDate, parts, expect] of PLAN) {
    const res = await POST(`/classes/${PG}/instalments`, { no, dueDate, parts }, principal);
    cls = res.data.class;
    const made = cls?.plan.find((p) => p.no === no);
    const total = made ? made.parts.reduce((s, x) => s + x.amount, 0) : -1;
    if (res.status !== 201 || total !== expect) { planOk = false; check(`instalment ${no} = ${expect}`, false, res.data); }
  }
  check('all 8 instalments of the fee card created with the right totals', planOk);
  eq('session total (Playgroup)', cls.plan.reduce((s, p) => s + p.parts.reduce((a, x) => a + x.amount, 0), 0), 59900);
  check('instalment months derived from the due date', cls.plan[0].month === `Apr ${YEAR}` && cls.plan[7].month === `Jan ${YEAR + 1}`, cls.plan.map((p) => p.month));

  r = await POST(`/classes/${PG}/instalments`, { no: 'I', dueDate: `${YEAR}-04-10`, parts: [P(H.tuition, 100)] }, principal);
  check('duplicate instalment number is refused', r.status === 409, r.data);

  r = await POST(`/classes/${PG}/instalments`, { no: 'ZZ', dueDate: `${YEAR}-04-10`, parts: [P(H.tuition, 0)] }, principal);
  check('zero-total instalment is refused', r.status === 422, r.data);

  const instIV = cls.plan.find((p) => p.no === 'IV');
  r = await PATCH(`/classes/${PG}/instalments/${instIV._id}`, { no: 'IV', dueDate: `${YEAR}-08-10`, parts: [P(H.tuition, 3000)] }, principal);
  eq('instalment edited', r.data.class.plan.find((p) => p.no === 'IV').parts[0].amount, 3000);
  await PATCH(`/classes/${PG}/instalments/${instIV._id}`, { no: 'IV', dueDate: `${YEAR}-08-10`, parts: [P(H.tuition, T)] }, principal);

  r = await POST('/classes', { name: 'Nursery', code: 'NUR', copyFrom: PG }, principal);
  check('plan copied into a new class', r.status === 201 && r.data.class.plan.length === 8, r.data);
  const NUR = r.data.class.id;

  r = await POST(`/classes/${NUR}/copy-plan`, { from: PG, adjustPercent: 10 }, principal);
  const nurTotal = r.data.class.plan.reduce((s, p) => s + p.parts.reduce((a, x) => a + x.amount, 0), 0);
  check('copy-plan with +10% raises the total', nurTotal > 59900, { nurTotal });

  /* ----------------------------------------------------------------- users */
  group('4. Users and roles');
  const mk = async (name, email, role, classId) => {
    const res = await POST('/users', { name, email, password: 'Passw0rd!23', role, classId }, principal);
    check(`${role} account created`, res.status === 201, res.data);
    const login = await POST('/auth/login', { email, password: 'Passw0rd!23' });
    return login.data.token;
  };
  const accountant = await mk('Neelam Bisht', 'accounts@prideandjoy.in', 'accountant');
  const frontdesk = await mk('Farhan Ali', 'frontdesk@prideandjoy.in', 'frontdesk');
  const teacher = await mk('Ritu Saxena', 'ritu@prideandjoy.in', 'teacher', PG);

  r = await POST('/users', { name: 'Copy Cat', email: 'accounts@prideandjoy.in', password: 'Passw0rd!23', role: 'accountant' }, principal);
  check('duplicate email is refused', r.status === 409, r.data);

  r = await GET('/users', accountant);
  check('accountant cannot list users', r.status === 403, r.data);

  r = await GET('/auth/me', teacher);
  eq('teacher sees 3 modules', r.data.role.views.length, 3);
  eq('teacher concession limit', r.data.role.maxDiscount, 0);
  eq('accountant concession limit', (await GET('/auth/me', accountant)).data.role.maxDiscount, 1000);

  /* ------------------------------------------------------------- admission */
  group('5. Admission and validation');
  const baseStudent = {
    name: 'Aarav Srivastava', dob: `${YEAR - 3}-05-14`, gender: 'M', classId: PG, section: 'A',
    admissionDate: `${YEAR}-04-02`, bloodGroup: 'A+', father: 'Rohit Srivastava', mother: 'Nidhi Srivastava',
    phone: '9839144210', email: 'rohit@example.com', address: 'Sector 5, Munshipulia, Lucknow',
  };
  r = await POST('/students', { ...baseStudent, phone: '12345' }, frontdesk);
  check('short mobile number is refused', r.status === 422 && /10-digit/.test(r.data.message), r.data);

  r = await POST('/students', { ...baseStudent, phone: '1234567890' }, frontdesk);
  check('mobile not starting 6-9 is refused', r.status === 422, r.data);

  r = await POST('/students', { ...baseStudent, name: 'Aarav123' }, frontdesk);
  check('digits in the name are refused', r.status === 422, r.data);

  r = await POST('/students', { ...baseStudent, aadhaarLast4: '12345' }, frontdesk);
  check('Aadhaar longer than 4 digits is refused', r.status === 422, r.data);

  r = await POST('/students', { ...baseStudent, email: 'not-an-email' }, frontdesk);
  check('a malformed email is refused', r.status === 422, r.data);

  r = await POST('/students', baseStudent, frontdesk);
  check('front desk can admit a student', r.status === 201, r.data);
  const s1 = r.data.student;
  eq('ledger rows created', r.data.ledgerRows, 8);
  check('admission number is generated', /^\w{2}\d{2}0001$/.test(s1.admissionNo), s1.admissionNo);

  r = await POST('/students', {
    ...baseStudent, name: 'Ziva Khan', gender: 'F', father: 'Imran Khan', mother: 'Sana Khan',
    phone: '9335971802', carryForward: 4200, concessions: { I: 2000 }, concessionReason: 'Sibling Concession',
  }, principal);
  const s2 = r.data.student;
  check('carry-forward student admitted', r.status === 201, r.data);
  eq('ledger rows include the C/F row', r.data.ledgerRows, 9);

  r = await GET(`/students/${s2._id}`, principal);
  const cf = r.data.ledger.find((l) => l.isCarryForward);
  check('C/F row is first and holds the old balance', Boolean(cf) && cf.gross === 4200 && r.data.ledger[0].isCarryForward, cf);
  eq('admission concession applied to instalment I', r.data.ledger.find((l) => l.instNo === 'I').discount, 2000);
  eq('net payable after concession', r.data.totals.payable, 59900 + 4200 - 2000);

  r = await GET('/concessions', principal);
  check('admission concession appears in the register', r.data.total === 2000 && r.data.concessions[0].reason === 'Sibling Concession', r.data.total);

  r = await POST('/students', { ...baseStudent, name: 'Nursery Kid', phone: '9000000001', classId: NUR }, principal);
  const s3 = r.data.student;
  check('student admitted into the second class', r.status === 201, r.data);

  r = await GET('/students', principal);
  eq('directory lists all students', r.data.students.length, 3);
  eq('directory computes outstanding', r.data.students.find((x) => x._id === s1._id).totals.outstanding, 59900);

  /* ------------------------------------------------------------ collect fee */
  group('6. Fee collection, concession limits and receipts');
  r = await GET(`/fee/pending/${s1._id}?date=${YEAR}-09-05`, accountant);
  const rows = r.data.rows;
  eq('pending rows', rows.length, 8);
  const instI = rows.find((x) => x.instNo === 'I');
  eq('instalment I balance', instI.balance, 23650);
  eq('late fee suggested on the 5th', instI.suggestedLateFee, 200);

  r = await GET(`/fee/pending/${s1._id}?date=${YEAR}-04-05`, accountant);
  eq('no late fee inside the fee window', r.data.rows.find((x) => x.instNo === 'I').suggestedLateFee, 0);

  r = await POST('/fee/collect', {
    studentId: s1._id, date: `${YEAR}-04-06`, mode: 'UPI',
    lines: [{ ledgerId: instI._id, discount: 1500, discountReason: 'Sibling Concession', lateFee: 0 }],
  }, accountant);
  check('accountant cannot exceed the ₹1,000 concession limit', r.status === 403 && /limit/i.test(r.data.message), r.data);

  r = await POST('/fee/collect', {
    studentId: s1._id, date: `${YEAR}-04-06`, mode: 'UPI',
    lines: [{ ledgerId: instI._id, discount: 800, discountReason: '', lateFee: 0 }],
  }, accountant);
  check('a concession without a reason is refused', r.status === 422 && /reason/i.test(r.data.message), r.data);

  r = await POST('/fee/collect', {
    studentId: s1._id, date: `${YEAR}-04-06`, mode: 'UPI', refNo: 'TXN90210',
    lines: [{ ledgerId: instI._id, discount: 800, discountReason: 'Sibling Concession', lateFee: 0 }],
  }, accountant);
  check('accountant collects within the limit', r.status === 201, r.data);
  const rc1 = r.data.receipt;
  eq('receipt number', rc1.receiptNo, 'PJ/26-27/0001');
  eq('receipt total', rc1.total, 23650 - 800);
  eq('amount in words', r.data.amountInWords, 'Twenty Two Thousand Eight Hundred Fifty');

  r = await GET(`/students/${s1._id}`, principal);
  const paidI = r.data.ledger.find((l) => l.instNo === 'I');
  check('ledger row marked paid and linked to the receipt', paidI.balance === 0 && paidI.discount === 800 && Boolean(paidI.receipt), paidI);
  eq('student outstanding after the first receipt', r.data.totals.outstanding, 59900 - 23650);

  r = await POST('/fee/collect', {
    studentId: s1._id, date: `${YEAR}-04-06`, mode: 'UPI',
    lines: [{ ledgerId: instI._id, discount: 0, discountReason: '', lateFee: 0 }],
  }, accountant);
  check('a cleared instalment cannot be collected twice', r.status === 409, r.data);

  const rowsAfter = (await GET(`/fee/pending/${s1._id}`, accountant)).data.rows;
  const instII = rowsAfter.find((x) => x.instNo === 'II');
  const instIII = rowsAfter.find((x) => x.instNo === 'III');
  r = await POST('/fee/collect', {
    studentId: s1._id, date: `${YEAR}-05-08`, mode: 'Cheque', refNo: '004521',
    lines: [
      { ledgerId: instII._id, discount: 0, discountReason: '', lateFee: 0 },
      { ledgerId: instIII._id, discount: 0, discountReason: '', lateFee: 200 },
    ],
  }, accountant);
  eq('second receipt number is the next in sequence', r.data.receipt.receiptNo, 'PJ/26-27/0002');
  eq('multi-instalment receipt total (with late fee)', r.data.receipt.total, 5500 + 5750 + 200);
  const rc2 = r.data.receipt;

  r = await POST('/fee/collect', {
    studentId: s1._id, date: `${YEAR}-05-08`, mode: 'Cash (at office)',
    lines: [{ ledgerId: rowsAfter.find((x) => x.instNo === 'IV')._id, discount: 2750, discountReason: 'Staff Ward', lateFee: 0 }],
  }, principal);
  check('the Principal may waive a whole instalment (₹0 receipt)', r.status === 201 && r.data.receipt.total === 0 && r.data.receipt.discount === 2750, r.data);

  r = await POST('/fee/collect', { studentId: s1._id, date: `${YEAR}-05-08`, mode: 'UPI', lines: [] }, accountant);
  check('an empty receipt is refused', r.status === 422, r.data);

  r = await GET(`/fee/pending/${s1._id}`, frontdesk);
  check('front desk cannot open the collection screen', r.status === 403, r.data);

  /* -------------------------------------------------------------- receipts */
  group('7. Receipt register and cancellation');
  r = await GET('/receipts', principal);
  check('register lists the receipts issued', r.data.receipts.length >= 3, r.data.totals);
  check('register totals add up', r.data.totals.total > 0 && Object.keys(r.data.totals.byMode).length >= 2, r.data.totals);
  eq('next receipt number is shown', r.data.nextReceiptNo, 'PJ/26-27/0004');

  r = await GET(`/receipts/${rc2._id}`, principal);
  check('a single receipt loads with words and school details', r.data.receipt.receiptNo === 'PJ/26-27/0002' && Boolean(r.data.amountInWords) && r.data.school.payeeName.length > 0, r.data.amountInWords);

  r = await POST(`/receipts/${rc2._id}/cancel`, { reason: 'Cheque returned unpaid' }, accountant);
  check('accountant cannot cancel a receipt', r.status === 403, r.data);

  r = await POST(`/receipts/${rc2._id}/cancel`, { reason: 'x' }, principal);
  check('cancelling without a reason is refused', r.status === 422, r.data);

  r = await POST(`/receipts/${rc2._id}/cancel`, { reason: 'Cheque returned unpaid' }, principal);
  check('Principal cancels the receipt', r.status === 200, r.data);

  r = await GET(`/students/${s1._id}`, principal);
  const backII = r.data.ledger.find((l) => l.instNo === 'II');
  check('the cancelled receipt reversed the ledger', backII.paid === 0 && backII.balance === 5500, backII);

  r = await POST(`/receipts/${rc2._id}/cancel`, { reason: 'again' }, principal);
  check('a receipt cannot be cancelled twice', r.status === 409, r.data);

  r = await POST('/fee/collect', {
    studentId: s1._id, date: `${YEAR}-05-09`, mode: 'UPI',
    lines: [{ ledgerId: backII._id, discount: 0, discountReason: '', lateFee: 0 }],
  }, accountant);
  eq('the cancelled number is never reused', r.data.receipt.receiptNo, 'PJ/26-27/0004');

  /* ------------------------------------------------- fee master safeguards */
  group('8. Fee master safeguards on live data');
  const planNow = (await GET(`/classes/${PG}`, principal)).data;
  eq('collected count is reported per instalment', planNow.collected.I, 1);
  const paidInst = planNow.class.plan.find((p) => p.no === 'I');

  r = await PATCH(`/classes/${PG}/instalments/${paidInst._id}`, { no: 'I', dueDate: `${YEAR}-04-10`, parts: [P(H.tuition, 1)] }, principal);
  check('a collected instalment cannot be edited', r.status === 409, r.data);

  r = await DEL(`/classes/${PG}/instalments/${paidInst._id}`, principal);
  check('a collected instalment cannot be deleted', r.status === 409, r.data);

  const freeInst = planNow.class.plan.find((p) => p.no === 'VIII');
  r = await DEL(`/classes/${PG}/instalments/${freeInst._id}`, principal);
  check('an uncollected instalment is deleted and ledgers follow', r.status === 200 && r.data.sync.students >= 1, r.data);
  r = await GET(`/students/${s1._id}`, principal);
  check('the deleted instalment left the student ledger', !r.data.ledger.some((l) => l.instNo === 'VIII'), r.data.ledger.map((l) => l.instNo));
  r = await GET(`/classes/${PG}`, principal);
  check('the deletion is persisted in the class plan', !r.data.class.plan.some((p) => p.no === 'VIII'), r.data.class.plan.map((p) => p.no));

  r = await POST(`/classes/${PG}/instalments`, { no: 'VIII', dueDate: `${YEAR + 1}-01-10`, parts: [P(H.tuition, T), P(H.tuition, T)] }, principal);
  check('re-adding the instalment pushes it back to every ledger', r.status === 201 && r.data.sync.students >= 1, { status: r.status, sync: r.data.sync, msg: r.data.message });
  r = await GET(`/students/${s1._id}`, principal);
  check('the re-added instalment is back on the student ledger', r.data.ledger.some((l) => l.instNo === 'VIII' && l.gross === 5500), r.data.ledger.map((l) => l.instNo));

  const instV = (await GET(`/classes/${PG}`, principal)).data.class.plan.find((p) => p.no === 'V');
  r = await PATCH(`/classes/${PG}/instalments/${instV._id}`, { no: 'V', dueDate: `${YEAR}-09-10`, parts: [P(H.tuition, T), P(H.tuition, T), P(H.annual, 3500)] }, principal);
  check('re-pricing an unpaid instalment updates ledgers', r.status === 200 && r.data.sync.students >= 1, r.data.sync);
  r = await GET(`/students/${s1._id}`, principal);
  eq('the student ledger shows the new amount', r.data.ledger.find((l) => l.instNo === 'V').gross, 9000);

  r = await DEL(`/classes/${PG}`, principal);
  check('a class with students cannot be deleted', r.status === 409 && /enrolled/.test(r.data.message), r.data);

  r = await DEL(`/fee-heads/${H.tuition}`, principal);
  check('a fee head in use cannot be deleted', r.status === 409, r.data);

  r = await POST(`/classes/${PG}/instalments`, { no: 'IX', dueDate: `${YEAR + 1}-02-10`, parts: [P(H.tuition, T)] }, accountant);
  check('accountant cannot edit the fee master', r.status === 403, r.data);

  /* ------------------------------------------------------- class-teacher scope */
  group('9. Class-teacher scope');
  r = await GET('/students', teacher);
  check('teacher sees only her own class', r.data.students.length === 2 && r.data.students.every((x) => x.classId._id === PG), r.data.students.map((x) => x.name));

  r = await GET(`/students/${s3._id}`, teacher);
  check('teacher cannot open a student of another class', r.status === 403, r.data);

  r = await GET(`/students/${s1._id}`, teacher);
  check('teacher can open her own student', r.status === 200, r.data);

  r = await GET('/reports/monthly-due', teacher);
  check('teacher cannot open reports', r.status === 403, r.data);

  r = await GET('/dashboard', teacher);
  eq('teacher dashboard counts only her class', r.data.students, 2);

  /* --------------------------------------------------------------- day book */
  group('10. Day book and expenses');
  r = await POST('/expenses', { date: `${YEAR}-04-03`, head: 'Staff Salary', particulars: 'April salary – 9 staff', amount: 198000, mode: 'Bank Transfer' }, accountant);
  check('accountant records an expense voucher', r.status === 201 && r.data.expense.voucherNo === 'V00001', r.data);
  const voucher = r.data.expense._id;

  r = await POST('/expenses', { date: `${YEAR}-04-03`, head: 'Rent', amount: 0, mode: 'Cash' }, accountant);
  check('a zero-amount voucher is refused', r.status === 422, r.data);

  r = await POST('/expenses', { date: `${YEAR}-04-03`, head: 'Rent', amount: 100, mode: 'Cash' }, frontdesk);
  check('front desk cannot record expenses', r.status === 403, r.data);

  r = await GET(`/expenses?month=${YEAR}-04`, accountant);
  check('day book shows income and outgo for the month', r.data.outgo === 198000 && r.data.income > 0 && r.data.net === r.data.income - r.data.outgo, { in: r.data.income, out: r.data.outgo });

  r = await DEL(`/expenses/${voucher}`, accountant);
  check('voucher deleted', r.status === 200, r.data);

  /* ---------------------------------------------------------------- reports */
  group('11. Reports');
  r = await GET(`/reports/monthly-due?month=${YEAR}-09`, principal);
  check('monthly due report returns rows with a total', r.status === 200 && r.data.rows.length > 0 && r.data.total > 0, { rows: r.data.rows.length, total: r.data.total });
  check('monthly due rows carry the parent contact', Boolean(r.data.rows[0].phone && r.data.rows[0].father), r.data.rows[0]);

  r = await GET(`/reports/monthly-due?month=${YEAR}-06`, principal);
  eq('a month with no instalment returns nothing', r.data.rows.length, 0);

  r = await GET('/reports/monthly-due?month=nonsense', principal);
  check('a malformed month is refused', r.status === 422, r.data);

  r = await GET('/reports/daily-collection', principal);
  check('daily collection groups by date with a mode breakup', r.data.rows.length >= 2 && Object.keys(r.data.rows[0].modes).length >= 1, r.data.rows);

  r = await GET(`/reports/daily-collection?from=${YEAR}-04-01&to=${YEAR}-04-30`, principal);
  check('daily collection honours the date range', r.data.rows.every((x) => x.date.startsWith(`${YEAR}-04`)), r.data.rows.map((x) => x.date));

  r = await GET('/reports/carry-forward', principal);
  check('carry forward report lists the C/F balance', r.data.rows.length === 1 && r.data.rows[0].amount === 4200, r.data.rows);

  r = await GET(`/reports/monthly-due?month=${YEAR}-09&classId=${NUR}`, principal);
  check('reports filter by class', r.data.rows.every((x) => x.className === 'Nursery'), r.data.rows.map((x) => x.className));

  /* -------------------------------------------------------------- dashboard */
  group('12. Dashboard');
  r = await GET('/dashboard', principal);
  const d = r.data;
  eq('dashboard student count', d.students, 3);
  check('dashboard totals are consistent', d.totals.netDemand === d.totals.gross - d.totals.discount, d.totals);
  check('dashboard collected + outstanding = net demand', Math.abs((d.totals.paid + d.totals.outstanding) - d.totals.netDemand) < 1, d.totals);
  eq('six-month series', d.series.length, 6);
  check('instalment progress is listed', d.instalments.length >= 8, d.instalments.length);
  check('class rows carry names', d.classRows.every((c) => c.name && c.name !== '—'), d.classRows);
  check('defaulters are ranked by overdue amount', d.defaulters.length === 0 || d.defaulters[0].overdue >= (d.defaulters[1]?.overdue ?? 0), d.defaulters);

  /* --------------------------------------------------------------- settings */
  group('13. Settings, logo and audit');
  r = await PATCH('/settings', { name: 'The Pride and Joy Preschool', lateFeeAmount: 250 }, principal);
  eq('settings saved', r.data.school.lateFeeAmount, 250);
  await PATCH('/settings', { lateFeeAmount: 200 }, principal);

  r = await PATCH('/settings', { name: 'Hijacked' }, accountant);
  check('accountant cannot change settings', r.status === 403, r.data);

  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  r = await PUT('/settings/logo', { logo: png }, principal);
  check('logo uploaded', r.status === 200 && r.data.logo.startsWith('data:image/png'), r.data.message);

  r = await PUT('/settings/logo', { logo: 'https://example.com/logo.png' }, principal);
  check('a non-image logo payload is refused', r.status === 422, r.data);

  r = await GET('/settings', principal);
  check('the receipt now carries the logo', r.data.school.logo.startsWith('data:image/png'), null);

  r = await PUT('/settings/logo', { logo: '' }, principal);
  check('logo removed', r.status === 200 && r.data.logo === '', r.data.message);

  r = await GET('/audit', principal);
  check('the audit trail records money actions', r.data.logs.some((l) => l.action === 'receipt.create') && r.data.logs.some((l) => l.action === 'receipt.cancel'), r.data.logs.slice(0, 3).map((l) => l.action));

  /* ------------------------------------------------------------ misc guards */
  group('14. Guards and error handling');
  r = await GET('/students');
  check('no token is refused', r.status === 401, r.data);

  r = await GET('/students', 'not-a-real-token');
  check('a bad token is refused', r.status === 401, r.data);

  r = await GET('/students/64b7f9f9f9f9f9f9f9f9f9f9', principal);
  check('a missing student returns 404', r.status === 404, r.data);

  r = await GET('/students/not-an-id', principal);
  check('a malformed id returns a clear 400', r.status === 400, r.data);

  r = await GET('/no-such-route', principal);
  check('an unknown route returns 404', r.status === 404, r.data);

  r = await PATCH(`/users/${(await GET('/users', principal)).data.users.find((u) => u.role === 'accountant').id}`, { active: false }, principal);
  check('a user can be deactivated', r.status === 200 && r.data.user.active === false, r.data);
  r = await POST('/auth/login', { email: 'accounts@prideandjoy.in', password: 'Passw0rd!23' });
  check('a deactivated user cannot sign in', r.status === 403, r.data);

  /* ----------------------------------------------------------------- report */
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m   ${failed ? `\x1b[31m${failed} failed\x1b[0m` : '0 failed'}   of ${passed + failed} checks`);
  if (failed) { console.log('\n  Failed:'); failures.forEach((f) => console.log(`   • ${f}`)); }
  console.log(`${'─'.repeat(60)}\n`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect().catch(() => {}); process.exit(1); });
