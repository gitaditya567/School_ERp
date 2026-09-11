import mongoose from 'mongoose';

const concessionReasonSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  description: { type: String, default: '', trim: true },
  defaultAmount: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('ConcessionReason', concessionReasonSchema);
