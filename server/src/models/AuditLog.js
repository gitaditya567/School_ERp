import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  action: { type: String, required: true },     // 'receipt.create', 'class.delete' …
  entity: String,
  entityId: mongoose.Schema.Types.ObjectId,
  detail: mongoose.Schema.Types.Mixed,
  at: { type: Date, default: Date.now, index: true },
});

export default mongoose.model('AuditLog', auditSchema);
