# Implementation Status

This document separates implemented code from adjacent examples, reusable building blocks, and research claims.

Status meanings:

- **Direct**: a named workflow and executable tests cover the stated problem shape.
- **Adjacent**: an executable example covers part of the problem, but not the full domain workflow.
- **Building blocks**: general SDK modules can support the work, but no domain workflow exists.
- **Finite research model**: code implements a bounded mathematical example. It does not prove the wider interpretation.
- **Not implemented**: no supporting code exists.

## Application areas from EXAMPLES_1

| Area | Status | Executable evidence | Missing work |
| --- | --- | --- | --- |
| Emergency-department capacity | Direct | [workflow](./src/workflows/emergency-department-capacity-workflow.ts), [applied example](./examples/real-world/emergency-department-capacity.test.ts), [tests](./tests/emergency-department-capacity-workflow.test.ts) | Real hospital data, calibration, external validation, and deployment controls. |
| Disaster food and medicine supply | Direct | [workflow](./src/workflows/disaster-supply-chain-workflow.ts), [applied example](./examples/real-world/disaster-food-medicine-supply-chain.test.ts), [tests](./tests/disaster-supply-chain-workflow.test.ts) | Real network data, operational constraints, equity review, and external validation. |
| Wildfire response | Building blocks | [MDP](./src/models/mdp.ts), [graph processes](./src/models/graph.ts), and [interacting particles](./src/models/interacting-particles.ts) | Fire-spread state model, calibrated data, evacuation actions, safety constraints, and domain tests. |
| Renewable microgrids | Building blocks | [CTMC](./src/chains/ctmc.ts), [renewal models](./src/models/renewal.ts), and [MDP](./src/models/mdp.ts) | Energy balance, storage, weather, dispatch, reliability metrics, and domain tests. |
| Infrastructure deterioration | Adjacent | [maintenance example](./examples/real-world/maintenance-and-renewal.test.ts) and [semi-Markov process](./src/chains/semi-markov.ts) | Asset schema, inspection-data fitting, interventions, costs, and domain validation. |
| Water quality | Building blocks | [HMM](./src/models/hmm.ts), [graphical models](./src/models/graphical-models.ts), and [graph processes](./src/models/graph.ts) | Monitoring-network model, missing-data rules, regime calibration, warnings, and domain tests. |
| Urban land use | Building blocks | [graph processes](./src/models/graph.ts) and [Markov chain](./src/chains/markov-chain.ts) | Raster/GIS integration, spatial transition rules, policy scenarios, and domain tests. |
| Cyber defense | Building blocks | [HMM](./src/models/hmm.ts), [MDP/POMDP](./src/models/mdp.ts), and [workflow framework](./src/workflows/workflow.ts) | ATT&CK schema, event ingestion, attacker model, controls, adversarial validation, and domain tests. |
| EV battery lifecycle | Building blocks | [semi-Markov process](./src/chains/semi-markov.ts), [renewal models](./src/models/renewal.ts), and [constrained MDP](./src/models/constrained-mdp.ts) | Health fitting, lifecycle routes, economics, regulations, and domain tests. |
| Manufacturing reliability | Adjacent | [operations and reliability example](./examples/real-world/operations-and-reliability.test.ts) and [censored telemetry example](./examples/real-world/censored-machine-telemetry.test.ts) | Production schema, rework and scrap model, maintenance actions, and plant-data validation. |
| Drug discovery | Building blocks | [Metropolis-Hastings](./src/models/mcmc.ts) and [advanced MCMC](./src/models/advanced-mcmc.ts) | Molecular representation, valid edit proposals, scientific scoring, benchmarks, and experimental validation. |
| AI-agent runtime safety | Building blocks | [MDP/POMDP](./src/models/mdp.ts), [trace policies](./src/trace/index.ts), and [workflow framework](./src/workflows/workflow.ts) | Agent event schema, enforceable policy language, runtime monitor, model checking, and adversarial tests. |

## Trace and observer claims from EXAMPLES_2

| Claim | Status | Executable evidence | Boundary or missing proof |
| --- | --- | --- | --- |
| Enhanced finite chain with a counter | Finite research model | [trace API](./src/trace/index.ts), [observer example](./examples/modules/observer-window.test.ts) | The counter is a software model only. |
| Trace chain induced by a visible state set | Implemented | [trace-chain example](./examples/modules/trace-chain.test.ts), [trace tests](./tests/trace-chain.test.ts) | Finite chains only. |
| Trace diagnostics and stationary restriction | Implemented | [diagnostics example](./examples/modules/trace-diagnostics.test.ts), [trace tests](./tests/trace-chain.test.ts) | Numerical finite-state checks are not a general theorem. |
| Trace relation as a partial order | Partial finite model | [trace-logic example](./examples/modules/trace-logic.test.ts), [trace-logic tests](./tests/trace-logic.test.ts) | The code checks finite instances through `isTraceOf`; it does not contain a general mathematical proof. |
| Local meet, join, and complement | Finite research model | [trace-logic example](./examples/modules/trace-logic.test.ts), [trace-logic tests](./tests/trace-logic.test.ts) | Operations are local to a finite parent window. |
| General global join | Not implemented | [`globalTraceJoin`](./src/trace/index.ts) rejects the operation | No general construction or theorem is supplied. |
| Recursive trace systems and agency as policies | Finite research model | [recursive example](./examples/modules/recursive-trace-system.test.ts), [recursive tests](./tests/recursive-trace-system.test.ts) | The recursion depth and policy set are explicit and finite. |
| Counter dilation and visible return time | Finite research model | [trace-chain example](./examples/modules/trace-chain.test.ts), [trace tests](./tests/trace-chain.test.ts) | This is a finite timing analogy. It is not a derivation of relativity. |
| Markov geometry and metastable communities | Implemented | [geometry example](./examples/modules/markov-geometry.test.ts), [geometry tests](./tests/markov-geometry.test.ts) | Candidate enumeration has an explicit safety budget. |
| Stationary belief and finite event logic | Finite research model | [measure example](./examples/modules/measure-logic.test.ts), [measure tests](./tests/measure-logic.test.ts) | The code does not prove the claimed homomorphism to Lebesgue logic. |
| Linear no-cloning example | Finite research model | [no-cloning example](./examples/modules/no-cloning.test.ts), [no-cloning tests](./tests/no-cloning.test.ts) | This is a finite linear-operator example. It is not a derivation of quantum mechanics. |
| Computational universality | Not implemented | None | No universal construction, encoding, or proof is in the repository. |
| Relativity, length contraction, and general relativity | Not implemented | None | Transcript conjecture only. |
| Born rule, uncertainty, contextuality, and quantum field theory | Not implemented | None | Transcript conjecture only. |
| Consciousness or embodiment theory | Not implemented | None | Interpretive claim only. |
| Trace-logic AI architecture | Not implemented | None | Research proposal only. |
| UAP or higher-intelligence model | Not implemented | None | Speculation only. |

## Current release boundary

The public package boundary is finite computation with explicit resource limits. The direct domain workflows and all applied examples use synthetic data. They are executable demonstrations, not external validation.

The eight planned domain workflows are future work. Their priority order is wildfire, cyber defense, water systems, EV batteries, microgrids, urban land use, drug discovery, and AI-agent runtime safety.
