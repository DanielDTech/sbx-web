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

const headerOf = (html) => html.match(/<header>.*?<\/header>/s)[0];
const twoOfSeven = { items: [
  { id: 1, title: 'One', url: 'https://a.com', tags: [], createdAt: '2026-10-07T00:00:00.000Z' },
  { id: 2, title: 'Two', url: 'https://b.com', tags: [], createdAt: '2026-10-07T00:00:00.000Z' },
], total: 7, pages: 4 };
const listReportingSeven = async (page = 1) => ({ ...twoOfSeven, page });

test('the index page header reports the total the API reported', () => withServer({ listBookmarks: listReportingSeven }, async (base) => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(headerOf(await res.text()), /7 bookmarks/);
}));

test('a later page still reports the whole total and keeps its previous link', () => withServer({ listBookmarks: listReportingSeven }, async (base) => {
  const html = await (await fetch(`${base}/?page=2`)).text();
  assert.match(headerOf(html), /7 bookmarks/);
  assert.match(html, /Previous/);
}));

test('the error page for an invalid form carries both the errors and the header count', () => withServer({ listBookmarks: listReportingSeven, addBookmark: async () => { throw new Error('must not be called'); } }, async (base) => {
  const res = await fetch(`${base}/add`, form({ title: '', url: 'https://a.com' }));
  assert.equal(res.status, 422);
  const html = await res.text();
  assert.match(html, /class="errors"/);
  assert.match(headerOf(html), /7 bookmarks/);
}));

test('the API failure page states the failure and shows no count at all', () => withServer({ listBookmarks: async () => { throw new Error('down'); } }, async (base) => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 502);
  const body = await res.text();
  assert.match(body, /API failed/);
  assert.doesNotMatch(body, /\d+\s+bookmarks?/);
  assert.doesNotMatch(body, /count unavailable/);
}));
