import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import app from '../index.js';

async function withServer(_databaseStatus, run) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await run(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); }
}

test('health endpoint reports the actual database connection state', async () => {
  await withServer(null, async (base) => {
    const response = await fetch(`${base}/api/health`);
    const body = await response.json();
    assert.ok([200, 503].includes(response.status));
    assert.equal(body.database.connected, response.status === 200);
    assert.equal(body.status, response.status === 200 ? 'ok' : 'degraded');
  });
});

test('unknown API route returns structured 404 response', async () => {
  await withServer(() => ({ connected: true, state: 'connected' }), async (base) => {
    const response = await fetch(`${base}/api/not-a-route`);
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});

test('invalid JSON returns a structured 400 response', async () => {
  await withServer(() => ({ connected: true, state: 'connected' }), async (base) => {
    const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{invalid' });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_JSON');
  });
});
