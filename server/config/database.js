import mongoose from 'mongoose';

let connectionPromise;

export async function connectDatabase(uri) {
  if (!uri) throw new Error('MONGODB_URI is not configured.');
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
      .then(() => {
        connectionPromise = undefined;
        return mongoose.connection;
      })
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }

  return connectionPromise;
}

export function getDatabaseStatus() {
  const state = mongoose.connection.readyState;
  return {
    connected: state === 1,
    state: ({ 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' })[state] || 'unknown',
  };
}
