import mongoose from 'mongoose';

export function createDatabaseConnector({ connect, getConnection }) {
  let connectionPromise;

  return async function connectDatabase(uri) {
    if (!uri) throw new Error('MONGODB_URI is not configured.');
    const connection = getConnection();
    if (connection.readyState === 1) return connection;

    if (!connectionPromise) {
      connectionPromise = connect(uri, { serverSelectionTimeoutMS: 5000 })
        .then(() => {
          connectionPromise = undefined;
          return getConnection();
        })
        .catch((error) => {
          connectionPromise = undefined;
          throw error;
        });
    }

    return connectionPromise;
  };
}

export const connectDatabase = createDatabaseConnector({
  connect: (...args) => mongoose.connect(...args),
  getConnection: () => mongoose.connection,
});

export function getDatabaseStatus() {
  const state = mongoose.connection.readyState;
  return {
    connected: state === 1,
    state: ({ 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' })[state] || 'unknown',
  };
}
