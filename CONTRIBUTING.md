# Contributing

Use Bun for local work.

## Set up

```sh
bun install
bun run check
```

## Make a change

1. Keep the change small and related to one problem.
2. Add or update a test for observable behavior.
3. Run the smallest related test first.
4. Run `bun run check` before review.
5. Update documentation when the public API or a claim changes.

Do not weaken validation, types, coverage, or error handling to make a check pass. Do not add a domain claim without executable evidence. Add a primary source for each dated or numerical research claim.

## Style

- Follow the existing TypeScript and test patterns.
- Validate input at public boundaries.
- Prefer direct code over a new abstraction unless several current cases need it.
- Use deterministic random-number sources in tests.

## Release changes

Do not publish from a contribution branch. A maintainer must review the package contents, changelog, clean-consumer test, and release tag before publication.
