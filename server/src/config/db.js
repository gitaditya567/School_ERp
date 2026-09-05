import mongoose from 'mongoose';

export async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true });
  const { host, name } = mongoose.connection;
  console.log(`MongoDB connected — ${host}/${name}`);
  return mongoose.connection;
}

/**
 * Runs `fn` inside a transaction when the deployment supports one
 * (replica set / Atlas) and plainly on a standalone mongod.
 */
export async function withTransaction(fn) {
  if (process.env.DISABLE_TRANSACTIONS === '1') return fn(null);
  const supports = mongoose.connection.client?.topology?.hasSessionSupport?.();
  if (!supports) return fn(null);
  let session;
  try {
    session = await mongoose.startSession();
    let out;
    await session.withTransaction(async () => { out = await fn(session); });
    return out;
  } catch (err) {
    // Standalone servers and some MongoDB-compatible backends refuse transactions.
    const noTx = /transaction|replica set|not supported|Unrecognized field/i.test(err.message || '');
    if (!noTx) throw err;
    console.warn('Transactions unavailable — falling back to sequential writes.');
    return fn(null);
  } finally {
    session?.endSession();
  }
}
