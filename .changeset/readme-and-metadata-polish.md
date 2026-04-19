---
"@zerovoids/http": patch
"@zerovoids/http-react-query": patch
"@zerovoids/http-swr": patch
"@zerovoids/http-transport-ky": patch
"@zerovoids/http-transport-axios": patch
"@zerovoids/http-auth": patch
"@zerovoids/http-mock": patch
---

Polish package metadata and per-package READMEs.

- Each package now carries `homepage` and `bugs.url` so the npm page
  sidebar links to the repo subdir README and the GitHub Issues tab.
- Per-package READMEs rewritten to match the root README presentation:
  centered header, badge row (npm · downloads · license · types),
  navigation links, and emoji section markers. Content coverage is
  equivalent to the prior technical-only READMEs plus consistent
  cross-links to ADRs, guides, and the main README.

No code or public API changes.
