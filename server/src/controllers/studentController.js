import Student from '../models/Student.js';
import Class from '../models/Class.js';
import Ledger from '../models/Ledger.js';
import Receipt from '../models/Receipt.js';
import Concession from '../models/Concession.js';
import School from '../models/School.js';
import { asyncHandler, ApiError, audit, nextSeq, pad, balanceOf } from '../utils/helpers.js';
import { assertClassScope } from '../middleware/auth.js';
import { createLedgerForStudent } from '../services/ledger.js';
import { invalidateClassesCache } from './masterController.js';

const totalsFor = (rows) => {
  const t = { gross: 0, discount: 0, lateFee: 0, paid: 0, outstanding: 0, overdue: 0 };
  const now = new Date();
  rows.forEach((l) => {
    t.gross += l.gross; t.discount += l.discount; t.lateFee += l.lateFee; t.paid += l.paid;
    const bal = balanceOf(l);
    t.outstanding += bal;
    if (bal > 0 && new Date(l.dueDate) < new Date(now.getFullYear(), now.getMonth(), 1)) t.overdue += bal;
  });
  t.payable = t.gross - t.discount + t.lateFee;
  return t;
};

/** GET /api/students?search=&classId=&status=&page= */
export const list = asyncHandler(async (req, res) => {
  const { search = '', classId = '', status = '', page = 1, limit = 100 } = req.query;
  const filter = {};
  if (req.scopeClass) filter.classId = req.scopeClass;
  else if (classId) filter.classId = classId;
  if (search.trim()) {
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { admissionNo: rx }, { phone: rx }, { alternatePhone: rx }, { father: rx }];
  }

  const [docs, total] = await Promise.all([
    Student.find(filter).populate('classId', 'name code').sort('name')
      .skip((page - 1) * limit).limit(Number(limit)).lean(),
    Student.countDocuments(filter),
  ]);
  const ids = docs.map((d) => d._id);
  const rows = ids.length ? await Ledger.find({ student: { $in: ids } }).lean() : [];
  const byStudent = new Map();
  rows.forEach((r) => { const k = String(r.student); byStudent.set(k, [...(byStudent.get(k) || []), r]); });

  let students = docs.map((d) => ({ ...d, totals: totalsFor(byStudent.get(String(d._id)) || []) }));
  if (status === 'due') students = students.filter((s) => s.totals.outstanding > 0);
  if (status === 'overdue') students = students.filter((s) => s.totals.overdue > 0);
  if (status === 'clear') students = students.filter((s) => s.totals.outstanding === 0);

  res.json({ ok: true, students, total });
});

/** GET /api/students/:id — profile + ledger + receipts */
export const get = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('classId', 'name code').lean();
  if (!student) throw new ApiError(404, 'Student not found.');
  assertClassScope(req, student.classId._id);

  const [ledger, receipts] = await Promise.all([
    Ledger.find({ student: student._id }).sort('order dueDate').lean(),
    Receipt.find({ student: student._id }).sort('-date -seq').lean(),
  ]);
  res.json({
    ok: true,
    student,
    ledger: ledger.map((l) => ({ ...l, balance: balanceOf(l) })),
    receipts,
    totals: totalsFor(ledger),
  });
});

/** POST /api/students — admission */
export const create = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.body.classId);
  if (!klass) throw new ApiError(422, 'Choose a valid class.');
  if (!klass.plan.length) throw new ApiError(409, `${klass.name} has no fee plan yet. Add its instalments in Fee Master first.`);

  const school = await School.current();
  const year = new Date(req.body.admissionDate || Date.now()).getFullYear().toString().slice(-2);
  const seq = await nextSeq(`admission-${year}`);
  const admissionNo = `${(school.name || 'SCH').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}${year}${pad(seq, 4)}`;

  if (req.body.photo && req.body.photo.length > 400 * 1024) {
    throw new ApiError(413, 'Photo is too large — please use an image under 300 KB.');
  }

  const aadhaarLast4 = req.body.aadhaarLast4 || (req.body.childAadhaar ? req.body.childAadhaar.slice(-4) : '');

  const student = await Student.create({
    ...req.body,
    aadhaarLast4,
    admissionNo,
    carryForward: Math.max(0, Number(req.body.carryForward) || 0),
    createdBy: req.user._id,
  });

  const concessions = req.body.concessions || {};
  const rows = await createLedgerForStudent(student, klass, concessions);

  const reason = req.body.concessionReason || 'Admission concession';
  const given = rows.filter((r) => r.discount > 0);
  if (given.length) {
    await Concession.insertMany(given.map((r) => ({
      student: student._id, classId: klass._id, ledger: r._id, instNo: r.instNo,
      amount: r.discount, reason, approvedBy: req.user._id, date: student.admissionDate,
    })));
  }

  await audit(req, 'student.create', 'Student', student._id, { admissionNo, class: klass.name });
  invalidateClassesCache();
  res.status(201).json({ ok: true, student, ledgerRows: rows.length });
});

export const update = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw new ApiError(404, 'Student not found.');
  if (req.body.photo && req.body.photo.length > 400 * 1024) {
    throw new ApiError(413, 'Photo is too large — please use an image under 300 KB.');
  }
  const editable = ['name', 'dob', 'gender', 'section', 'status', 'bloodGroup',
    'father', 'mother', 'phone', 'alternatePhone', 'email', 'address', 'occupation',
    'aadhaarLast4', 'childAadhaar', 'fatherAadhaar', 'motherAadhaar', 'birthCertificateSubmitted', 'photo'];
  editable.forEach((k) => { if (req.body[k] !== undefined) student[k] = req.body[k]; });
  if (req.body.childAadhaar && !req.body.aadhaarLast4) {
    student.aadhaarLast4 = req.body.childAadhaar.slice(-4);
  }
  await student.save();
  await audit(req, 'student.update', 'Student', student._id);
  res.json({ ok: true, student });
});

/** DELETE /api/students/:id — only while nothing has been collected. */
export const remove = asyncHandler(async (req, res) => {
  const paid = await Ledger.countDocuments({ student: req.params.id, paid: { $gt: 0 } });
  if (paid) throw new ApiError(409, 'This student already has receipts. Change the status to “Left” instead of deleting.');
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) throw new ApiError(404, 'Student not found.');
  await Ledger.deleteMany({ student: student._id });
  await Concession.deleteMany({ student: student._id });
  invalidateClassesCache();
  await audit(req, 'student.delete', 'Student', req.params.id, { admissionNo: student.admissionNo });
  res.json({ ok: true, message: `${student.name} removed.` });
});
