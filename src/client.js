export function createClient({ baseUrl, apiKey, fetch = globalThis.fetch }) {
  const call = async (path, init = {}) => {
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'x-api-key': apiKey, 'content-type': 'application/json' } });
    const body = res.status === 204 ? null : await res.json();
    if (!res.ok) {
      const err = new Error(`API answered ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  };
  return {
    listBookmarks: (page = 1) => call(`/bookmarks?page=${page}`),
    addBookmark: (fields) => call('/bookmarks', { method: 'POST', body: JSON.stringify(fields) }),
  };
}
