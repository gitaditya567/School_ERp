import Ledger from '../models/Ledger.js';
import Student from '../models/Student.js';
import Receipt from '../models/Receipt.js';
import Expense from '../models/Expense.js';
import Concession from '../models/Concession.js';
import Class from '../models/Class.js';
import { asyncHandler, balanceOf, monthKey, startOfMonth, endOfMonth } from '../utils/helpers.js';

const lastMonths = (n) => {
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i -= 1) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  return out;
};

export const summary = asyncHandler(async (req, res) => {
  const scope = req.scopeClass ? { classId: req.scopeClass } : {};
  const months = lastMonths(6);
  const thisMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];

  const [ledger, students, classes, receipts, expenses, concessionCount] = await Promise.all([
    Ledger.find(scope).lean(),
    Student.countDocuments(scope),
    Class.find(req.scopeClass ? { _id: req.scopeClass } : {}).select('name').lean(),
    Receipt.find({
      ...scope, 'cancelled.at': null,
      date: { $gte: startOfMonth(months[0]), $lte: endOfMonth(thisMonth) },
    }).select('date total').lean(),
    req.scopeClass ? Promise.resolve([]) : Expense.find({
      date: { $gte: startOfMonth(months[0]), $lte: endOfMonth(thisMonth) },
    }).select('date amount').lean(),
    Concession.countDocuments(scope),
  ]);

  const totals = ledger.reduce((t, l) => {
    t.gross += l.gross; t.discount += l.discount; t.paid += l.paid;
    const bal = balanceOf(l);
    t.outstanding += bal;
    if (bal > 0 && new Date(l.dueDate) < startOfMonth(thisMonth)) t.overdue += bal;
    return t;
  }, { gross: 0, discount: 0, paid: 0, outstanding: 0, overdue: 0 });
  totals.netDemand = totals.gross - totals.discount;
  totals.collectedPct = totals.netDemand ? Math.round((totals.paid / totals.netDemand) * 100) : 0;

  // month series
  const series = months.map((m) => ({ month: m, collection: 0, expense: 0 }));
  const idx = Object.fromEntries(months.map((m, i) => [m, i]));
  receipts.forEach((r) => { const i = idx[monthKey(r.date)]; if (i != null) series[i].collection += r.total; });
  expenses.forEach((e) => { const i = idx[monthKey(e.date)]; if (i != null) series[i].expense += e.amount; });

  // instalment progress
  const instMap = new Map();
  ledger.forEach((l) => {
    const d = instMap.get(l.instNo) || { instNo: l.instNo, month: l.month, order: l.order, demand: 0, collected: 0, pending: 0 };
    d.demand += l.gross - l.discount; d.collected += l.paid;
    if (balanceOf(l) > 0) d.pending += 1;
    instMap.set(l.instNo, d);
  });
  const instalments = [...instMap.values()].sort((a, b) => a.order - b.order);

  // class-wise
  const byClass = new Map();
  ledger.forEach((l) => {
    const k = String(l.classId);
    const d = byClass.get(k) || { classId: k, demand: 0, collected: 0 };
    d.demand += l.gross - l.discount; d.collected += l.paid;
    byClass.set(k, d);
  });
  const classNames = Object.fromEntries(classes.map((c) => [String(c._id), c.name]));
  const classRows = [...byClass.values()].map((c) => ({ ...c, name: classNames[c.classId] || '—' }));

  // defaulters
  const perStudent = new Map();
  ledger.forEach((l) => {
    const bal = balanceOf(l);
    if (bal <= 0 || new Date(l.dueDate) >= startOfMonth(thisMonth)) return;
    const d = perStudent.get(String(l.student)) || { student: l.student, overdue: 0, count: 0 };
    d.overdue += bal; d.count += 1;
    perStudent.set(String(l.student), d);
  });
  const top = [...perStudent.values()].sort((a, b) => b.overdue - a.overdue).slice(0, 8);
  const docs = top.length ? await Student.find({ _id: { $in: top.map((t) => t.student) } })
    .populate('classId', 'name').select('name admissionNo classId').lean() : [];
  const defaulters = top.map((t) => {
    const s = docs.find((d) => String(d._id) === String(t.student));
    return { id: t.student, name: s?.name, admissionNo: s?.admissionNo, className: s?.classId?.name, overdue: t.overdue, instalments: t.count };
  });
  const collectionThis = series[series.length - 1].collection;
  const collectionPrev = series[series.length - 2]?.collection || 0;

  res.json({
    ok: true,
    months, thisMonth, prevMonth,
    totals,
    students,
    defaulterCount: perStudent.size,
    concessionCount,
    collection: { thisMonth: collectionThis, prevMonth: collectionPrev,
      delta: collectionPrev ? Math.round(((collectionThis - collectionPrev) / collectionPrev) * 100) : 0,
      receipts: receipts.filter((r) => monthKey(r.date) === thisMonth).length },
    series, instalments, classRows, defaulters,
  });
});
