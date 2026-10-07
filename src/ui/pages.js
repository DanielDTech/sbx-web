import { formatDate, formatTags } from 'sbx-lib';

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);

export function renderIndex({ items, page, pages }, errors = []) {
  const rows = items.map((b) => `<li><a href="${escapeHtml(b.url)}">${escapeHtml(b.title)}</a> <small>${formatDate(b.createdAt)} ${escapeHtml(formatTags(b.tags))}</small></li>`).join('');
  const errorList = errors.length ? `<ul class="errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : '';
  const nav = [page > 1 ? `<a href="/?page=${page - 1}">Previous</a>` : '', page < pages ? `<a href="/?page=${page + 1}">Next</a>` : ''].join(' ');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bookmarks</title></head><body><header><h1>Bookmarks</h1></header>${errorList}<form method="post" action="/add"><input name="title" placeholder="Title"><input name="url" placeholder="https://"><input name="tags" placeholder="tags, comma separated"><button>Add</button></form><ul>${rows}</ul><nav>${nav}</nav></body></html>`;
}
