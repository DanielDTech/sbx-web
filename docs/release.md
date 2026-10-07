# Releasing sbx-web

**There is genuinely nothing to release from this repository today.**

That is the accurate state, not an omission:

- **No registry package.** `package.json` has no `publishConfig` and the package
  is not published to npm or any other registry. Nothing consumes sbx-web as a
  dependency — it is an application, and the only human-facing surface in the
  project, so there is no consumer to publish for.
- **No tag convention in use.** `git tag` is empty. Sibling repositories are
  consumed by git ref (sbx-web itself depends on
  `github:DanielDTech/sbx-lib#v0.1.1`), but nothing depends on sbx-web, so no
  ref has ever needed to be cut here.
- **Version `0.1.0` in `package.json`,** unchanged since the initial commit. It
  is not wired to anything: no script reads it, no artifact carries it.
- **No deploy target.** There is no Dockerfile or container definition, no
  hosting or platform configuration, no deploy workflow or environment
  manifest anywhere in the repository. The only GitHub Actions workflow is
  `.github/workflows/ci.yml`, which runs `npm install` and `npm test` and
  publishes and deploys nothing.

## What shipping actually looks like right now

Merging to `main` is the end of the pipeline. CI runs `npm install` and
`npm test` on Node 22 for every push to `main` and every pull request; a green
`main` is the deliverable. Running sbx-web means a person runs `npm start` on a
machine, as described in [`index.md`](index.md).

## What deploying would require

None of this exists yet; it would all have to be built and decided:

1. **A deploy target** — somewhere to run a long-lived Node >= 22 process.
   Nothing is chosen.
2. **A runtime artifact** — a container image or equivalent. There is no build
   step to produce one, and no Dockerfile.
3. **Configuration delivery** — a way to set `PORT`, `SBX_API_URL` and
   `SBX_API_KEY` in the target environment, and somewhere real to keep
   `SBX_API_KEY` as a secret rather than defaulting to `dev-key`.
4. **A reachable sbx-api**, which is blocked today: sbx-api pins
   `github:DanielDTech/sbx-core#v1.0.0` and that repository does not exist, so
   sbx-api cannot be installed or run. Deploying sbx-web with nothing to talk to
   would serve only its `502` page.
5. **A release convention** — a tagging and versioning scheme, and a workflow
   that builds and promotes an artifact on it.

Until those decisions are made, do not document or assume a release process
here. There is not one.
