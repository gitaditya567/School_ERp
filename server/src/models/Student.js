import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  admissionNo: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  dob: { type: Date, required: true },
  gender: { type: String, enum: ['M', 'F', 'O'], default: 'F' },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
  section: { type: String, default: 'A' },
  admissionDate: { type: Date, required: true },
  status: { type: String, enum: ['Active', 'Struck off', 'Left', 'Alumni'], default: 'Active' },
  bloodGroup: { type: String, default: '' },
  carryForward: { type: Number, default: 0, min: 0 },
  father: { type: String, required: true, trim: true },
  mother: { type: String, default: '', trim: true },
  phone: { type: String, required: true, trim: true },
  alternatePhone: { type: String, default: '', trim: true },
  email: { type: String, default: '', lowercase: true, trim: true },
  address: { type: String, default: '' },
  occupation: { type: String, default: '' },
  aadhaarLast4: { type: String, default: '' },
  childAadhaar: { type: String, default: '', trim: true },
  fatherAadhaar: { type: String, default: '', trim: true },
  motherAadhaar: { type: String, default: '', trim: true },
  birthCertificateSubmitted: { type: Boolean, default: false },
  fatherAadhaarSubmitted: { type: Boolean, default: false },
  motherAadhaarSubmitted: { type: Boolean, default: false },
  birthCertificateDoc: { type: String, default: '' },
  fatherAadhaarDoc: { type: String, default: '' },
  motherAadhaarDoc: { type: String, default: '' },
  photo: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

studentSchema.index({ name: 1 });
studentSchema.index({ classId: 1, name: 1 });
studentSchema.index({ phone: 1 });
studentSchema.index({ alternatePhone: 1 });

export default mongoose.model('Student', studentSchema);
