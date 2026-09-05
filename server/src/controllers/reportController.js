import Ledger from '../models/Ledger.js';
import Receipt from '../models/Receipt.js';
import School from '../models/School.js';
import { asyncHandler, ApiError, startOfMonth, endOfMonth, dayRange, balanceOf, monthKey } from '../utils/helpers.js';

const scopeFilter = (req) => (req.scopeClass ? { classId: req.scopeClass } : (req.query.classId ? { classId: req.query.classId } : {}));

/** GET /api/reports/monthly-due?month=2026-09&classId= */
export const monthlyDue = asyncHandler(async (req, res) => {
  const month = req.query.month || monthKey(new Date());
  const rows = await Ledger.find({
    ...scopeFilter(req),
    dueDate: { $gte: startOfMonth(month), $lte: endOfMonth(month) },
  })
    .populate('student', 'name admissionNo father phone')
    .populate('classId', 'name')
    .sort('dueDate');

  const due = rows.filter((r) => balanceOf(r) > 0);
  const school = await School.current();
  res.json({
    ok: true,
    month,
    note: `${school.feeWindow} fee window${school.lateFeeAmount ? ` · ${school.lateFeeAmount} late fee after the ${school.lateFeeFrom}th` : ''}`,
    rows: due.map((r) => ({
      admissionNo: r.student?.admissionNo, student: r.student?.name, className: r.classId?.name,
      father: r.student?.father, phone: r.student?.phone, instNo: r.instNo, dueDate: r.dueDate,
      balance: balanceOf(r), studentId: r.student?._id,
    })),
    total: due.reduce((s, r) => s + balanceOf(r), 0),
  });
});

/** GET /api/reports/daily-collection?from=&to= */
export const dailyCollection = asyncHandler(async (req, res) => {
  const filter = { 'cancelled.at': null, ...scopeFilter(req) };
  const range = dayRange(req.query.from, req.query.to);
  if (range) filter.date = range;

  const receipts = await Receipt.find(filter).sort('-date');
  const byDay = new Map();
  receipts.forEach((r) => {
    const key = r.date.toISOString().slice(0, 10);
    const d = byDay.get(key) || { date: key, receipts: 0, gross: 0, discount: 0, lateFee: 0, total: 0, modes: {} };
    d.receipts += 1; d.gross += r.gross; d.discount += r.discount; d.lateFee += r.lateFee; d.total += r.total;
    d.modes[r.mode] = (d.modes[r.mode] || 0) + r.total;
    byDay.set(key, d);
  });
  const rows = [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));
  res.json({ ok: true, rows, total: rows.reduce((s, r) => s + r.total, 0) });
});

/** GET /api/reports/carry-forward */
export const carryForward = asyncHandler(async (req, res) => {
  const rows = await Ledger.find({ ...scopeFilter(req), isCarryForward: true })
    .populate('student', 'name admissionNo father phone')
    .populate('classId', 'name')
    .sort('-gross');
  res.json({
    ok: true,
    note: 'Balance brought forward from the previous session — first priority this session.',
    rows: rows.map((r) => ({
      admissionNo: r.student?.admissionNo, student: r.student?.name, className: r.classId?.name,
      father: r.student?.father, phone: r.student?.phone,
      amount: r.gross, recovered: r.paid, pending: balanceOf(r), studentId: r.student?._id,
    })),
    total: rows.reduce((s, r) => s + balanceOf(r), 0),
  });
});

export const runReport = asyncHandler(async (req, res, next) => {
  const map = { 'monthly-due': monthlyDue, 'daily-collection': dailyCollection, 'carry-forward': carryForward };
  const fn = map[req.params.key];
  if (!fn) return next(new ApiError(404, 'That report does not exist.'));
  return fn(req, res, next);
});
