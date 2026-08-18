# 001: Correct Subset Search and Add Markov-Chain Fitting

Status: complete
Type: implementation
Owner: AI

Assumption basis: repo-evidence-backed
Requirement basis: approved public SDK repair plan and reproduced 33-state defect
Reversibility: easy
Learning objective: Prove that subset search is correct above 31 states and that finite chains can be fitted from observed paths.
Source under test: repo-local path

## Goal

Fix unsafe subset enumeration and add a tested `MarkovChain.fit` public API.

## Non-Goals

- Build new domain workflows.
- Change existing chain analysis behavior.
- Add approximate community search.

## Required Reading

- `AGENTS.md`
- `docs/execution-rules.md`
- `src/trace/index.ts`
- `src/chains/markov-chain.ts`

## Acceptance Criteria

- [x] A 33-state trace enumeration with `maxWindows: 1` returns only the first state.
- [x] Unbounded full trace enumeration rejects chains above 12 states.
- [x] Exact conductance search rejects work above its candidate budget.
- [x] `MarkovChain.fit` implements transition counts and additive smoothing.
- [x] Focused and full checks pass.

## Baseline Evidence

The current 33-state reproduction returns `["s0","s32"]`. `MarkovChain` has no `fit` method.

## Verification

- `bun test tests/trace-logic.test.ts tests/markov-geometry.test.ts tests/markov-chain.test.ts`
- `bun run check`

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-18 | `bun test tests/trace-logic.test.ts tests/markov-geometry.test.ts tests/markov-chain.test.ts` | pass | 12 focused tests passed. |
| 2026-08-18 | `bun run check` | pass | Type check and 239 tests passed with 100% reported line and function coverage. |

## Files Changed

- `src/chains/markov-chain.ts` - added path fitting with smoothing and validation.
- `src/trace/index.ts` - replaced unsafe masks and bounded exact search.
- `tests/markov-chain.test.ts` - added fitting behavior and error tests.
- `tests/trace-logic.test.ts` - added the 33-state regression test.
- `tests/markov-geometry.test.ts` - added candidate-budget proof.

## Verification Summary

- `bun run check` passed.

## Learning Notes

- Proved: Subset enumeration is correct above 31 states, exact searches are bounded, and observed paths can fit a chain.
- Simulated: None.
- Test next: Packed public API import in task 002.

## Skill Trial Notes

- Source comparison: not applicable
- Contract markers checked: n/a
- Trial status: n/a

## Blockers

- None.

## Follow-Ups

- Task 002 after this task passes.
