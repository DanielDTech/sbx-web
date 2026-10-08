import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createClient } from '../src/client.js';
import { createServer } from '../src/server.js';

const FAILURE_SENTENCE = 'The bookmarks API failed';
const PAYLOAD_TAG_OPENINGS = ['<svg', '<script', '<iframe', '<img'];

const QUOTED_WHOLE = '<svg onload=top.z=1>';
const CUT_MID_WORD = '<img src=x onerror=top.z=1>';
const GATEWAY_PAGE = '<script>window.stolen = document.cookie</script><iframe src="//evil.test"></iframe>';
const TRUNCATED_JSON = '{"items":[{"title":"x"}';

const listening = (server) => new Promise((resolve) => server.listen(0, () => resolve(`http://127.0.0.1:${server.address().port}`)));

async function withPair(apiHandler, fn) {
  const api = createHttpServer(apiHandler);
  const apiUrl = await listening(api);
  const web = createServer({ client: createClient({ baseUrl: apiUrl, apiKey: 'k' }) });
  const webUrl = await listening(web);
  try { await fn(webUrl); } finally { web.close(); api.close(); }
}

const answering = (status, body, contentType = 'text/html') => (req, res) => {
  res.writeHead(status, { 'content-type': contentType });
  res.end(body);
};

const form = (fields) => ({ method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });

function assertCarriesNoInjection(status, page, apiBody) {
  assert.equal(status, 502);
  assert.ok(page.includes(FAILURE_SENTENCE), `the failure sentence is missing from: ${page}`);
  for (const opening of PAYLOAD_TAG_OPENINGS) {
    assert.ok(!page.includes(opening), `the page opens a tag from the API body (${opening}): ${page}`);
  }
  assert.ok(!page.includes(apiBody), `the page carries the API body as one contiguous unescaped run: ${page}`);
}

const failingList = (body) => (payload) => withPair(answering(500, body), async (base) => {
  const res = await fetch(`${base}/`);
  assertCarriesNoInjection(res.status, await res.text(), payload);
});

test('a short non-JSON error body quoted whole by the parse failure cannot inject a tag', () => failingList(QUOTED_WHOLE)(QUOTED_WHOLE));

test('a gateway HTML error page cut mid-word by the parse failure cannot inject a tag', () => failingList(GATEWAY_PAGE)(GATEWAY_PAGE));

test('an error body the parse failure quotes none of still yields a clean failure page', () => failingList(TRUNCATED_JSON)(TRUNCATED_JSON));

test('an OK list response whose body is not JSON cannot inject a tag', () => withPair(answering(200, QUOTED_WHOLE), async (base) => {
  const res = await fetch(`${base}/`);
  assertCarriesNoInjection(res.status, await res.text(), QUOTED_WHOLE);
}));

test('a created add response whose body is not JSON cannot inject a tag', () => withPair(answering(201, CUT_MID_WORD), async (base) => {
  const res = await fetch(`${base}/add`, form({ title: 'A', url: 'https://a.com', tags: 'web' }));
  assertCarriesNoInjection(res.status, await res.text(), CUT_MID_WORD);
}));

test('an invalid submission becomes a clean 502 rather than a 422 when the API is failing', () => withPair(answering(500, GATEWAY_PAGE), async (base) => {
  const res = await fetch(`${base}/add`, form({ title: '', url: 'https://a.com' }));
  assertCarriesNoInjection(res.status, await res.text(), GATEWAY_PAGE);
}));

test('a healthy page carries none of the payload tag openings, so the injection checks mean what they say', () => {
  const healthy = { items: [{ id: 1, title: 'Docs', url: 'https://a.com', tags: ['node'], createdAt: '2026-10-07T00:00:00.000Z' }], page: 1, pages: 1, total: 1 };
  return withPair(answering(200, JSON.stringify(healthy), 'application/json'), async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const page = await res.text();
    for (const opening of PAYLOAD_TAG_OPENINGS) {
      assert.ok(!page.includes(opening), `a healthy page already contains ${opening}; the injection checks need rewriting, this is not an injection`);
    }
  });
});
