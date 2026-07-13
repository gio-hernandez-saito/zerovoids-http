# Changesets

This folder holds [changesets](https://github.com/changesets/changesets) — one
markdown file per set of changes that should ship together. Each records which
packages bump, at what semver level, and why.

Add one when you change a published package:

```bash
pnpm changeset
```

Pick the packages and bump level, then write a summary — that summary becomes the
changelog entry. Changesets are consumed and deleted when a release is versioned.
