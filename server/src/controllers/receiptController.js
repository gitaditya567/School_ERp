import Receipt from '../models/Receipt.js';
import Ledger from '../models/Ledger.js';
import Concession from '../models/Concession.js';
import School from '../models/School.js';
import Counter from '../models/Counter.js';
import { asyncHandler, ApiError, audit, dayRange, amountInWords } from '../utils/helpers.js';
import { withTransaction } from '../config/db.js';

export const list = asyncHandler(async (req, res) => {
  const { from, to, mode, search = '', limit = 200 } = req.query;
  const filter = {};
  if (req.scopeClass) filter.classId = req.scopeClass;
  const range = dayRange(from, to);
  if (range) filter.date = range;
  if (mode) filter.mode = mode;
  if (search.trim()) filter.receiptNo = new RegExp(search.trim(), 'i');

  const receipts = await Receipt.find(filter)
    .populate('student', 'name admissionNo')
    .populate('classId', 'name')
    .populate('collectedBy', 'name')
    .sort('-date -seq').limit(Number(limit));

  const totals = receipts.reduce((t, r) => {
    if (r.cancelled?.at) return t;
    t.gross += r.gross; t.discount += r.discount; t.lateFee += r.lateFee; t.total += r.total; t.count += 1;
    t.byMode[r.mode] = (t.byMode[r.mode] || 0) + r.total;
    return t;
  }, { gross: 0, discount: 0, lateFee: 0, total: 0, count: 0, byMode: {} });

  const nextSeq = (await Counter.findOne({ key: 'receipt' }))?.seq || 0;
  const school = await School.current();
  res.json({ ok: true, receipts, totals, nextReceiptNo: `${school.receiptPrefix}${String(nextSeq + 1).padStart(4, '0')}` });
});

export const get = asyncHandler(async (req, res) => {
  const receipt = await Receipt.findById(req.params.id)
    .populate('student', 'name admissionNo father section phone')
    .populate('classId', 'name')
    .populate('collectedBy', 'name');
  if (!receipt) throw new ApiError(404, 'Receipt not found.');
  res.json({ ok: true, receipt, amountInWords: amountInWords(receipt.total), school: await School.current() });
});

/** POST /api/receipts/:id/cancel — reverses the ledger, keeps the number burnt. */
export const cancel = asyncHandler(async (req, res) => {
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 4) throw new ApiError(422, 'Give a reason for cancelling this receipt.');

  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) throw new ApiError(404, 'Receipt not found.');
  if (receipt.cancelled?.at) throw new ApiError(409, 'This receipt is already cancelled.');

  await withTransaction(async (session) => {
    await Promise.all(receipt.lines.map((line) => Ledger.updateOne(
      { _id: line.ledger },
      {
        $inc: { paid: -line.net, discount: -line.discount, lateFee: -line.lateFee },
        $set: { receipt: null, paidOn: null },
      },
      { session },
    )));
    await Concession.deleteMany({ receipt: receipt._id }, { session });
    receipt.cancelled = { at: new Date(), by: req.user._id, reason };
    await receipt.save({ session });
  });

  await audit(req, 'receipt.cancel', 'Receipt', receipt._id, { receiptNo: receipt.receiptNo, reason });
  res.json({ ok: true, message: `${receipt.receiptNo} cancelled. The number is retained in the register.` });
});

export const concessions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.scopeClass) filter.classId = req.scopeClass;
  if (req.query.classId) filter.classId = req.query.classId;
  const range = dayRange(req.query.from, req.query.to);
  if (range) filter.date = range;

  const rows = await Concession.find(filter)
    .populate('student', 'name admissionNo')
    .populate('classId', 'name')
    .populate('approvedBy', 'name')
    .populate('receipt', 'receiptNo')
    .sort('-date');

  const byReason = {};
  let total = 0;
  rows.forEach((r) => { total += r.amount; byReason[r.reason] = (byReason[r.reason] || 0) + r.amount; });
  res.json({ ok: true, concessions: rows, total, byReason, students: new Set(rows.map((r) => String(r.student?._id))).size });
});
