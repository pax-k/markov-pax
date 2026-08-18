# 003: Repair Documentation and Research Evidence

Status: complete
Type: documentation
Owner: AI

Assumption basis: founder-claimed
Requirement basis: approved public SDK documentation and research-boundary plan
Reversibility: easy
Learning objective: Prove that product claims match executable evidence and primary sources.
Source under test: repo-local path and public primary sources

## Goal

Replace starter documentation, add an implementation status map, and repair research citations and boundaries.

## Non-Goals

- Implement the eight incomplete domain workflows.
- Claim unproved physics, consciousness, UAP, or trace-logic AI results.

## Required Reading

- `AGENTS.md`
- `EXAMPLES_1.md`
- `EXAMPLES_2.md`
- `THEORY.md`

## Acceptance Criteria

- [x] README explains the SDK, usage, proof, limits, and research boundary.
- [x] Every main example area and trace claim has an honest implementation status.
- [x] Dated or numerical research claims have primary sources or are removed.
- [x] THEORY separates implemented and proposed APIs.
- [x] License, changelog, contribution, and security documents exist.

## Baseline Evidence

README is Bun starter text. EXAMPLES_1 has lost citation markers. No implementation status document exists.

## Verification

- `bun run check:docs`
- `bun run check`

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-18 | `bun run check:docs` | Pass | 9 required documents and 14 direct evidence paths; all root-document local links resolve. |
| 2026-08-18 | `bun run typecheck` | Pass | Documentation checker and SDK compile without errors. |
| 2026-08-18 | `bun run check` | Pass | 239 tests, 1,427 expectations, 100% function and line coverage. |

## Files Changed

- `README.md`
- `IMPLEMENTATION_STATUS.md`
- `EXAMPLES_1.md`
- `EXAMPLES_2.md`
- `THEORY.md`
- `LICENSE`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `scripts/check-docs.ts`
- `package.json`

## Verification Summary

- Documentation, types, and the complete behavior and coverage check pass.

## Learning Notes

- Proved: The documentation now points to current APIs and existing evidence files.
- Proved: Unsupported research numbers were removed; retained dated and numerical claims have primary-source links.
- Simulated: Domain examples still use synthetic data and do not prove external domain validity.
- Test next: CI and final release automation in task 004.

## Skill Trial Notes

- Source comparison: not applicable
- Contract markers checked: n/a
- Trial status: n/a

## Blockers

- None.

## Follow-Ups

- Task 004 after this task passes.
