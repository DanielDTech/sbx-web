import { formatDate, formatTags } from 'sbx-lib';

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);

const describeTotal = (total) =>
  Number.isInteger(total) && total >= 0 ? `${total} bookmark${total === 1 ? '' : 's'}` : 'count unavailable';

export function renderIndex({ items, page, pages, total }, errors = []) {
  const rows = items.map((b) => `<li><a href="${escapeHtml(b.url)}">${escapeHtml(b.title)}</a> <small>${formatDate(b.createdAt)} ${escapeHtml(formatTags(b.tags))}</small></li>`).join('');
  const errorList = errors.length ? `<ul class="errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : '';
  const nav = [page > 1 ? `<a href="/?page=${page - 1}">Previous</a>` : '', page < pages ? `<a href="/?page=${page + 1}">Next</a>` : ''].join(' ');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bookmarks</title></head><body><header><h1>Bookmarks</h1><p class="count">${escapeHtml(describeTotal(total))}</p></header>${errorList}<form method="post" action="/add"><input name="title" placeholder="Title"><input name="url" placeholder="https://"><input name="tags" placeholder="tags, comma separated"><button>Add</button></form><ul>${rows}</ul><nav>${nav}</nav></body></html>`;
}
