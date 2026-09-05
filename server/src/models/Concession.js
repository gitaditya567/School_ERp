import mongoose from 'mongoose';

const concessionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  ledger: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' },
  instNo: String,
  amount: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receipt: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', default: null },
  date: { type: Date, required: true, index: true },
}, { timestamps: true });

export default mongoose.model('Concession', concessionSchema);
