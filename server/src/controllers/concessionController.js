import Concession from '../models/Concession.js';
import Student from '../models/Student.js';
import Ledger from '../models/Ledger.js';
import { asyncHandler, ApiError, audit, dayRange, balanceOf } from '../utils/helpers.js';
import { withTransaction } from '../config/db.js';

/** GET /api/concessions — lists concessions register */
export const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.scopeClass) filter.classId = req.scopeClass;
  if (req.query.classId) filter.classId = req.query.classId;
  const range = dayRange(req.query.from, req.query.to);
  if (range) filter.date = range;

  const rows = await Concession.find(filter)
    .populate('student', 'name admissionNo phone father rollNo photo')
    .populate('classId', 'name code')
    .populate('approvedBy', 'name email role')
    .populate('receipt', 'receiptNo')
    .populate('ledger', 'instNo month gross discount paid')
    .sort('-date -createdAt');

  const byReason = {};
  let total = 0;
  rows.forEach((r) => {
    total += r.amount;
    byReason[r.reason] = (byReason[r.reason] || 0) + r.amount;
  });

  res.json({
    ok: true,
    concessions: rows,
    total,
    byReason,
    students: new Set(rows.map((r) => String(r.student?._id))).size,
  });
});

/** POST /api/concessions — creates a new concession and adjusts the student ledger */
export const create = asyncHandler(async (req, res) => {
  const { studentId, ledgerId, instNo, amount, reason, date } = req.body;
  const numAmount = Number(amount);

  if (!studentId) throw new ApiError(422, 'Please select a student.');
  if (!numAmount || numAmount <= 0) throw new ApiError(422, 'Enter a valid concession amount greater than 0.');
  if (!reason || !String(reason).trim()) throw new ApiError(422, 'Please provide a reason for the concession.');

  // Check role limits
  const maxAllowed = req.role?.maxDiscount ?? 0;
  if (maxAllowed !== Infinity && numAmount > maxAllowed) {
    throw new ApiError(422, maxAllowed === 0
      ? 'Your role cannot grant concessions.'
      : `Your concession limit is ₹${maxAllowed}. Amounts above this require Principal approval.`);
  }

  const student = await Student.findById(studentId);
  if (!student) throw new ApiError(404, 'Student not found.');

  // Locate target ledger instalment
  let targetLedger;
  if (ledgerId) {
    targetLedger = await Ledger.findOne({ _id: ledgerId, student: student._id });
  } else if (instNo) {
    targetLedger = await Ledger.findOne({ student: student._id, instNo });
  } else {
    // Pick the earliest instalment with balance
    const ledgers = await Ledger.find({ student: student._id }).sort('order dueDate');
    targetLedger = ledgers.find((l) => balanceOf(l) > 0) || ledgers[0];
  }

  if (!targetLedger) throw new ApiError(404, 'No ledger instalment found for this student.');

  // Ensure concession does not exceed remaining instalment balance
  const currentBal = balanceOf(targetLedger);
  if (numAmount > currentBal) {
    throw new ApiError(422, `Concession (₹${numAmount}) cannot exceed the remaining balance of ₹${currentBal} on Instalment ${targetLedger.instNo}.`);
  }

  let createdConcession;
  await withTransaction(async (session) => {
    const [c] = await Concession.create([{
      student: student._id,
      classId: student.classId,
      ledger: targetLedger._id,
      instNo: targetLedger.instNo,
      amount: numAmount,
      reason: String(reason).trim(),
      approvedBy: req.user._id,
      receipt: null,
      date: date ? new Date(date) : new Date(),
    }], { session });
    createdConcession = c;

    await Ledger.updateOne(
      { _id: targetLedger._id },
      {
        $inc: { discount: numAmount },
        $set: { discountReason: String(reason).trim() },
      },
      { session }
    );
  });

  await audit(req, 'concession.create', 'Concession', createdConcession._id, {
    student: student.name,
    admissionNo: student.admissionNo,
    instNo: targetLedger.instNo,
    amount: numAmount,
    reason,
  });

  const populated = await Concession.findById(createdConcession._id)
    .populate('student', 'name admissionNo phone father rollNo')
    .populate('classId', 'name code')
    .populate('approvedBy', 'name email')
    .populate('ledger', 'instNo month gross discount paid');

  res.status(201).json({ ok: true, concession: populated, message: 'Concession created successfully.' });
});

/** PATCH /api/concessions/:id — edits an existing concession */
export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, reason, date } = req.body;

  const concession = await Concession.findById(id);
  if (!concession) throw new ApiError(404, 'Concession not found.');

  const oldAmount = concession.amount;
  const newAmount = amount !== undefined ? Number(amount) : oldAmount;
  if (isNaN(newAmount) || newAmount <= 0) {
    throw new ApiError(422, 'Enter a valid concession amount greater than 0.');
  }

  // Check role limit if amount is increasing
  const maxAllowed = req.role?.maxDiscount ?? 0;
  if (maxAllowed !== Infinity && newAmount > maxAllowed) {
    throw new ApiError(422, `Your concession limit is ₹${maxAllowed}. Amounts above this require Principal approval.`);
  }

  const delta = newAmount - oldAmount;

  await withTransaction(async (session) => {
    if (concession.ledger && delta !== 0) {
      const ledger = await Ledger.findById(concession.ledger).session(session);
      if (ledger) {
        if (delta > 0) {
          const currentBal = balanceOf(ledger);
          if (delta > currentBal) {
            throw new ApiError(422, `Increasing concession by ₹${delta} exceeds remaining instalment balance of ₹${currentBal}.`);
          }
        }
        await Ledger.updateOne(
          { _id: ledger._id },
          {
            $inc: { discount: delta },
            ...(reason ? { $set: { discountReason: String(reason).trim() } } : {}),
          },
          { session }
        );
      }
    }

    if (amount !== undefined) concession.amount = newAmount;
    if (reason !== undefined) concession.reason = String(reason).trim();
    if (date !== undefined) concession.date = new Date(date);

    await concession.save({ session });
  });

  await audit(req, 'concession.update', 'Concession', concession._id, {
    oldAmount,
    newAmount,
    reason: concession.reason,
  });

  const updated = await Concession.findById(concession._id)
    .populate('student', 'name admissionNo phone father rollNo')
    .populate('classId', 'name code')
    .populate('approvedBy', 'name email')
    .populate('receipt', 'receiptNo')
    .populate('ledger', 'instNo month gross discount paid');

  res.json({ ok: true, concession: updated, message: 'Concession updated successfully.' });
});

/** DELETE /api/concessions/:id — deletes a concession and reverts ledger discount */
export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const concession = await Concession.findById(id);
  if (!concession) throw new ApiError(404, 'Concession not found.');

  await withTransaction(async (session) => {
    if (concession.ledger) {
      await Ledger.updateOne(
        { _id: concession.ledger },
        {
          $inc: { discount: -concession.amount },
        },
        { session }
      );
    }
    await Concession.findByIdAndDelete(id, { session });
  });

  await audit(req, 'concession.delete', 'Concession', concession._id, {
    amount: concession.amount,
    reason: concession.reason,
    instNo: concession.instNo,
  });

  res.json({ ok: true, message: `Concession of ₹${concession.amount} deleted successfully.` });
});
