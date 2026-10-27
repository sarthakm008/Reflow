import mongoose from 'mongoose';

export async function connectDatabase(uri) {
  if (!uri) throw new Error('MONGODB_URI is not configured.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}

export function getDatabaseStatus() {
  const state = mongoose.connection.readyState;
  return {
    connected: state === 1,
    state: ({ 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' })[state] || 'unknown',
  };
}
