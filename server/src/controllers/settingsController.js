import School from '../models/School.js';
import Counter from '../models/Counter.js';
import AuditLog from '../models/AuditLog.js';
import { asyncHandler, ApiError, audit, formatAdmissionNo, getAdmissionCounterKey } from '../utils/helpers.js';

const FIELDS = ['name', 'branch', 'phone', 'email', 'payeeName', 'address', 'session', 'receiptPrefix',
  'feeWindow', 'lateFeeStructure', 'lateFeeTier1Days', 'lateFeeTier1Amount', 'lateFeeTier2Days', 'lateFeeTier2Amount', 'lateFeeTier3Amount',
  'lateFeeFrom', 'lateFeeAmount', 'readmissionCharge', 'advanceConcession', 'refundNote', 'strikeOffNote',
  'admissionPrefix', 'admissionYearFormat', 'admissionSeparator', 'admissionPadding', 'admissionSeqMode'];

export const get = asyncHandler(async (_req, res) => {
  const school = await School.current();
  const seq = (await Counter.findOne({ key: 'receipt' }))?.seq || 0;

  const admKey = getAdmissionCounterKey(school);
  const admCounter = (await Counter.findOne({ key: admKey }))?.seq || 0;
  const nextAdmissionSeq = admCounter + 1;
  const nextAdmissionNo = formatAdmissionNo(school, nextAdmissionSeq);

  res.json({
    ok: true,
    school,
    nextReceiptNo: `${school.receiptPrefix}${String(seq + 1).padStart(4, '0')}`,
    nextAdmissionNo,
    nextAdmissionSeq,
  });
});

const NUMERIC_FIELDS = ['lateFeeFrom', 'lateFeeAmount', 'readmissionCharge', 'advanceConcession',
  'lateFeeTier1Days', 'lateFeeTier1Amount', 'lateFeeTier2Days', 'lateFeeTier2Amount', 'lateFeeTier3Amount',
  'admissionPadding'];

export const update = asyncHandler(async (req, res) => {
  const school = await School.current();
  FIELDS.forEach((f) => {
    if (req.body[f] !== undefined) {
      if (NUMERIC_FIELDS.includes(f)) {
        school[f] = req.body[f] === '' || req.body[f] === null ? 0 : Number(req.body[f]) || 0;
      } else {
        school[f] = req.body[f];
      }
    }
  });
  // A late-fee rule that cannot be applied as written is refused rather than silently reinterpreted.
  // School.current() is cached, so drop the half-edited copy before refusing.
  const refuse = (msg) => { School.invalidateCache(); throw new ApiError(422, msg); };
  if (school.lateFeeStructure === 'flat') {
    if (school.lateFeeFrom < 1 || school.lateFeeFrom > 31) refuse('Late fee "after day" must be between 1 and 31.');
    if (school.lateFeeAmount < 0) refuse('Late fee amount cannot be negative.');
  } else {
    if (school.lateFeeTier1Days < 0) refuse('Tier 1 days cannot be negative.');
    if (school.lateFeeTier2Days <= school.lateFeeTier1Days) {
      refuse(`Tier 2 days (${school.lateFeeTier2Days}) must be more than Tier 1 days (${school.lateFeeTier1Days}).`);
    }
    if ([school.lateFeeTier1Amount, school.lateFeeTier2Amount, school.lateFeeTier3Amount].some((a) => a < 0)) {
      refuse('Late fee amounts cannot be negative.');
    }
  }
  await school.save();
  School.invalidateCache();

  if (req.body.admissionNextSeq !== undefined && req.body.admissionNextSeq !== '') {
    const nextSeqNum = Math.max(1, parseInt(req.body.admissionNextSeq, 10) || 1);
    const admKey = getAdmissionCounterKey(school);
    await Counter.findOneAndUpdate(
      { key: admKey },
      { $set: { seq: nextSeqNum - 1 } },
      { upsert: true, new: true },
    );
  }

  const admKey = getAdmissionCounterKey(school);
  const admCounter = (await Counter.findOne({ key: admKey }))?.seq || 0;
  const nextAdmissionSeq = admCounter + 1;
  const nextAdmissionNo = formatAdmissionNo(school, nextAdmissionSeq);

  await audit(req, 'settings.update', 'School', school._id);
  res.json({ ok: true, school, nextAdmissionNo, nextAdmissionSeq });
});

/** PUT /api/settings/logo — body { logo: "data:image/png;base64,…" } or { logo: "" } to clear. */
export const setLogo = asyncHandler(async (req, res) => {
  const logo = req.body.logo || '';
  if (logo && !/^data:image\/(png|jpeg|webp|svg\+xml);/.test(logo)) {
    throw new ApiError(422, 'Upload a PNG, JPG, SVG or WebP image.');
  }
  if (logo.length > 300 * 1024) throw new ApiError(413, 'That image is too large — please use one under 200 KB.');
  const school = await School.current();
  school.logo = logo;
  await school.save();
  School.invalidateCache();
  await audit(req, logo ? 'settings.logo.set' : 'settings.logo.clear', 'School', school._id);
  res.json({ ok: true, logo: school.logo, message: logo ? 'Logo updated.' : 'Logo removed.' });
});

export const auditTrail = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find().sort('-at').limit(Number(req.query.limit) || 100);
  res.json({ ok: true, logs });
});
