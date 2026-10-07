# sbx-web

sbx-web is the server-rendered web app for sbx bookmarks. It renders the bookmark
list and the add-bookmark form as HTML on the server and talks to sbx-api over
HTTP. It is the **only human-facing surface in the sbx project** — sbx-api is a
machine interface and sbx-lib is a library — so every change a person can see
lands here.

Delivery platform: **web**. This is where the project's web QA validates.

## Areas

The code separates by its own concerns, and the files are small and change
together, so treat all of it as **one area of ownership: the web app**. The
boundaries below are how the code is organised internally, not four separately
owned things.

### client — `src/client.js`

Owns all access to sbx-api; nothing else in the repository speaks HTTP to the
API. `createClient({ baseUrl, apiKey, fetch })` returns `listBookmarks(page)`
and `addBookmark(fields)`. It sends the `x-api-key` header, and it turns any
non-OK response into an `Error` carrying `status` and `body` so callers can
react to a failure rather than parse one. `fetch` is injectable, which is what
makes the client testable in isolation with no network.

### ui — `src/ui/pages.js`

Owns rendering and HTML escaping. `renderIndex({ items, page, pages }, errors)`
builds the whole page: the heading, the error list, the add form, the bookmark
rows and the previous/next navigation. `escapeHtml` escapes the five HTML
entities (`&`, `<`, `>`, `"`, `'`). **This area owns the escaping of every
untrusted value** — bookmark titles, urls, tags and validation messages all
reach the browser through here.

### server — `src/server.js`

Owns routing and request handling: `GET /` and `POST /add`. It reads the
urlencoded form body, splits the comma-separated `tags` field into a list,
validates the result with sbx-lib's `validateBookmark`, redirects `303` to `/`
on success, re-renders the page with the errors as `422` on invalid input, and
turns any thrown API error into a `502` page rather than a crash.

### process entry — `bin/start.js`

Owns the process: reads `PORT`, `SBX_API_URL` and `SBX_API_KEY`, constructs the
client and hands it to the server. **Configuration lives only here** — nothing
under `src/` reads `process.env`.

## Build, run and test

There is **no build step**. The repository is plain ES modules (`"type":
"module"`) run directly by Node. Node **>= 22** is required; verified on
v24.21.0.

```
npm install     # installs the single dependency, sbx-lib, from GitHub
npm test        # node --test — 10 tests, all green
npm start       # node bin/start.js
```

`npm start` reads three environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4700` | port sbx-web listens on |
| `SBX_API_URL` | `http://localhost:4600` | base url of sbx-api |
| `SBX_API_KEY` | `dev-key` | value sent as the `x-api-key` header |

CI (`.github/workflows/ci.yml`) runs `npm install` then `npm test` on Node 22
for **every push to `main` and every pull request**. There is no lint step and
no other job.

## Dependencies and who owns what

Test only what this repository owns. The table below is the line.

| Dependency | Owns | So this repo must not test |
| --- | --- | --- |
| `sbx-lib` (`github:DanielDTech/sbx-lib#v0.1.1`) | Bookmark validation rules (`validateBookmark`) and the date and tag formatting (`formatDate`, `formatTags`) | The validation rules themselves, or date/tag formatting rules. Test only that sbx-web calls them and renders what they return. |
| `sbx-api` (over HTTP, not a package) | Bookmark storage, pagination and url normalization | Storage, paging arithmetic or normalization behaviour. Test only how sbx-web behaves against the answers and failures the API gives it. |
| `node:http` | The HTTP server | Node's own HTTP implementation. |
| global `fetch` | The HTTP client | Node's own fetch. In tests it is injected, so no test should reach the network. |

`sbx-lib` is the **only** runtime dependency in `package.json`. There are no dev
dependencies: the test runner is `node --test`, built into Node.

## Local environment

The point of the local environment is fast iteration on sbx-web **in
isolation**, without standing up anything else. All commands below were run and
verified from the repository root.

### Unit tests

```
npm install
npm test
```

10 tests, all green, no network. `test/client.test.js` injects a fake `fetch`,
`test/pages.test.js` calls `renderIndex` directly, `test/server.test.js` and
`test/dev.test.js` start the real server on port 0 with a stub client.

### Isolated stub harness — the whole UI in a browser, with no API

```
npm run dev          # node bin/dev.js, http://localhost:4701
PORT=4800 npm run dev
```

`bin/dev.js` starts the **real** `createServer` from `src/server.js` against an
in-memory stub client that implements `listBookmarks` and `addBookmark` over an
array seeded with four bookmarks. No API, no network, no state on disk. It
listens on `PORT`, **default 4701**, so it never collides with `npm start` on
4700. Restarting it resets the data.

It covers every pathway sbx-web owns, each verified by hand:

- the bookmark list, with dates and `#tags` rendered through sbx-lib
- the pagination links — the stub pages two bookmarks at a time, so `/` shows
  "Next" and `/?page=2` shows "Previous"
- the add form, and a valid submission redirecting `303` to `/`
- validation errors — posting an empty title renders `422` with the error list
- escaping — one seeded bookmark has `<script>alert(1)</script>` in its title and
  an `&` in its url, and both arrive escaped

It does **not** cover: anything sbx-api owns. The stub's pagination is a fixed
page size over one array and is deliberately, obviously a stub; there is no url
normalization, no persistence, no duplicate detection and no API error
simulation. Nothing about real API behaviour can be learned from it.

### `npm start` against a real API

```
npm install
SBX_API_URL=http://localhost:4600 SBX_API_KEY=dev-key npm start
```

This needs a running sbx-api reachable at `SBX_API_URL` and accepting
`SBX_API_KEY`. With no API listening, `GET /` returns the `502` page — which is
correct behaviour, not a crash, but it is not the UI.

### Known limitation: the real end-to-end path is blocked

**sbx-api cannot be installed or run at all today.** Its `package.json` pins
`"sbx-core": "github:DanielDTech/sbx-core#v1.0.0"`, and the repository
`DanielDTech/sbx-core` **does not exist on GitHub** — `gh repo view
DanielDTech/sbx-core` fails to resolve it. `npm install` in sbx-api therefore
cannot complete, so sbx-api cannot start.

What this blocks: nobody can currently exercise sbx-web end to end against a
real API. That means the real request path through `src/client.js` (the
`x-api-key` header on the wire, real response shapes, real failure modes), real
pagination over stored bookmarks, and real url normalization are all unverified
against the real thing. Everything sbx-web itself owns is still fully
exercisable — that is what `npm test` and `npm run dev` are for — but the
integration seam is not. Unblocking it requires the `sbx-core` dependency to be
resolved in sbx-api; it is not something sbx-web can fix from here, and the
stub harness is not a substitute for it.
