import { createServer as createHttpServer } from 'node:http';
import { validateBookmark } from 'sbx-lib';
import { renderIndex } from './ui/pages.js';

const readForm = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', (chunk) => { data += chunk; });
  req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(data))));
});

const html = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
};

export function createServer({ client }) {
  return createHttpServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/') return html(res, 200, renderIndex(await client.listBookmarks(Number(url.searchParams.get('page')) || 1)));
      if (req.method === 'POST' && url.pathname === '/add') {
        const input = await readForm(req);
        const fields = { title: input.title ?? '', url: input.url ?? '', tags: (input.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean) };
        const check = validateBookmark(fields);
        if (!check.ok) return html(res, 422, renderIndex(await client.listBookmarks(1), check.errors));
        await client.addBookmark(fields);
        res.writeHead(303, { location: '/' });
        return res.end();
      }
      return html(res, 404, 'Not found');
    } catch (err) {
      return html(res, 502, `The bookmarks API failed: ${err.message}`);
    }
  });
}
