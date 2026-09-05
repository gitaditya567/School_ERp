import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';

async function main() {
  await connectDB(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pride_joy_erp');
  const users = await User.find({}, 'name email role active');
  console.log('USERS_IN_DB:', JSON.stringify(users, null, 2));
  
  // Set explicit admin credentials requested by user
  const email = 'admin@prideandjoy.in';
  const password = 'AdminPassword123!';
  
  let admin = await User.findOne({ email });
  if (!admin) {
    admin = new User({
      name: 'School Principal',
      email: email,
      role: 'principal',
      active: true
    });
  }
  await admin.setPassword(password);
  await admin.save();
  console.log(`UPDATED_CREDENTIALS: Email: ${email}, Password: ${password}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
