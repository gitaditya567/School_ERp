import FeeHead from '../models/FeeHead.js';
import Class from '../models/Class.js';
import Student from '../models/Student.js';
import { asyncHandler, ApiError, audit, monthLabel, instTotal } from '../utils/helpers.js';
import { syncClassLedgers, paidCount } from '../services/ledger.js';

/* ------------------------------ fee heads ------------------------------ */

export const listHeads = asyncHandler(async (_req, res) => {
  const heads = await FeeHead.find().sort('createdAt');
  const classes = await Class.find().select('name plan');
  const usage = {};
  classes.forEach((c) => c.plan.forEach((p) => p.parts.forEach((x) => {
    (usage[x.head] = usage[x.head] || new Set()).add(c.name);
  })));
  res.json({
    ok: true,
    heads: heads.map((h) => ({ ...h.toObject(), usedBy: [...(usage[h._id] || [])] })),
  });
});

export const createHead = asyncHandler(async (req, res) => {
  const { name, code, type } = req.body;
  const head = await FeeHead.create({ name, code: code || name.toLowerCase().replace(/[^a-z0-9]/g, ''), type });
  await audit(req, 'feehead.create', 'FeeHead', head._id, { name });
  res.status(201).json({ ok: true, head });
});

export const updateHead = asyncHandler(async (req, res) => {
  const head = await FeeHead.findByIdAndUpdate(
    req.params.id,
    { $set: { name: req.body.name, type: req.body.type } },
    { new: true, runValidators: true },
  );
  if (!head) throw new ApiError(404, 'Fee head not found.');
  await audit(req, 'feehead.update', 'FeeHead', head._id);
  res.json({ ok: true, head });
});

export const deleteHead = asyncHandler(async (req, res) => {
  const used = await Class.find({ 'plan.parts.head': req.params.id }).select('name');
  if (used.length) {
    throw new ApiError(409, `This head is used in ${used.map((c) => c.name).join(', ')} — remove it from those plans first.`);
  }
  const head = await FeeHead.findByIdAndDelete(req.params.id);
  if (!head) throw new ApiError(404, 'Fee head not found.');
  await audit(req, 'feehead.delete', 'FeeHead', req.params.id, { name: head.name });
  res.json({ ok: true, message: `“${head.name}” deleted.` });
});

/* -------------------------------- classes ------------------------------- */

const withCounts = async (classes) => {
  const counts = await Student.aggregate([{ $group: { _id: '$classId', n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  return classes.map((c) => ({ ...c.toJSON(), students: map[String(c._id)] || 0 }));
};

export const listClasses = asyncHandler(async (req, res) => {
  const filter = req.scopeClass ? { _id: req.scopeClass } : {};
  const classes = await Class.find(filter).populate('plan.parts.head', 'name code type').sort('order name');
  res.json({ ok: true, classes: await withCounts(classes) });
});

export const getClass = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id).populate('plan.parts.head', 'name code type');
  if (!klass) throw new ApiError(404, 'Class not found.');
  const collected = {};
  await Promise.all(klass.plan.map(async (p) => { collected[p.no] = await paidCount(klass._id, p.no); }));
  res.json({ ok: true, class: klass.toJSON(), collected, students: await Student.countDocuments({ classId: klass._id }) });
});

export const createClass = asyncHandler(async (req, res) => {
  const { name, code, status, source, copyFrom } = req.body;
  let plan = [];
  if (copyFrom) {
    const src = await Class.findById(copyFrom);
    if (!src) throw new ApiError(404, 'The class to copy from was not found.');
    plan = src.plan.map((p) => ({ no: p.no, month: p.month, dueDate: p.dueDate, parts: p.parts.map((x) => ({ head: x.head, amount: x.amount })) }));
  }
  const order = await Class.countDocuments();
  const klass = await Class.create({ name, code, status: status || 'draft', source: source || `Added by ${req.user.name}`, order, plan });
  await audit(req, 'class.create', 'Class', klass._id, { name, copiedFrom: copyFrom || null });
  res.status(201).json({ ok: true, class: klass.toJSON() });
});

export const updateClass = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id);
  if (!klass) throw new ApiError(404, 'Class not found.');
  const { name, status, source } = req.body;
  if (name) klass.name = name;
  if (status) klass.status = status;
  if (source !== undefined) klass.source = source;
  await klass.save();
  await audit(req, 'class.update', 'Class', klass._id);
  res.json({ ok: true, class: klass.toJSON() });
});

export const deleteClass = asyncHandler(async (req, res) => {
  const n = await Student.countDocuments({ classId: req.params.id });
  if (n) throw new ApiError(409, `Cannot delete — ${n} student${n > 1 ? 's are' : ' is'} enrolled in this class. Move them first.`);
  if (await Class.countDocuments() < 2) throw new ApiError(409, 'At least one class must exist.');
  const klass = await Class.findByIdAndDelete(req.params.id);
  if (!klass) throw new ApiError(404, 'Class not found.');
  await audit(req, 'class.delete', 'Class', req.params.id, { name: klass.name });
  res.json({ ok: true, message: `${klass.name} deleted.` });
});

/* ----------------------------- instalments ------------------------------ */

const plain = (p) => ({
  ...(p._id ? { _id: p._id } : {}),
  no: p.no, month: p.month, dueDate: p.dueDate,
  parts: (p.parts || []).map((x) => ({ head: x.head?._id || x.head, amount: x.amount })),
});

/** Writes the whole plan array in one $set and returns the reloaded class. */
async function savePlan(klass, plan) {
  const next = plan
    .map(plain)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  await Class.updateOne({ _id: klass._id }, { $set: { plan: next } });
  return Class.findById(klass._id);
}

const normalise = (body) => {
  const dueDate = new Date(body.dueDate);
  if (Number.isNaN(dueDate.getTime())) throw new ApiError(422, 'Enter a valid due date.');
  const parts = (body.parts || []).filter((p) => p.head).map((p) => ({ head: p.head, amount: Math.max(0, Number(p.amount) || 0) }));
  if (!parts.length) throw new ApiError(422, 'Add at least one fee head to the instalment.');
  if (!parts.reduce((s, p) => s + p.amount, 0)) throw new ApiError(422, 'The instalment total cannot be zero.');
  return { no: String(body.no || '').trim().toUpperCase(), month: monthLabel(dueDate), dueDate, parts };
};

export const addInstalment = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id);
  if (!klass) throw new ApiError(404, 'Class not found.');
  const inst = normalise(req.body);
  if (!inst.no) throw new ApiError(422, 'Give the instalment a number, e.g. IX.');
  if (klass.plan.some((p) => p.no === inst.no)) throw new ApiError(409, `Instalment ${inst.no} already exists in ${klass.name}.`);
  const saved = await savePlan(klass, [...klass.plan.map(plain), inst]);
  const sync = await syncClassLedgers(saved);
  await audit(req, 'instalment.create', 'Class', klass._id, { no: inst.no, total: instTotal(inst) });
  res.status(201).json({ ok: true, class: saved.toJSON(), sync });
});

export const updateInstalment = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id);
  if (!klass) throw new ApiError(404, 'Class not found.');
  const inst = klass.plan.id(req.params.instId);
  if (!inst) throw new ApiError(404, 'Instalment not found.');

  const paid = await paidCount(klass._id, inst.no);
  if (paid) throw new ApiError(409, `Instalment ${inst.no} has already been collected from ${paid} student(s) — it cannot be edited. Add a new instalment instead.`);

  const next = normalise(req.body);
  if (klass.plan.some((p) => p.no === next.no && String(p._id) !== String(inst._id))) {
    throw new ApiError(409, `Instalment ${next.no} already exists in ${klass.name}.`);
  }
  const saved = await savePlan(klass, klass.plan.map((p) => (String(p._id) === String(inst._id) ? { ...next, _id: p._id } : plain(p))));
  const sync = await syncClassLedgers(saved);
  await audit(req, 'instalment.update', 'Class', klass._id, { no: next.no });
  res.json({ ok: true, class: saved.toJSON(), sync });
});

export const deleteInstalment = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id);
  if (!klass) throw new ApiError(404, 'Class not found.');
  const inst = klass.plan.id(req.params.instId);
  if (!inst) throw new ApiError(404, 'Instalment not found.');

  const paid = await paidCount(klass._id, inst.no);
  if (paid) throw new ApiError(409, `Cannot delete — instalment ${inst.no} is already collected from ${paid} student(s).`);

  const { no } = inst;
  const saved = await savePlan(klass, klass.plan.filter((p) => String(p._id) !== String(inst._id)));
  const sync = await syncClassLedgers(saved);   // removes the unpaid rows and reports the count
  await audit(req, 'instalment.delete', 'Class', klass._id, { no });
  res.json({ ok: true, class: saved.toJSON(), sync, message: `Instalment ${no} deleted.` });
});

export const copyPlan = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id);
  const src = await Class.findById(req.body.from);
  if (!klass || !src) throw new ApiError(404, 'Class not found.');
  const adjust = Number(req.body.adjustPercent) || 0;

  const keepNos = [];
  for (const p of klass.plan) if (await paidCount(klass._id, p.no)) keepNos.push(p.no);
  const keep = klass.plan.filter((p) => keepNos.includes(p.no)).map((p) => p.toObject());

  const fresh = src.plan
    .filter((p) => !keepNos.includes(p.no))
    .map((p) => ({
      no: p.no, month: p.month, dueDate: p.dueDate,
      parts: p.parts.map((x) => ({ head: x.head, amount: adjust ? Math.round((x.amount * (1 + adjust / 100)) / 50) * 50 : x.amount })),
    }));

  const saved = await savePlan(klass, [...keep, ...fresh]);
  const sync = await syncClassLedgers(saved);
  await audit(req, 'class.copyPlan', 'Class', klass._id, { from: src.name, adjust });
  res.json({ ok: true, class: saved.toJSON(), sync, message: `${src.name} plan copied into ${klass.name}.` });
});
