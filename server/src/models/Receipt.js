import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema({
  ledger: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger', required: true },
  instNo: String,
  month: String,
  gross: Number,
  discount: { type: Number, default: 0 },
  reason: { type: String, default: '' },
  lateFee: { type: Number, default: 0 },
  net: Number,
}, { _id: false });

const receiptSchema = new mongoose.Schema({
  receiptNo: { type: String, required: true, unique: true, index: true },
  seq: { type: Number, required: true },
  date: { type: Date, required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  lines: { type: [lineSchema], default: [] },
  gross: Number,
  discount: { type: Number, default: 0 },
  lateFee: { type: Number, default: 0 },
  total: { type: Number, required: true },
  mode: { type: String, required: true },
  refNo: { type: String, default: '' },
  remarks: { type: String, default: '' },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cancelled: {
    at: { type: Date, default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: '' },
  },
}, { timestamps: true });

receiptSchema.index({ 'cancelled.at': 1, date: 1 });
receiptSchema.index({ classId: 1, date: 1 });

export default mongoose.model('Receipt', receiptSchema);
