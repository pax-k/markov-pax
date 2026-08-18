# 005: Define the Defense Tech Boundary and Catalog

Status: complete
Type: documentation
Owner: AI

Assumption basis: public-evidence-backed
Requirement basis: user-approved Defense Tech Example Suite plan
Reversibility: easy
Learning objective: Prove that the ten themes can be documented as safe synthetic model hypotheses without claiming operational validation.
Source under test: public U.S. Army, DARPA, NIST, and NATO sources listed in the approved plan

## Goal

Create `DEFENSE_TECH.md` as the authoritative model-selection, source, theme, and safety catalog.

## Non-Goals

- Do not add examples, SDK exports, dependencies, package entries, operational recommendations, or real defense data.

## Required Reading

- README.md
- IMPLEMENTATION_STATUS.md
- EXAMPLES_1.md
- EXAMPLES_2.md
- docs/execution-rules.md

## Acceptance Criteria

- [x] The catalog explains when to use each required model family.
- [x] The catalog links all ten planned executable example paths.
- [x] Public needs and project model hypotheses are clearly separated.
- [x] All synthetic and safety exclusions are explicit.
- [x] Primary Army, DARPA, NIST, and NATO sources are linked.

## Baseline Evidence

The repository has no `DEFENSE_TECH.md` and no `examples/defense-tech/` collection.

## Verification

- `bun scripts/check-docs.ts` after the checker is extended in Task 008
- Manual source, hypothesis, link, and safety-boundary review

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-18 | Catalog marker and example-path inspection | pass | Required sources, hypothesis labels, safety terms, and ten unique paths are present. |

## Files Changed

- DEFENSE_TECH.md

## Verification Summary

- Targeted catalog inspection passed. Link existence is deferred until Tasks 006-008 create and enforce all example paths.

## Learning Notes

- Proved: The catalog separates public needs from project hypotheses and states the full synthetic-use boundary.
- Simulated: All example data and mappings.
- Test next: Whether current public primitives support each documented claim.

## Skill Trial Notes

- Source comparison: not applicable
- Contract markers checked: synthetic data, hypothesis labels, excluded uses
- Trial status: pass

## Blockers

- None.

## Follow-Ups

- Task 006 is ready.
