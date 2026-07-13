---
"@zerovoids/http-core": minor
---

Add `graphqlMapper` — a prebuilt mapper for GraphQL error responses (`{ errors: [{ message, extensions }] }`, per the GraphQL spec §7). It derives `code` from the first error's `extensions.code`, classifies a 200-with-errors response as `domain`, and preserves the full response (every error, its `locations`/`path`, and any partial `data`) on `cause`.
