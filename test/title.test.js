import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createClient } from '../src/client.js';
import { createServer } from '../src/server.js';

const PAYLOAD_TAG_OPENINGS = ['<script', '<svg', '<iframe', '<img'];
const HOSTILE_TOTAL = '12</title><script>window.stolen=1</script>';

const dated = '2026-10-07T00:00:00.000Z';
const twelveItems = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, title: `One ${i + 1}`, url: `https://a.com/${i + 1}`, tags: ['node'], createdAt: dated }));
const listWith = (total) => ({ items: twelveItems.slice(0, 2), page: 1, pages: 6, total });

const titleOf = (html) => html.match(/<title>(.*?)<\/title>/s)[1];
const titleOpenings = (html) => (html.match(/<title/g) ?? []).length;

const listening = (server) => new Promise((resolve) => server.listen(0, () => resolve(`http://127.0.0.1:${server.address().port}`)));

async function withStandInApi(total, fn) {
  const api = createHttpServer(async (req, res) => {
    for await (const chunk of req) void chunk;
    if (req.method === 'POST') {
      res.writeHead(201, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ id: 13, title: 'New', url: 'https://e.com', tags: [], createdAt: dated }));
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(listWith(total)));
  });
  const apiUrl = await listening(api);
  const web = createServer({ client: createClient({ baseUrl: apiUrl, apiKey: 'k' }) });
  const webUrl = await listening(web);
  try { await fn(webUrl); } finally { web.close(); api.close(); }
}

const form = (fields) => ({ method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });

test('a hostile total never reaches the title, and a real count on the same path still does', async () => {
  await withStandInApi(HOSTILE_TOTAL, async (base) => {
    const page = await (await fetch(`${base}/`)).text();
    assert.equal(titleOpenings(page), 1, 'the hostile total opened a second title element');
    assert.equal(titleOf(page), 'Bookmarks');
    assert.ok(!page.includes(HOSTILE_TOTAL), 'the page carries the hostile total as one contiguous run');
    for (const opening of PAYLOAD_TAG_OPENINGS) assert.ok(!page.includes(opening), `the page opens a tag from the total (${opening})`);
  });
  await withStandInApi(12, async (base) => {
    assert.equal(titleOf(await (await fetch(`${base}/`)).text()), 'Bookmarks (12)');
  });
});

test('the error page carries the count in its title and leaves the rest of the page as it was', () => withStandInApi(12, async (base) => {
  const indexPage = await (await fetch(`${base}/`)).text();
  const res = await fetch(`${base}/add`, form({ title: '', url: 'x' }));
  assert.equal(res.status, 422);
  const errorPage = await res.text();

  assert.equal(titleOpenings(errorPage), 1);
  assert.equal(titleOf(errorPage), 'Bookmarks (12)');
  assert.match(errorPage, /<ul class="errors">/);

  const sections = {
    heading: /<h1>.*?<\/h1>/s,
    headerCount: /<p class="count">.*?<\/p>/s,
    addForm: /<form[^>]*>.*?<\/form>/s,
    rows: /<ul>.*?<\/ul>/s,
    navigation: /<nav>.*?<\/nav>/s,
  };
  for (const [name, pattern] of Object.entries(sections)) {
    assert.equal(errorPage.match(pattern)[0], indexPage.match(pattern)[0], `the error page changed the ${name}`);
  }
}));
