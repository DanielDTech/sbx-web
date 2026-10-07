import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../src/client.js';

const fakeFetch = (status, body, calls) => async (url, init) => {
  calls.push({ url, init });
  return { status, ok: status < 300, json: async () => body };
};

test('the client sends the API key and asks for the page', async () => {
  const calls = [];
  const client = createClient({ baseUrl: 'http://api', apiKey: 'k', fetch: fakeFetch(200, { items: [] }, calls) });
  await client.listBookmarks(2);
  assert.equal(calls[0].url, 'http://api/bookmarks?page=2');
  assert.equal(calls[0].init.headers['x-api-key'], 'k');
});

test('a failed call throws with the status and the body', async () => {
  const client = createClient({ baseUrl: 'http://api', apiKey: 'k', fetch: fakeFetch(422, { errors: ['x'] }, []) });
  await assert.rejects(client.addBookmark({}), (err) => err.status === 422 && err.body.errors[0] === 'x');
});
