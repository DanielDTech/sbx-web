import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function withServer(client, fn) {
  const server = createServer({ client });
  await new Promise((resolve) => server.listen(0, resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}
const emptyList = async () => ({ items: [], page: 1, pages: 1, total: 0 });
const form = (fields) => ({ method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });

test('the index page renders the list', () => withServer({ listBookmarks: emptyList }, async (base) => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Bookmarks/);
}));

test('an invalid form is shown again with its errors and nothing is added', () => {
  const added = [];
  return withServer({ listBookmarks: emptyList, addBookmark: async (f) => added.push(f) }, async (base) => {
    const res = await fetch(`${base}/add`, form({ title: '', url: 'x' }));
    assert.equal(res.status, 422);
    assert.equal(added.length, 0);
  });
});

test('a valid form adds the bookmark with its tags split and redirects home', () => {
  const added = [];
  return withServer({ listBookmarks: emptyList, addBookmark: async (f) => added.push(f) }, async (base) => {
    const res = await fetch(`${base}/add`, form({ title: 'A', url: 'https://a.com', tags: 'web, node' }));
    assert.equal(res.status, 303);
    assert.deepEqual(added[0].tags, ['web', 'node']);
  });
});

test('an API failure is a 502 page, not a crash', () => withServer({ listBookmarks: async () => { throw new Error('down'); } }, async (base) => {
  assert.equal((await fetch(`${base}/`)).status, 502);
}));
