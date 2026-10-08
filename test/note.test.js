import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createClient } from '../src/client.js';
import { createServer } from '../src/server.js';
import { SBX_LIB_NOTE_MAX_CODE_UNITS } from '../src/ui/pages.js';

const PAYLOAD_TAG_OPENINGS = ['<script', '<svg', '<iframe', '<img'];
const SCRIPT_NOTE = '<script>alert(1)</script>';

const dated = '2026-10-07T00:00:00.000Z';
const listWithOneNote = {
  items: [
    { id: 1, title: 'One', url: 'https://a.com', tags: ['node'], createdAt: dated },
    { id: 2, title: 'Two', url: 'https://b.com', tags: [], createdAt: dated, note: SCRIPT_NOTE },
    { id: 3, title: 'Three', url: 'https://c.com', tags: ['web'], createdAt: dated },
    { id: 4, title: 'Four', url: 'https://d.com', tags: [], createdAt: dated },
  ],
  page: 1,
  pages: 1,
  total: 4,
};

const listening = (server) => new Promise((resolve) => server.listen(0, () => resolve(`http://127.0.0.1:${server.address().port}`)));

async function withStandInApi(fn) {
  const received = [];
  const api = createHttpServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    received.push({ method: req.method, path: req.url, body: raw === '' ? null : JSON.parse(raw) });
    if (req.method === 'POST') {
      res.writeHead(201, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ id: 5, title: 'New', url: 'https://e.com', tags: [], createdAt: dated }));
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(listWithOneNote));
  });
  const apiUrl = await listening(api);
  const web = createServer({ client: createClient({ baseUrl: apiUrl, apiKey: 'k' }) });
  const webUrl = await listening(web);
  try { await fn(webUrl, received); } finally { web.close(); api.close(); }
}

const form = (fields) => ({ method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });
const creates = (received) => received.filter((r) => r.method === 'POST');

test('a note from the API is rendered as text through the real server, creating no element', () => withStandInApi(async (base) => {
  const page = await (await fetch(`${base}/`)).text();
  assert.ok(page.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'the escaped note is missing from the page');
  for (const opening of PAYLOAD_TAG_OPENINGS) assert.ok(!page.includes(opening), `the page opens a tag from the note (${opening})`);
  assert.ok(!page.includes(SCRIPT_NOTE), 'the page carries the note as one contiguous unescaped run');
}));

test('bookmarks the API sends without a note key render with no note element', () => withStandInApi(async (base) => {
  const page = await (await fetch(`${base}/`)).text();
  assert.equal(page.match(/class="note"/g).length, 1);
  assert.doesNotMatch(page, /undefined/);
}));

test('a typed note reaches the API exactly as typed and untrimmed', () => withStandInApi(async (base, received) => {
  const note = '  a note the user typed  ';
  const res = await fetch(`${base}/add`, form({ title: 'A', url: 'https://a.com', tags: 'web', note }));
  assert.equal(res.status, 303);
  assert.equal(creates(received)[0].body.note, note);
}));

test('a blank or whitespace-only note is left out of the body entirely', () => withStandInApi(async (base, received) => {
  for (const note of ['', '   ']) {
    const res = await fetch(`${base}/add`, form({ title: 'A', url: 'https://a.com', note }));
    assert.equal(res.status, 303);
  }
  for (const create of creates(received)) {
    assert.ok(!('note' in create.body), `the body carries a note key: ${JSON.stringify(create.body)}`);
  }
}));

test('a note one code unit over the maximum is refused with the library message and never sent', () => withStandInApi(async (base, received) => {
  const res = await fetch(`${base}/add`, form({ title: 'A', url: 'https://a.com', note: 'a'.repeat(SBX_LIB_NOTE_MAX_CODE_UNITS + 1) }));
  assert.equal(res.status, 422);
  assert.match(await res.text(), /note is longer than 500 characters/);
  assert.deepEqual(creates(received), []);
}));

test('a note at exactly the maximum is accepted and sent', () => withStandInApi(async (base, received) => {
  const note = 'a'.repeat(SBX_LIB_NOTE_MAX_CODE_UNITS);
  const res = await fetch(`${base}/add`, form({ title: 'A', url: 'https://a.com', note }));
  assert.equal(res.status, 303);
  assert.equal(creates(received)[0].body.note, note);
}));
