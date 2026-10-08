import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../src/client.js';

const fakeFetch = (status, body, calls) => async (url, init) => {
  calls.push({ url, init });
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { status, ok: status >= 200 && status < 300, text: async () => text, json: async () => JSON.parse(text) };
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

test('a non-JSON error body is kept out of the error message entirely', async () => {
  const client = createClient({ baseUrl: 'http://api', apiKey: 'k', fetch: fakeFetch(500, '<svg onload=top.z=1>', []) });
  await assert.rejects(client.listBookmarks(1), (err) => {
    assert.equal(err.status, 500);
    assert.equal(err.message, 'API answered 500');
    return true;
  });
});
