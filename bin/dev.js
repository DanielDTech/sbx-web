// Isolated development harness: the real sbx-web server against an in-memory
// stub of the sbx-api client, so every pathway this repo owns can be opened in
// a browser with no API and no network. Not a fake API, just enough of one.
import { createServer } from '../src/server.js';

const seed = [
  { id: 1, title: 'Node.js docs', url: 'https://nodejs.org/docs', tags: ['node', 'docs'], createdAt: '2026-10-01T09:00:00.000Z' },
  { id: 2, title: 'MDN web docs', url: 'https://developer.mozilla.org', tags: ['web', 'reference'], createdAt: '2026-10-02T09:00:00.000Z', note: 'The one I actually reach for' },
  { id: 3, title: 'A <script>alert(1)</script> title', url: 'https://example.com/?a=1&b=2', tags: ['escaping'], createdAt: '2026-10-03T09:00:00.000Z', note: 'A note that is also <script>alert(2)</script> trying it on' },
  { id: 4, title: 'sbx-lib', url: 'https://github.com/DanielDTech/sbx-lib', tags: ['sbx'], createdAt: '2026-10-04T09:00:00.000Z' },
];

const PER_PAGE = 2; // stub pagination: fixed page size over one array

export function createStubClient(bookmarks = seed.map((b) => ({ ...b }))) {
  return {
    async listBookmarks(page = 1) {
      const pages = Math.max(1, Math.ceil(bookmarks.length / PER_PAGE));
      const start = (page - 1) * PER_PAGE;
      return { items: bookmarks.slice(start, start + PER_PAGE), page, pages, total: bookmarks.length };
    },
    async addBookmark(fields) {
      const bookmark = { id: bookmarks.length + 1, ...fields, createdAt: new Date().toISOString() };
      bookmarks.push(bookmark);
      return bookmark;
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4701);
  createServer({ client: createStubClient() }).listen(port, () => console.log(`sbx-web dev harness (stub API, in memory) on http://localhost:${port}`));
}
