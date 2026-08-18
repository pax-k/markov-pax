# 006: Add Defense Tech Examples One to Five

Status: complete
Type: implementation
Owner: AI

Assumption basis: repo-evidence-backed
Requirement basis: user-approved Defense Tech Example Suite plan
Reversibility: easy
Learning objective: Prove that the current public API can express the first five synthetic themes with deterministic behavioral evidence.
Source under test: ../../index.ts public exports

## Goal

Add focused executable examples for asset readiness, logistics, autonomy assurance, cyber assurance, and multi-sensor estimation.

## Non-Goals

- Do not change SDK semantics, exports, dependencies, package entries, or the safety boundary.

## Required Reading

- DEFENSE_TECH.md
- examples/real-world/operations-and-reliability.test.ts
- examples/real-world/supply-chain-control.test.ts
- examples/real-world/fraud-kill-chain.test.ts

## Acceptance Criteria

- [x] Five named-domain examples pass with Bun.
- [x] Beliefs are normalized and required policy outcomes are asserted.
- [x] Stochastic simulations use `SeededRng`.
- [x] Costs and constrained policies remain feasible.

## Baseline Evidence

Task 005 defines the claims and safety boundary; the five example files do not exist.

## Verification

- `bun test examples/defense-tech/asset-health-and-readiness.test.ts examples/defense-tech/contested-logistics-and-sustainment.test.ts examples/defense-tech/autonomy-assurance.test.ts examples/defense-tech/cyber-mission-assurance.test.ts examples/defense-tech/multi-sensor-state-estimation.test.ts`

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-18 | Focused five-file Bun test | pass | 5 tests and 26 assertions passed. |

## Files Changed

- examples/defense-tech/asset-health-and-readiness.test.ts
- examples/defense-tech/contested-logistics-and-sustainment.test.ts
- examples/defense-tech/autonomy-assurance.test.ts
- examples/defense-tech/cyber-mission-assurance.test.ts
- examples/defense-tech/multi-sensor-state-estimation.test.ts

## Verification Summary

- The focused Task 006 gate passed: 5 tests, 0 failures, and 26 assertions.

## Learning Notes

- Proved: Current public primitives express the five required synthetic behavioral results.
- Simulated: All states, probabilities, observations, rewards, and costs.
- Test next: Remaining five themes.

## Skill Trial Notes

- Source comparison: not applicable
- Contract markers checked: public imports, seeded stochastic paths, behavioral assertions
- Trial status: pass

## Blockers

- None.

## Follow-Ups

- Task 007 is ready.
