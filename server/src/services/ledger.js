import Ledger from '../models/Ledger.js';
import Student from '../models/Student.js';
import { instTotal } from '../utils/helpers.js';

/** Builds the ledger rows for one freshly admitted student. */
export async function createLedgerForStudent(student, klass, concessions = {}) {
  const rows = [];
  if (student.carryForward > 0) {
    rows.push({
      student: student._id, classId: klass._id, instNo: 'C/F', month: 'Carry forward',
      dueDate: klass.plan[0]?.dueDate || student.admissionDate,
      gross: student.carryForward, isCarryForward: true, order: -1,
    });
  }
  klass.plan.forEach((inst, i) => {
    const discount = Number(concessions[inst.no] || 0);
    rows.push({
      student: student._id, classId: klass._id, instNo: inst.no, month: inst.month,
      dueDate: inst.dueDate, gross: instTotal(inst),
      discount: Math.min(discount, instTotal(inst)), order: i,
    });
  });
  if (!rows.length) return [];
  return Ledger.insertMany(rows);
}

/**
 * Pushes a changed fee plan onto every student of that class.
 * Paid rows are never touched; unpaid rows are re-priced; removed
 * instalments disappear; new ones are appended.
 */
export async function syncClassLedgers(klass) {
  const students = await Student.find({ classId: klass._id }).select('_id');
  if (!students.length) return { students: 0, rows: 0 };

  const ids = students.map((s) => s._id);
  const planByNo = new Map(klass.plan.map((p, i) => [p.no, { ...p.toObject?.() ?? p, index: i }]));
  const existing = await Ledger.find({ student: { $in: ids } });

  const ops = [];
  let changed = 0;
  const touchedStudents = new Set();

  for (const row of existing) {
    if (row.isCarryForward) continue;
    const inst = planByNo.get(row.instNo);
    if (!inst) {
      if (row.paid === 0) {
        ops.push({ deleteOne: { filter: { _id: row._id } } });
        changed += 1; touchedStudents.add(String(row.student));
      }
      continue;
    }
    const gross = instTotal(inst);
    if (row.paid === 0 && (row.gross !== gross || row.month !== inst.month
        || String(row.dueDate) !== String(inst.dueDate) || row.order !== inst.index)) {
      ops.push({ updateOne: { filter: { _id: row._id },
        update: { $set: { gross, month: inst.month, dueDate: inst.dueDate, order: inst.index } } } });
      changed += 1; touchedStudents.add(String(row.student));
    }
  }

  const have = new Map();
  existing.forEach((r) => have.set(`${r.student}|${r.instNo}`, true));
  for (const sid of ids) {
    klass.plan.forEach((inst, i) => {
      if (have.get(`${sid}|${inst.no}`)) return;
      ops.push({ insertOne: { document: {
        student: sid, classId: klass._id, instNo: inst.no, month: inst.month,
        dueDate: inst.dueDate, gross: instTotal(inst), order: i,
      } } });
      changed += 1; touchedStudents.add(String(sid));
    });
  }

  if (ops.length) await Ledger.bulkWrite(ops, { ordered: false });
  return { students: touchedStudents.size, rows: changed };
}

/** How many students have already paid something against an instalment. */
export const paidCount = (classId, instNo) =>
  Ledger.countDocuments({ classId, instNo, paid: { $gt: 0 } });
