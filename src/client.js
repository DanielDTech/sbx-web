const UNPARSEABLE = Symbol('body that is not JSON');

const parseJson = (text) => {
  try { return JSON.parse(text); } catch { return UNPARSEABLE; }
};

const apiError = (message, status, body) => Object.assign(new Error(message), { status, body });

export function createClient({ baseUrl, apiKey, fetch = globalThis.fetch }) {
  const call = async (path, init = {}) => {
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'x-api-key': apiKey, 'content-type': 'application/json' } });
    if (res.status === 204) return null;
    const parsed = parseJson(await res.text());
    const body = parsed === UNPARSEABLE ? null : parsed;
    if (!res.ok) throw apiError(`API answered ${res.status}`, res.status, body);
    if (parsed === UNPARSEABLE) throw apiError(`API answered ${res.status} with a body that is not JSON`, res.status, body);
    return body;
  };
  return {
    listBookmarks: (page = 1) => call(`/bookmarks?page=${page}`),
    addBookmark: (fields) => call('/bookmarks', { method: 'POST', body: JSON.stringify(fields) }),
  };
}
