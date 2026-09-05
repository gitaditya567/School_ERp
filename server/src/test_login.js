import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';

async function testLogin(email, password) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) return console.log(`User ${email} not found`);
  const match = await user.verifyPassword(password);
  console.log(`Login test for ${email} with password "${password}": ${match ? 'SUCCESS' : 'FAILED'}`);
}

async function main() {
  await connectDB(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pride_joy_erp');
  await testLogin('admin@prideandjoy.in', 'AdminPassword123!');
  await testLogin('principal@prideandjoy.in', 'ChangeMe@123');
  await mongoose.disconnect();
}

main().catch(console.error);
