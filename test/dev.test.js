import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { createStubClient } from '../bin/dev.js';

async function withServer(client, fn) {
  const server = createServer({ client });
  await new Promise((resolve) => server.listen(0, resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

test('the stub harness serves a page containing a seeded bookmark', () => withServer(createStubClient(), async (base) => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Node\.js docs/);
}));
