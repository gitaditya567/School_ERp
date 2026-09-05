import mongoose from 'mongoose';

const feeHeadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, lowercase: true, trim: true },
  type: {
    type: String,
    enum: ['recurring', 'one-time', 'periodic', 'penalty', 'carry-forward'],
    default: 'recurring',
  },
}, { timestamps: true });

export default mongoose.model('FeeHead', feeHeadSchema);
