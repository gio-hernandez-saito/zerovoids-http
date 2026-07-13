# zerovoids-http

Monorepo for the `@zerovoids/http-*` package family. The published package is
**`@zerovoids/http-core`** (`packages/core`): a client-agnostic **error-normalization
layer** — it collapses every vendor's different error shape into one `NormalizedError`.
It is **not** an HTTP client; it sits on top of `fetch`/`ky`/`axios`/SDKs.

## Stack

pnpm + Turborepo · TypeScript 5.9 (`isolatedDeclarations: true`) · Biome 2.5.3 ·
tsdown (dual ESM/CJS, `attw` + `publint` gated) · Vitest · Changesets · lefthook +
commitlint · size-limit. Node 22+ (`.node-version` = 24).

## Layout

- `packages/core` → `@zerovoids/http-core`, the base of the family.
- `-core` follows the `@babel/core` model: extensions (vendor mappers, a retry layer)
  become sibling packages **only when real usage earns them**. The bare `@zerovoids/http`
  is intentionally unpublished; the monorepo root is private.

## Design principles

- **Layer, not client.** Never reimplement `fetch`/`ky`/`axios`; sit on top of them.
- **Normalize errors only.** Success-response shapes are the app's concern, not the library's.
- **Zero runtime dependencies.** Sit on standards without pulling weight.
- **Standards-grounded, honestly.** Every field maps to a cited standard (RFC 9457, gRPC
  codes, RFC 9110, ES2022 `Error.cause`, …). Never present an invented convention as a
  standard; label conventions (e.g. the retryable-status set) as conventions.
- **Minimal public surface.** Fewer things to learn is better. Don't add config knobs until
  a real need earns them — the mapper chain is the extension point.

## Git conventions

Enforced by `lefthook.yml` (branch name + commit-msg), `commitlint.config.js` (types/scopes),
and `.github/workflows/ci.yml` (PR title). This section is the guide for producing compliant work.

- **Branches**: `<type>/<kebab>` — e.g. `feat/rfc9457-mapper`. `main` is exempt.
- **Commits & PR titles**: `<type>(<scope>): <subject>` — imperative, lowercase, no trailing
  period. Append the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
  - **types**: feat · fix · docs · refactor · perf · test · chore · ci · build · revert
  - **scopes**: `core` (the package) · `deps` (dependency updates) · `repo` (repo-wide config/tooling)
    · `release` (versioning/publish) · `ci` (CI/CD)
  - When a new package is added, add its scope to `commitlint.config.js` (`scope-enum`) and here.
- **PR body template**:

  ```
  ## Summary
  ## Changes
  ## Testing
  ## Changeset   (only if a packages/* package changed)
  ```

## Changesets

Config: `.changeset/config.json` (access `public`). Changesets version & publish the
`packages/*` only.

- **When**: run `pnpm changeset` when a `packages/*` package changes in a way its consumers
  care about. For docs / CI / tooling with no release impact, run `pnpm changeset --empty`.
- **Bump levels** (pre-1.0 — the API is still stabilizing):
  - **patch** — bug fix or internal change; no public API change.
  - **minor** — a new feature **or a breaking change** (0.x lets breaking changes ship as minor).
  - Never silently decide a bump for a breaking change; call it out in the summary.
- **Flow**: change on a branch → `pnpm changeset` (package + bump + consumer-facing summary) →
  commit the `.changeset/*.md` in the same PR → on merge to `main`, the release workflow opens a
  "Version Packages" PR; merging that publishes to npm.

## Verification (run before claiming done)

From the repo root:

```
pnpm format                                  # biome check --write
pnpm --filter @zerovoids/http-core build     # tsdown → also runs attw + publint
pnpm --filter @zerovoids/http-core test      # vitest
pnpm --filter @zerovoids/http-core typecheck # tsc --noEmit
pnpm knip                                    # dead code / unused deps
pnpm turbo size                              # size-limit budget
pnpm lint                                    # biome check (a trailing "Found 1 info" is harmless)
```
