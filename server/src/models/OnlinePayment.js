import mongoose from 'mongoose';

/**
 * One row per online (gateway) payment attempt. The fee request is stored when the
 * checkout opens and turned into a receipt only after Atom confirms the money.
 */
const onlinePaymentSchema = new mongoose.Schema({
  merchTxnId: { type: String, required: true, unique: true, index: true },
  kind: { type: String, enum: ['regular', 'misc'], required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  amount: { type: Number, required: true },
  request: { type: mongoose.Schema.Types.Mixed, required: true }, // the collect / collect-misc body
  // pending → processing → success | failed; `unreconciled` = money received but no receipt could be made
  status: { type: String, enum: ['pending', 'processing', 'success', 'failed', 'unreconciled'], default: 'pending', index: true },
  atomTokenId: { type: String, default: '' },
  atomTxnId: { type: String, default: '' },
  bankTxnId: { type: String, default: '' },
  channel: { type: String, default: '' },
  statusCode: { type: String, default: '' },
  message: { type: String, default: '' },
  receipt: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', default: null },
  appUrl: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model('OnlinePayment', onlinePaymentSchema);
