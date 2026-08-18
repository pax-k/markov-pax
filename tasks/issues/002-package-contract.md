# 002: Build the Public Package Contract

Status: complete
Type: implementation
Owner: AI

Assumption basis: founder-claimed
Requirement basis: approved Bun-first ESM 0.1.0 release-ready plan
Reversibility: easy
Learning objective: Prove that a clean consumer can install, type-check, and run the packed SDK.
Source under test: repo-local path

## Goal

Add the package metadata, ESM build, type declarations, and packed-consumer proof.

## Non-Goals

- Publish the package.
- Promise Node.js compatibility.

## Required Reading

- `AGENTS.md`
- `docs/execution-rules.md`
- `package.json`

## Acceptance Criteria

- [x] Package metadata defines version 0.1.0, MIT, Pax, ESM exports, types, and published files.
- [x] Build creates ESM JavaScript and declarations under `dist`.
- [x] A temporary consumer installs the packed package and runs a forecast.
- [x] Generated output stays untracked.

## Baseline Evidence

The package is private and has no version, exports map, declaration output, or consumer test.

## Verification

- `bun run build`
- `bun run test:package`

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-18 | `bun run build` | pass | Built one ESM bundle and public declarations. |
| 2026-08-18 | `bun run test:package` | pass | Packed 43 allowed files; temporary consumer type-checked and ran a forecast. |
| 2026-08-18 | Bun bundler, package-manager, and publish documentation | pass | Confirmed ESM build, `bun pm pack`, and dry-run behavior against current primary docs. |

## Files Changed

- `package.json` - added the public 0.1.0 package contract and build scripts.
- `bun.lock` - moved TypeScript to a pinned development dependency.
- `tsconfig.build.json` - added declaration-only output.
- `scripts/rewrite-declaration-imports.ts` - changed declaration imports to standard JavaScript paths.
- `scripts/test-package.ts` - added a packed-consumer contract test.

## Verification Summary

- `bun run build` passed.
- `bun run test:package` passed.

## Learning Notes

- Proved: The package builds, packs only allowed files, type-checks in a temporary consumer, and runs through its public root export.
- Simulated: Registry publication.
- Test next: Documentation and release metadata completeness in task 003.

## Skill Trial Notes

- Source comparison: not applicable
- Contract markers checked: n/a
- Trial status: n/a

## Blockers

- None.

## Follow-Ups

- Task 003 after this task passes.
