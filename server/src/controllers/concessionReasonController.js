import ConcessionReason from '../models/ConcessionReason.js';
import Concession from '../models/Concession.js';
import { asyncHandler, ApiError, audit } from '../utils/helpers.js';

const DEFAULT_REASONS = [
  { name: 'Sibling Concession', description: 'Discount for siblings studying concurrently in school', defaultAmount: 500, order: 1 },
  { name: 'Staff Ward / Child', description: 'Concession for children of teaching & non-teaching school staff', defaultAmount: 1000, order: 2 },
  { name: 'Merit Scholarship', description: 'Fee waiver for high academic performance or rank holders', defaultAmount: 1500, order: 3 },
  { name: 'Financial Hardship / EWS', description: 'Assistance for families facing financial distress or EWS quota', defaultAmount: 1000, order: 4 },
  { name: 'Management Discretionary', description: 'Special concession approved by School Director or Principal', defaultAmount: 500, order: 5 },
  { name: 'Admission Concession', description: 'Introductory concession granted at the time of new admission', defaultAmount: 2000, order: 6 },
  { name: 'Sports / Extra-curricular', description: 'Awarded for state/national sports or arts achievements', defaultAmount: 500, order: 7 },
];

/** GET /api/concession-reasons — lists all concession reasons with stats */
export const list = asyncHandler(async (_req, res) => {
  let count = await ConcessionReason.countDocuments();
  if (count === 0) {
    await ConcessionReason.insertMany(DEFAULT_REASONS);
  }

  const [reasons, stats] = await Promise.all([
    ConcessionReason.find().sort('order createdAt').lean(),
    Concession.aggregate([
      {
        $group: {
          _id: '$reason',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const statsMap = new Map();
  stats.forEach((s) => {
    if (s._id) statsMap.set(s._id.trim().toLowerCase(), s);
  });

  const enriched = reasons.map((r) => {
    const s = statsMap.get(r.name.trim().toLowerCase());
    return {
      ...r,
      totalGranted: s?.totalAmount || 0,
      usageCount: s?.count || 0,
    };
  });

  res.json({ ok: true, reasons: enriched });
});

/** POST /api/concession-reasons — creates a new concession reason */
export const create = asyncHandler(async (req, res) => {
  const { name, description = '', defaultAmount = 0 } = req.body;
  const trimmedName = String(name || '').trim();

  if (!trimmedName) throw new ApiError(422, 'Enter a reason name.');

  const existing = await ConcessionReason.findOne({
    name: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
  if (existing) throw new ApiError(409, `A concession reason named "${trimmedName}" already exists.`);

  const reason = await ConcessionReason.create({
    name: trimmedName,
    description: String(description || '').trim(),
    defaultAmount: Math.max(0, Number(defaultAmount) || 0),
  });

  await audit(req, 'concessionReason.create', 'ConcessionReason', reason._id, {
    name: reason.name,
    defaultAmount: reason.defaultAmount,
  });

  res.status(201).json({ ok: true, reason, message: 'Concession reason created.' });
});

/** PATCH /api/concession-reasons/:id — updates an existing reason */
export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, defaultAmount, active } = req.body;

  const reason = await ConcessionReason.findById(id);
  if (!reason) throw new ApiError(404, 'Concession reason not found.');

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new ApiError(422, 'Reason name cannot be empty.');
    const conflict = await ConcessionReason.findOne({
      _id: { $ne: id },
      name: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (conflict) throw new ApiError(409, `Another concession reason named "${trimmed}" already exists.`);
    reason.name = trimmed;
  }

  if (description !== undefined) reason.description = String(description).trim();
  if (defaultAmount !== undefined) reason.defaultAmount = Math.max(0, Number(defaultAmount) || 0);
  if (active !== undefined) reason.active = Boolean(active);

  await reason.save();

  await audit(req, 'concessionReason.update', 'ConcessionReason', reason._id, {
    name: reason.name,
    defaultAmount: reason.defaultAmount,
  });

  res.json({ ok: true, reason, message: 'Concession reason updated.' });
});

/** DELETE /api/concession-reasons/:id — deletes a concession reason */
export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reason = await ConcessionReason.findById(id);
  if (!reason) throw new ApiError(404, 'Concession reason not found.');

  await ConcessionReason.findByIdAndDelete(id);

  await audit(req, 'concessionReason.delete', 'ConcessionReason', reason._id, {
    name: reason.name,
  });

  res.json({ ok: true, message: `Concession reason "${reason.name}" deleted.` });
});
