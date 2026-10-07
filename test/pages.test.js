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

const headerOf = (html) => html.match(/<header>.*?<\/header>/s)[0];

const bookmark = { id: 1, title: 'Docs', url: 'https://a.com', tags: ['node'], createdAt: '2026-10-07T00:00:00.000Z' };

test('the header reports the total the API gave, not the number of rows on the page', () => {
  const header = headerOf(renderIndex(page([bookmark, { ...bookmark, id: 2 }], { total: 7, pages: 4 })));
  assert.match(header, /7 bookmarks/);
  assert.doesNotMatch(header, /2 bookmarks/);
});

test('the header says bookmark in the singular for a total of one', () => {
  assert.match(headerOf(renderIndex(page([bookmark], { total: 1 }))), /1 bookmark(?!s)/);
});

test('the header says bookmarks for a total of none', () => {
  assert.match(headerOf(renderIndex(page([], { total: 0 }))), /0 bookmarks/);
});

test('a missing or non-numeric total is reported as unavailable, never as undefined or NaN', () => {
  for (const total of [undefined, '<script>']) {
    const html = renderIndex({ items: [], page: 1, pages: 1, total });
    assert.match(headerOf(html), /count unavailable/);
    assert.doesNotMatch(html, /undefined/);
    assert.doesNotMatch(html, /NaN/);
    assert.doesNotMatch(html, /<script>/);
  }
});
