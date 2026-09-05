import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

/** Atomic, gap-free sequence. Receipt numbers must never be reused. */
counterSchema.statics.next = async function next(key, session = null) {
  const doc = await this.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session },
  );
  return doc.seq;
};

export default mongoose.model('Counter', counterSchema);
