import mongoose from 'mongoose';

const schoolSchema = new mongoose.Schema({
  name: { type: String, default: 'My School' },
  branch: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  payeeName: { type: String, default: '' },
  address: { type: String, default: '' },
  logo: { type: String, default: '' },              // data: URL, capped at ~200 KB
  session: { type: String, default: '' },           // e.g. "2026-27"
  receiptPrefix: { type: String, default: 'RC/' },
  feeWindow: { type: String, default: '1st – 10th of month' },
  lateFeeFrom: { type: Number, default: 20 },       // day of month
  lateFeeAmount: { type: Number, default: 0 },
  readmissionCharge: { type: Number, default: 0 },
  advanceConcession: { type: Number, default: 0 },
  refundNote: { type: String, default: 'Fee once deposited is non-refundable.' },
  strikeOffNote: { type: String, default: '' },
}, { timestamps: true });

let cachedSchool = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

/** Singleton — one school document per database with in-memory caching. */
schoolSchema.statics.current = async function current(forceRefresh = false) {
  if (!forceRefresh && cachedSchool && (Date.now() - cacheTime < CACHE_TTL)) {
    return cachedSchool;
  }
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  cachedSchool = doc;
  cacheTime = Date.now();
  return doc;
};

schoolSchema.statics.invalidateCache = function invalidateCache() {
  cachedSchool = null;
  cacheTime = 0;
};

export default mongoose.model('School', schoolSchema);
