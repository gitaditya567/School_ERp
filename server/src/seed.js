/**
 * Creates the first Principal account and the standard fee heads.
 * Nothing else — no demo classes, students or receipts.
 *   npm run seed
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import FeeHead from './models/FeeHead.js';
import School from './models/School.js';

const HEADS = [
  { name: 'Tuition Fee', code: 'tuition', type: 'recurring' },
  { name: 'Admission Fee', code: 'admission', type: 'one-time' },
  { name: 'Form / Prospectus', code: 'form', type: 'one-time' },
  { name: 'Kit Charges', code: 'kit', type: 'one-time' },
  { name: 'Half Annual Fee', code: 'annual', type: 'periodic' },
  { name: 'Late Fee', code: 'late', type: 'penalty' },
  { name: 'Previous Session Balance', code: 'carryforward', type: 'carry-forward' },
];

async function run() {
  await connectDB(process.env.MONGO_URI);

  const school = await School.current();
  if (!school.name || school.name === 'My School') {
    school.name = process.env.SEED_SCHOOL_NAME || 'My School';
    await school.save();
  }

  let created = 0;
  for (const h of HEADS) {
    const exists = await FeeHead.findOne({ code: h.code });
    if (!exists) { await FeeHead.create(h); created += 1; }
  }
  console.log(`Fee heads: ${created} created, ${HEADS.length - created} already present.`);

  if (await User.countDocuments()) {
    console.log('A user already exists — skipping the admin account.');
  } else {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      console.log('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env, or create the admin from the app’s first-run screen.');
    } else {
      const user = new User({ name: process.env.SEED_ADMIN_NAME || 'Principal', email, role: 'principal' });
      await user.setPassword(password);
      await user.save();
      console.log(`Principal account created: ${email}`);
      console.log('Sign in and change this password straight away.');
    }
  }

  await mongoose.disconnect();
  console.log('Seed finished. The database holds no student, class or receipt data.');
}

run().catch((e) => { console.error(e); process.exit(1); });
