import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabaseConnector } from '../config/database.js';
import { connectWithDiagnostics } from '../config/databaseDiagnostics.js';

test('concurrent requests share a successful connection attempt', async () => {
  const connection = { readyState: 0 };
  let attempts = 0;
  let finishConnect;
  const connectDatabase = createDatabaseConnector({
    getConnection: () => connection,
    connect: async () => {
      attempts += 1;
      await new Promise((resolve) => { finishConnect = resolve; });
      connection.readyState = 1;
    },
  });

  const first = connectDatabase('mongodb://example.test/db');
  const second = connectDatabase('mongodb://example.test/db');
  assert.equal(attempts, 1);
  finishConnect();
  assert.equal(await first, connection);
  assert.equal(await second, connection);
  assert.equal(await connectDatabase('mongodb://example.test/db'), connection);
  assert.equal(attempts, 1);
});

test('failed connection attempts can be retried', async () => {
  const connection = { readyState: 0 };
  let attempts = 0;
  const connectDatabase = createDatabaseConnector({
    getConnection: () => connection,
    connect: async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('unavailable'), { name: 'MongoNetworkError' });
      connection.readyState = 1;
    },
  });

  await assert.rejects(connectDatabase('mongodb://example.test/db'), /unavailable/);
  assert.equal(await connectDatabase('mongodb://example.test/db'), connection);
  assert.equal(attempts, 2);
});

test('missing URI fails without attempting a connection', async () => {
  let attempts = 0;
  const connectDatabase = createDatabaseConnector({
    getConnection: () => ({ readyState: 0 }),
    connect: async () => { attempts += 1; },
  });

  await assert.rejects(connectDatabase(''), /MONGODB_URI is not configured/);
  assert.equal(attempts, 0);
});

test('failed connection logs sanitized diagnostics before rethrowing', async () => {
  const error = Object.assign(new Error(
    'Could not connect to mongodb+srv://db-user:db-password@cluster.example/db; password=query-secret',
  ), { name: 'MongoNetworkError', code: 'ENOTFOUND' });
  const logs = [];
  const connectDatabase = async () => { throw error; };

  await assert.rejects(
    connectWithDiagnostics(connectDatabase, 'mongodb://unused', 'readiness', (...entry) => logs.push(entry)),
    (caught) => caught === error,
  );

  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], '[Reflow API] MongoDB connection failed');
  assert.equal(logs[0][1].category, 'MongoNetworkError');
  assert.equal(logs[0][1].code, 'ENOTFOUND');
  assert.match(logs[0][1].message, /\[redacted MongoDB URI\]/);
  assert.match(logs[0][1].message, /password=\[redacted\]/);
  assert.doesNotMatch(JSON.stringify(logs), /db-password|query-secret/);
});
