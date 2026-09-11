import mongoose from 'mongoose';
import Ledger from '../models/Ledger.js';
import Student from '../models/Student.js';
import Receipt from '../models/Receipt.js';
import Concession from '../models/Concession.js';
import School from '../models/School.js';
import Counter from '../models/Counter.js';
import { asyncHandler, ApiError, audit, nextSeq, pad, balanceOf, lateFeeFor, amountInWords } from '../utils/helpers.js';
import { assertClassScope } from '../middleware/auth.js';
import { withTransaction } from '../config/db.js';

/** GET /api/fee/pending/:studentId — what can be collected today, with suggested late fee and previous receipts. */
export const pending = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.studentId).populate('classId', 'name code');
  if (!student) throw new ApiError(404, 'Student not found.');
  assertClassScope(req, student.classId._id);

  const school = await School.current();
  const payDate = req.query.date ? new Date(req.query.date) : new Date();
  const [rows, receipts, counter] = await Promise.all([
    Ledger.find({ student: student._id }).sort('order dueDate'),
    Receipt.find({ student: student._id }).populate('collectedBy', 'name').sort('-date -seq').lean(),
    Counter.findOne({ key: 'receipt' }).lean(),
  ]);

  const seq = (counter?.seq || 0) + 1;
  const nextReceiptNo = `${school.receiptPrefix}${pad(seq, 4)}`;

  res.json({
    ok: true,
    student,
    school,
    receipts,
    nextReceiptNo,
    maxDiscount: req.role.maxDiscount === Infinity ? null : req.role.maxDiscount,
    rows: rows.map((l) => {
      const bal = balanceOf(l);
      const due = new Date(l.dueDate);
      const pDate = new Date(payDate);
      const dDue = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
      const dPay = Date.UTC(pDate.getUTCFullYear(), pDate.getUTCMonth(), pDate.getUTCDate());
      const daysLate = Math.max(0, Math.floor((dPay - dDue) / (24 * 60 * 60 * 1000)));
      return {
        ...l.toJSON(),
        balance: bal,
        daysLate,
        suggestedLateFee: bal > 0 ? Math.max(0, lateFeeFor(l, payDate, school) - (l.lateFee || 0)) : 0,
      };
    }),
  });
});

/**
 * POST /api/fee/collect
 * body: { studentId, date, mode, refNo, remarks, lines:[{ledgerId, discount, discountReason, lateFee, payingAmount}] }
 */
export const collect = asyncHandler(async (req, res) => {
  const { studentId, date, mode, refNo = '', remarks = '', lines = [] } = req.body;
  if (!lines.length) throw new ApiError(422, 'Select at least one instalment to collect.');

  const student = await Student.findById(studentId).populate('classId', 'name code');
  if (!student) throw new ApiError(404, 'Student not found.');
  assertClassScope(req, student.classId._id);

  const school = await School.current();
  const payDate = date ? new Date(date) : new Date();
  if (Number.isNaN(payDate.getTime())) throw new ApiError(422, 'Enter a valid payment date.');

  const limit = req.role.maxDiscount;
  const ids = lines.map((l) => l.ledgerId);
  const rows = await Ledger.find({ _id: { $in: ids }, student: student._id });
  if (rows.length !== lines.length) throw new ApiError(422, 'One of the selected instalments no longer exists.');

  // If any selected instalment is already cleared, throw 409
  for (const line of lines) {
    const row = rows.find((r) => String(r._id) === String(line.ledgerId));
    if (balanceOf(row) <= 0) {
      throw new ApiError(409, `Instalment ${row.instNo} is already cleared.`);
    }
  }

  // Sequential enforcement: ensure pending instalments are collected in order without skipping
  const allLedger = await Ledger.find({ student: student._id }).sort('order dueDate');
  const allPending = allLedger.filter((l) => balanceOf(l) > 0);
  if (!allPending.length) throw new ApiError(422, 'There are no pending instalments for this student.');

  if (String(lines[0].ledgerId) !== String(allPending[0]._id)) {
    throw new ApiError(422, `Previous pending instalment ${allPending[0].instNo} (${allPending[0].month}) must be collected first.`);
  }
  for (let i = 1; i < lines.length; i++) {
    if (String(lines[i].ledgerId) !== String(allPending[i]._id)) {
      throw new ApiError(422, 'Instalments must be collected in strict sequential order.');
    }
  }

  const prepared = lines.map((line) => {
    const row = rows.find((r) => String(r._id) === String(line.ledgerId));
    const balance = balanceOf(row);
    if (balance <= 0) throw new ApiError(409, `Instalment ${row.instNo} is already cleared.`);
    const discount = Math.max(0, Math.round(Number(line.discount) || 0));
    const lateFee = Math.max(0, Math.round(Number(line.lateFee) || 0));
    if (discount > balance) throw new ApiError(422, `The concession on instalment ${row.instNo} is more than its balance.`);
    if (discount > limit) {
      throw new ApiError(403, limit === 0
        ? 'Your role cannot apply a concession.'
        : `Your concession limit is ${limit}. Instalment ${row.instNo} needs the Principal's approval.`);
    }
    if (discount > 0 && !String(line.discountReason || '').trim()) {
      throw new ApiError(422, `Select a reason for the concession on instalment ${row.instNo}.`);
    }

    const fullNet = Math.max(0, balance - discount + lateFee);
    const paying = line.payingAmount !== undefined && line.payingAmount !== null
      ? Math.max(0, Math.round(Number(line.payingAmount)))
      : fullNet;

    if (paying > fullNet) {
      throw new ApiError(422, `Payment amount cannot exceed ${fullNet} for instalment ${row.instNo}.`);
    }
    if (paying <= 0 && discount <= 0) {
      throw new ApiError(422, `Payment amount on instalment ${row.instNo} must be greater than zero.`);
    }
    if (row.paid > 0 && paying < fullNet) {
      throw new ApiError(422, `Instalment ${row.instNo} has already been partially paid. The remaining balance must be paid in full.`);
    }

    const balanceRemaining = fullNet - paying;
    if (balanceRemaining > 0 && lines.length > 1) {
      throw new ApiError(422, `Cannot collect subsequent instalments until instalment ${row.instNo} is fully cleared.`);
    }

    return {
      row,
      discount,
      lateFee,
      reason: String(line.discountReason || '').trim(),
      net: paying,
      balance,
      balanceRemaining,
    };
  });

  const total = prepared.reduce((s, p) => s + p.net, 0);
  const waived = prepared.reduce((s, p) => s + p.discount, 0);
  // A full waiver is a valid receipt for ₹0; a receipt with neither money nor concession is not.
  if (total <= 0 && waived <= 0) throw new ApiError(422, 'The receipt total cannot be zero.');

  const receipt = await withTransaction(async (session) => {
    const seq = await nextSeq('receipt', session);
    const receiptNo = `${school.receiptPrefix}${pad(seq, 4)}`;
    const [doc] = await Receipt.create([{
      receiptNo,
      seq,
      date: payDate,
      student: student._id,
      classId: student.classId._id,
      lines: prepared.map((p) => ({
        ledger: p.row._id, instNo: p.row.instNo, month: p.row.month,
        gross: p.balance, discount: p.discount, reason: p.reason, lateFee: p.lateFee, net: p.net,
        balanceRemaining: p.balanceRemaining,
      })),
      gross: prepared.reduce((s, p) => s + p.balance, 0),
      discount: prepared.reduce((s, p) => s + p.discount, 0),
      lateFee: prepared.reduce((s, p) => s + p.lateFee, 0),
      total,
      mode,
      refNo,
      remarks,
      collectedBy: req.user._id,
    }], { session });

    await Promise.all(prepared.map((p) => Ledger.updateOne(
      { _id: p.row._id },
      {
        $inc: { discount: p.discount, lateFee: p.lateFee, paid: p.net },
        $set: { paidOn: payDate, receipt: doc._id, ...(p.reason ? { discountReason: p.reason } : {}) },
      },
      { session },
    )));

    const conc = prepared.filter((p) => p.discount > 0).map((p) => ({
      student: student._id, classId: student.classId._id, ledger: p.row._id, instNo: p.row.instNo,
      amount: p.discount, reason: p.reason, approvedBy: req.user._id, receipt: doc._id, date: payDate,
    }));
    if (conc.length) await Concession.insertMany(conc, { session });

    return doc;
  });

  await audit(req, 'receipt.create', 'Receipt', receipt._id, { receiptNo: receipt.receiptNo, total });
  const full = await Receipt.findById(receipt._id)
    .populate('student', 'name admissionNo father section')
    .populate('classId', 'name')
    .populate('collectedBy', 'name');
  res.status(201).json({ ok: true, receipt: full, amountInWords: amountInWords(total), school });
});

/** GET /api/fee/next-receipt-no — gets the next sequential receipt number */
export const getNextReceiptNo = asyncHandler(async (_req, res) => {
  const school = await School.current();
  const counter = await Counter.findOne({ key: 'receipt' }).lean();
  const seq = (counter?.seq || 0) + 1;
  const nextReceiptNo = `${school.receiptPrefix}${pad(seq, 4)}`;
  res.json({ ok: true, nextReceiptNo, seq });
});

/**
 * POST /api/fee/collect-misc — collects miscellaneous / other student fee
 * body: { studentId, amount, head, date, mode, refNo, remarks }
 */
export const collectMisc = asyncHandler(async (req, res) => {
  const { studentId, amount, head, date, mode, refNo = '', remarks = '' } = req.body;
  const numAmount = Number(amount);

  if (!studentId) throw new ApiError(422, 'Select a student.');
  if (!numAmount || numAmount <= 0) throw new ApiError(422, 'Enter an amount greater than zero.');
  if (!head || !String(head).trim()) throw new ApiError(422, 'Enter the fee purpose / head (kis baat ki fee hai).');
  if (!mode || !String(mode).trim()) throw new ApiError(422, 'Choose a payment mode.');

  const student = await Student.findById(studentId).populate('classId', 'name code');
  if (!student) throw new ApiError(404, 'Student not found.');
  assertClassScope(req, student.classId._id);

  const school = await School.current();
  const payDate = date ? new Date(date) : new Date();
  if (Number.isNaN(payDate.getTime())) throw new ApiError(422, 'Enter a valid payment date.');

  const receipt = await withTransaction(async (session) => {
    const seq = await nextSeq('receipt', session);
    const receiptNo = `${school.receiptPrefix}${pad(seq, 4)}`;

    const [doc] = await Receipt.create([{
      receiptNo,
      seq,
      date: payDate,
      student: student._id,
      classId: student.classId._id,
      type: 'misc',
      miscHead: String(head).trim(),
      lines: [{
        head: String(head).trim(),
        gross: numAmount,
        discount: 0,
        lateFee: 0,
        net: numAmount,
        reason: String(remarks || '').trim(),
      }],
      gross: numAmount,
      discount: 0,
      lateFee: 0,
      total: numAmount,
      mode,
      refNo: String(refNo || '').trim(),
      remarks: String(remarks || '').trim(),
      collectedBy: req.user._id,
    }], { session });

    return doc;
  });

  await audit(req, 'receipt.create_misc', 'Receipt', receipt._id, {
    receiptNo: receipt.receiptNo,
    student: student.name,
    admissionNo: student.admissionNo,
    head: String(head).trim(),
    total: numAmount,
  });

  const full = await Receipt.findById(receipt._id)
    .populate('student', 'name admissionNo father section')
    .populate('classId', 'name')
    .populate('collectedBy', 'name');

  res.status(201).json({ ok: true, receipt: full, amountInWords: amountInWords(numAmount), school });
});

