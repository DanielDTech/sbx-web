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

It reads the response as text and parses it itself, and it decides on the
status before it needs the parsed body. **`err.body` is the parsed body when
the response body is JSON, and `null` when it is not** — a non-JSON error body
is reported as `null` rather than as a raw string, so a caller reading
`err.body` gets either an object it can use or nothing. The status is on
`err.status` either way. **No byte of a response body ever reaches
`err.message`**, which is only ever the client's own `API answered <status>`,
or `API answered <status> with a body that is not JSON` when an otherwise OK
response could not be parsed. That matters because a parse failure's own
message quotes the offending input verbatim: letting one become an error
message put an API response body on a user's page (#5).

### ui — `src/ui/pages.js`

Owns rendering and HTML escaping. `renderIndex({ items, page, pages, total },
errors)` builds the whole page: the heading, the total bookmark count beside it,
the error list, the add form, the bookmark rows and the previous/next
navigation. `escapeHtml` escapes the five HTML entities (`&`, `<`, `>`, `"`,
`'`). **This area owns the escaping of every untrusted value** — bookmark
titles, urls, tags, validation messages and error detail all reach the browser
through here.

`renderFailure(detail)` builds the `502` page: the app's own sentence, `The
bookmarks API failed`, followed by the detail escaped. Nothing renders the
failure page anywhere else, and no caller can put a tag on it however the
detail was composed (#5).

The header count is the `total` the API reported, not the number of rows on the
page, so it reads the same on every page: `7 bookmarks`, `1 bookmark`,
`0 bookmarks`. A `total` that is not a whole number of zero or more — absent, or
any other type — renders `count unavailable` rather than `undefined` or `NaN`.
The `502` page carries no count at all: when the API cannot be reached there is
no total to report, and a stale or invented number would be worse than none.

### server — `src/server.js`

Owns routing and request handling: `GET /` and `POST /add`. It reads the
urlencoded form body, splits the comma-separated `tags` field into a list,
validates the result with sbx-lib's `validateBookmark`, redirects `303` to `/`
on success, re-renders the page with the errors as `422` on invalid input, and
turns any thrown API error into a `502` page rather than a crash. It composes
no HTML of its own: the `502` goes through `renderFailure`, so the error detail
is escaped by the area that owns escaping. An invalid submission becomes a
`502` rather than a `422` when the API is unreachable, because re-rendering the
form needs the bookmark list.

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
npm test        # node --test — 27 tests, all green
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
| `sbx-lib` (`github:DanielDTech/sbx-lib#v0.1.2`) | Bookmark validation rules (`validateBookmark`) and the date and tag formatting (`formatDate`, `formatTags`) | The validation rules themselves, or date/tag formatting rules. Test only that sbx-web calls them and renders what they return. |
| `sbx-api` (over HTTP, not a package) | Bookmark storage and pagination. **Url normalization is not sbx-api's own** — sbx-api delegates it to `sbx-core` (`github:DanielDTech/sbx-core#v1.0.0`, maintained outside the sbx project), whose `normalizeUrl` lowercases the host, drops a default port, drops the fragment and drops a bare trailing slash | Storage, paging arithmetic or normalization behaviour. Normalization is two repositories away, behind sbx-api in sbx-core; test none of it. Test only how sbx-web behaves against the answers and failures the API gives it. |
| `node:http` | The HTTP server | Node's own HTTP implementation. |
| global `fetch` | The HTTP client | Node's own fetch. In tests it is injected, so no test should reach the network. |

`sbx-lib` is the **only** runtime dependency in `package.json`. There are no dev
dependencies: the test runner is `node --test`, built into Node.

## Local environment

The local environment has two modes: fast iteration on sbx-web **in
isolation**, without standing up anything else, and the integrated end-to-end
path against a real sbx-api. All commands below were run and verified from the
repository root.

### Unit tests

```
npm install
npm test
```

27 tests, all green, no network. `test/client.test.js` injects a fake `fetch`,
`test/pages.test.js` calls `renderIndex` and `renderFailure` directly,
`test/server.test.js` and `test/dev.test.js` start the real server on port 0
with a stub client, and `test/failure.test.js` puts the real client and the
real server in front of a stand-in API on port 0 that answers with bodies that
are not JSON — the gateway or proxy case sbx-api will not produce itself, and
the one that needs both processes rather than a stub.

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
- the header count — the stub reports a total of four, so every page reads
  `4 bookmarks` however many rows it shows
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

### End to end against a real sbx-api

This is the **only path that exercises all three repositories together** —
sbx-web, sbx-api, and sbx-core behind sbx-api — and it is **the path the
project's web QA validates on**. Everything below was run and verified from the
repository root.

Two terminals. The data file is a throwaway under `/tmp` so nobody dirties
sbx-api's own `data/` directory.

Terminal 1 — sbx-api:

```
cd ../sbx-api
npm install
mkdir -p /tmp/sbx-e2e
PORT=4601 SBX_DATA_FILE=/tmp/sbx-e2e/bookmarks.json SBX_API_KEYS=e2e-key npm start
```

Terminal 2 — sbx-web:

```
npm install
PORT=4701 SBX_API_URL=http://localhost:4601 SBX_API_KEY=e2e-key npm start
```

Both ports are deliberately off the defaults (4600 and 4700) so this pair never
collides with anything already running, including the stub harness on 4701 —
stop the harness first if it is up. `SBX_API_KEYS` on the API side is a
comma-separated list of accepted keys; `SBX_API_KEY` on the web side is the
single key sbx-web sends as `x-api-key`. **The two must agree** or every page is
the `502`.

Then open `http://localhost:4701`. A correct result looks like this:

- `GET /` is `200`. The store starts empty, so the list is empty and only the
  add form renders, and the header is expected to read `0 bookmarks`.
- Submitting the add form — title `From Web`, url `https://nodejs.org/`, tags
  `node` — redirects **`303`** to `/`.
- `GET /` now renders the live bookmark, with the date and the `#tags` coming
  from sbx-lib's `formatDate` and `formatTags` over **real API data**:

  ```
  <li><a href="https://nodejs.org">From Web</a> <small>2026-10-07 #node</small></li>
  ```

  and the header is expected to read `1 bookmark`. The header count comes from
  the `total` field of the API's own list response, so it is the one number on
  the page to check against the `GET /bookmarks` call below rather than against
  the visible rows. The two header expectations here are the only lines in this
  section not observed on the run that produced it: the live header count is
  validated by web QA against issue #3, not from an engineer's session.

- The bookmark is really in the API, not in sbx-web:

  ```
  curl -s http://localhost:4601/bookmarks -H 'x-api-key: e2e-key'
  ```

  lists it — and its url is stored normalized, `https://nodejs.org` for the
  `https://nodejs.org/` that was posted. That normalization belongs to
  **sbx-core, behind sbx-api, two repositories away**: see the dependency table
  above, and do not test it here.
- Invalid input still behaves: posting an empty title renders `422` with the
  error list, now through the real client rather than a stub.

When you are done, stop both processes and `rm -rf /tmp/sbx-e2e`.

### Which one to reach for

Both local paths matter and neither replaces the other:

- **The stub harness (`npm run dev`)** — fast isolated iteration, no API and no
  network. Reach for it for **interface work**: rendering, escaping, routing,
  pagination links, validation messages. Nothing about real API behaviour can be
  learned from it.
- **End to end against a real sbx-api** — the integrated path. Reach for it for
  **anything touching `src/client.js` or the API contract**: the `x-api-key`
  header on the wire, real response shapes, real failure modes, real stored
  data.
