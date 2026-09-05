import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  voucherNo: { type: String, required: true, unique: true },
  date: { type: Date, required: true, index: true },
  head: { type: String, required: true },
  particulars: { type: String, default: '' },
  amount: { type: Number, required: true, min: 1 },
  mode: { type: String, default: 'Cash' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model('Expense', expenseSchema);
