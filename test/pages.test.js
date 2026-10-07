import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderIndex } from '../src/ui/pages.js';

const page = (items, extra = {}) => ({ items, page: 1, pages: 1, total: items.length, ...extra });

test('each bookmark shows its title, date and tags', () => {
  const html = renderIndex(page([{ id: 1, title: 'Docs', url: 'https://a.com', tags: ['node'], createdAt: '2026-10-07T00:00:00.000Z' }]));
  assert.match(html, /Docs/);
  assert.match(html, /2026-10-07/);
  assert.match(html, /#node/);
});

test('markup in a title is escaped', () => {
  const html = renderIndex(page([{ id: 1, title: '<script>x</script>', url: 'https://a.com', tags: [], createdAt: '2026-10-07T00:00:00.000Z' }]));
  assert.doesNotMatch(html, /<script>x/);
});

test('errors are listed and navigation links appear between pages', () => {
  const html = renderIndex(page([], { page: 2, pages: 3 }), ['title is required']);
  assert.match(html, /title is required/);
  assert.match(html, /page=1/);
  assert.match(html, /page=3/);
});
