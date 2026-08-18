# 004: Add Release Enforcement and Run Final Proof

Status: complete
Type: validation
Owner: AI

Assumption basis: founder-claimed
Requirement basis: approved release-ready-only boundary
Reversibility: easy
Learning objective: Prove that one command and CI enforce the public release contract.
Source under test: repo-local path

## Goal

Add CI and final release checks, then prove the complete repair from the repository boundary.

## Non-Goals

- Publish, tag, push, or commit.
- Add a production deployment.

## Required Reading

- `AGENTS.md`
- `docs/execution-rules.md`
- `package.json`

## Acceptance Criteria

- [x] GitHub CI runs frozen install, checks, build, and package proof.
- [x] A manual finite-scale benchmark exists and is documented.
- [x] `bun run check` passes from the final worktree.
- [x] Final diff contains no unrelated changes or generated output.

## Baseline Evidence

No CI or package release gate exists.

## Verification

- `bun install --frozen-lockfile`
- `bun run check`
- `bun run benchmark`
- `git status --short`

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-18 | `bun install --frozen-lockfile` | Pass | 5 installs across 6 packages; no lockfile or dependency change. |
| 2026-08-18 | `bun run benchmark` | Pass | 4,095 trace windows and 2,509 conductance candidates at 12 states. |
| 2026-08-18 | `bun run check` | Pass | Types, 239 tests, 100% coverage, 10 documents, build, declarations, pack, clean install, consumer typecheck, and consumer runtime pass. |
| 2026-08-18 | `git diff --check` and `git status --short` | Pass | No whitespace errors and no generated `dist` output in the worktree. All listed changes belong to this repair. |

## Files Changed

- `.github/workflows/ci.yml`
- `BENCHMARKS.md`
- `scripts/benchmark.ts`
- `scripts/check-docs.ts`
- `package.json`
- `README.md`
- `docs/blueprint-status.md`
- `tasks/sprint-1.md`
- `tasks/issues/004-release-enforcement.md`

## Verification Summary

- The local equivalent of every CI command passes. Hosted GitHub Actions remains unverified until the files are committed and pushed.

## Learning Notes

- Proved: One local command enforces source, coverage, documentation, build, declaration, package-content, clean-install, type, and runtime checks.
- Proved: The finite-scale benchmark completes and checks its output counts.
- Simulated: Hosted GitHub Actions execution; its exact commands passed locally.
- Test next: Hosted CI after an authorized commit and push.

## Skill Trial Notes

- Source comparison: not applicable
- Contract markers checked: n/a
- Trial status: n/a

## Blockers

- None.

## Follow-Ups

- None.
