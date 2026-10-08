import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderFailure, renderIndex, SBX_LIB_NOTE_MAX_CODE_UNITS } from '../src/ui/pages.js';

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

test('the failure page escapes its detail, so no caller can put a tag on it', () => {
  const detail = '<svg onload=top.z=1>';
  const page = renderFailure(detail);
  assert.ok(page.includes('The bookmarks API failed'));
  for (const opening of ['<svg', '<script', '<iframe', '<img']) assert.ok(!page.includes(opening));
  assert.ok(!page.includes(detail));
});

const PAYLOAD_TAG_OPENINGS = ['<script', '<svg', '<iframe', '<img'];
const noted = (note) => ({ id: 1, title: 'Docs', url: 'https://a.com', tags: ['node'], createdAt: '2026-10-07T00:00:00.000Z', note });
const rowOf = (html) => html.match(/<li>.*?<\/li>/s)[0];
const noteOf = (html) => html.match(/<p class="note">(.*?)<\/p>/s)?.[1];

test('a note carrying markup is rendered in its row as text and creates no element', () => {
  const note = '<script>alert(1)</script>';
  const html = renderIndex(page([noted(note)]));
  assert.ok(rowOf(html).includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'the escaped note is missing from the row');
  for (const opening of PAYLOAD_TAG_OPENINGS) assert.ok(!html.includes(opening), `the page opens a tag from the note (${opening})`);
  assert.ok(!html.includes(note), 'the page carries the note as one contiguous unescaped run');
});

test('a note of no substance renders no note element, and never undefined or NaN', () => {
  for (const note of [undefined, '', '   ']) {
    const item = noted(note);
    if (note === undefined) delete item.note;
    const html = renderIndex(page([item]));
    assert.ok(!html.includes('class="note"'), `a note element was rendered for ${JSON.stringify(note)}`);
    assert.doesNotMatch(html, /undefined/);
    assert.doesNotMatch(html, /NaN/);
  }
});

test('a note of the maximum length renders in full, untruncated and byte for byte', () => {
  for (const note of ['a'.repeat(SBX_LIB_NOTE_MAX_CODE_UNITS), '\u{1f642}'.repeat(SBX_LIB_NOTE_MAX_CODE_UNITS / 2)]) {
    assert.equal(note.length, SBX_LIB_NOTE_MAX_CODE_UNITS);
    assert.equal(noteOf(renderIndex(page([noted(note)]))), note);
  }
});

test('a note is rendered as typed, with its surrounding whitespace kept', () => {
  assert.equal(noteOf(renderIndex(page([noted('  spaced out  ')]))), '  spaced out  ');
});

test('the note input takes its maxlength from the constant that names sbx-lib as the owner of the number', () => {
  assert.equal(SBX_LIB_NOTE_MAX_CODE_UNITS, 500);
  assert.ok(renderIndex(page([])).includes(`maxlength="${SBX_LIB_NOTE_MAX_CODE_UNITS}"`), 'the note input carries no maxlength from the constant');
});

test('the note input interpolates the cap from the constant instead of carrying the number as a literal', () => {
  const source = readFileSync(new URL('../src/ui/pages.js', import.meta.url), 'utf8');
  const input = source.match(/<textarea name="note"[^>]*>/)[0];
  assert.match(input, /maxlength="\$\{SBX_LIB_NOTE_MAX_CODE_UNITS\}"/, 'the maxlength is not interpolated from the constant');
  assert.doesNotMatch(input, new RegExp(`maxlength="${SBX_LIB_NOTE_MAX_CODE_UNITS}"`), 'the maxlength is a literal in the markup');
});
