import mongoose from 'mongoose';

/** One row per student per instalment — this is the fee ledger. */
const ledgerSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
  instNo: { type: String, required: true },
  month: { type: String, required: true },
  dueDate: { type: Date, required: true, index: true },
  gross: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  discountReason: { type: String, default: '' },
  lateFee: { type: Number, default: 0, min: 0 },
  paid: { type: Number, default: 0, min: 0 },
  paidOn: { type: Date, default: null },
  receipt: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', default: null },
  isCarryForward: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { timestamps: true });

ledgerSchema.index({ student: 1, instNo: 1 }, { unique: true });

ledgerSchema.virtual('balance').get(function balance() {
  return Math.max(0, this.gross - this.discount + this.lateFee - this.paid);
});
ledgerSchema.set('toJSON', { virtuals: true });
ledgerSchema.set('toObject', { virtuals: true });

export default mongoose.model('Ledger', ledgerSchema);
