import Expense from '../models/Expense.js';
import Receipt from '../models/Receipt.js';
import { asyncHandler, ApiError, audit, nextSeq, pad, startOfMonth, endOfMonth, monthKey } from '../utils/helpers.js';

/** GET /api/expenses?month=2026-09 — day book: fee in, expenses out. */
export const dayBook = asyncHandler(async (req, res) => {
  const month = req.query.month || monthKey(new Date());
  const range = { $gte: startOfMonth(month), $lte: endOfMonth(month) };

  const [expenses, receipts] = await Promise.all([
    Expense.find({ date: range }).populate('createdBy', 'name').sort('date'),
    Receipt.find({ date: range, 'cancelled.at': null }).populate('student', 'name').sort('date'),
  ]);

  const income = receipts.reduce((s, r) => s + r.total, 0);
  const outgo = expenses.reduce((s, e) => s + e.amount, 0);
  res.json({ ok: true, month, expenses, receipts, income, outgo, net: income - outgo });
});

export const create = asyncHandler(async (req, res) => {
  const { date, head, particulars, amount, mode } = req.body;
  const seq = await nextSeq('voucher');
  const expense = await Expense.create({
    voucherNo: `V${pad(seq, 5)}`,
    date: new Date(date), head, particulars, amount: Math.round(Number(amount)), mode,
    createdBy: req.user._id,
  });
  await audit(req, 'expense.create', 'Expense', expense._id, { amount: expense.amount, head });
  res.status(201).json({ ok: true, expense });
});

export const remove = asyncHandler(async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) throw new ApiError(404, 'Voucher not found.');
  await audit(req, 'expense.delete', 'Expense', req.params.id, { voucherNo: expense.voucherNo });
  res.json({ ok: true, message: `Voucher ${expense.voucherNo} deleted.` });
});
