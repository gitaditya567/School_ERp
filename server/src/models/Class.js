import mongoose from 'mongoose';

const partSchema = new mongoose.Schema({
  head: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeHead', required: true },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const instalmentSchema = new mongoose.Schema({
  no: { type: String, required: true, trim: true, uppercase: true }, // I, II, III …
  month: { type: String, required: true },                            // "Apr 2026"
  dueDate: { type: Date, required: true },
  parts: { type: [partSchema], default: [] },
}, { _id: true });

instalmentSchema.virtual('total').get(function total() {
  return (this.parts || []).reduce((s, p) => s + p.amount, 0);
});
instalmentSchema.set('toJSON', { virtuals: true });
instalmentSchema.set('toObject', { virtuals: true });

const classSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  status: { type: String, enum: ['draft', 'verified'], default: 'draft' },
  source: { type: String, default: '' },
  order: { type: Number, default: 0 },
  plan: { type: [instalmentSchema], default: [] },
}, { timestamps: true });

classSchema.virtual('sessionTotal').get(function sessionTotal() {
  return (this.plan || []).reduce((s, i) => s + (i.parts || []).reduce((a, p) => a + p.amount, 0), 0);
});
classSchema.set('toJSON', { virtuals: true });
classSchema.set('toObject', { virtuals: true });

export default mongoose.model('Class', classSchema);
