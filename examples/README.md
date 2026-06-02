# Examples

The examples are executable Bun tests that double as usage documentation.

Run all examples and tests:

```sh
bun test
```

Run one example file:

```sh
bun test examples/modules/markov-chain.test.ts
```

## Learning Path

1. Read [`../THEORY.md`](../THEORY.md) for the math.
2. Use [`theory/`](./theory/) to see formulas expressed in code.
3. Use [`modules/`](./modules/) to learn one SDK API at a time.
4. Use [`real-world/`](./real-world/) to see applied problem-solving examples.

## Folders

- `modules`: focused examples for one SDK module at a time, including finite chains, HMMs, MDPs, queues, arrival processes, resource optimizers, kernels, SDEs, trace logic, graphical models, particle systems, and quantum channels.
- `theory`: mathematical identities and concepts implemented with the SDK, from matrix powers through queueing formulas, renewal, trace formulas, ergodic, branching, and quantum examples.
- `real-world`: applied examples such as churn, reliability, triage, queues, ED capacity, PageRank, Bayesian inference, maintenance planning, limited sensors, epidemic spread, diagnosis, finance, and quantum noise.

## Trace Logic Layer

Trace examples model observer windows as finite Markov chains with visible subwindows. They are executable finite toy models, not claims that the SDK derives physics or consciousness.

- `modules/trace-chain`: induced visible dynamics through hidden states.
- `modules/trace-diagnostics`: parent-support trace kernels, finite-sample trace estimation, and stationary restriction checks.
- `modules/observer-window`: named observer windows, stationary beliefs, and sequence likelihoods.
- `modules/trace-logic`: local meet, join, and complement inside one parent window.
- `modules/recursive-trace-system`: policies over observer-window names and traced policies.
- `modules/markov-geometry`: Dirichlet forms, conductance, and metastable communities.
- `modules/measure-logic`: finite event logic over probability measures.
- `modules/no-cloning`: linear Markov no-cloning demonstration.
- `real-world/limited-sensor-hidden-corridor`: a sensor that cannot observe maintenance states.
- `real-world/censored-machine-telemetry`: machine telemetry where hidden calibration states explain visible jumps.
- `real-world/adaptive-observer-policy`: switching between coarse and diagnostic monitoring windows.
- `real-world/apparent-jump-hidden-state-model`: hidden-corridor apparent jump as a finite toy model.

## Combined Workflows

The larger real-world examples combine multiple modules into applied decision workflows:

- `saas-growth-lab`: lifecycle forecasting, churn absorption, journey prediction, retention policy, and conversion uncertainty.
- `hospital-capacity-policy`: patient-flow durations, bed availability, triage belief updates, diagnosis, treatment policy, and ER queue pressure.
- `emergency-department-capacity`: acuity-priority queues, ambulance surge arrivals, beds, servers, and capacity action recommendation.
- `sre-incident-simulator`: reliability CTMCs, incident renewal, mitigation policy, support queues, and long-run availability.
- `fraud-kill-chain`: HMM compromise inference, Bayesian alert fusion, loss absorption, entity ranking, response policy, and uncertainty estimation.
- `search-recommendation-quality`: PageRank, random walks, higher-order navigation, intent inference, and recommendation policy.
- `supply-chain-control`: demand renewal, supplier reliability, inventory beliefs, queue pressure, backlog distribution, and reorder policy.
- `credit-market-regime-risk`: asset diffusion paths, hidden market regimes, rating migration, workout absorption, spectral behavior, and default uncertainty.

## High-Level Workflows

The `workflow` API is for users who want the applied pipeline without manually wiring every Markov primitive:

```text
observations -> infer -> forecast -> recommend -> simulate -> estimate uncertainty
```

- `modules/workflow`: generic `createWorkflow(...)` usage with `infer`, forecast, decision, simulation, and uncertainty stages.
- `modules/emergency-department-workflow`: ED capacity planning as a high-level workflow over queueing primitives.
- `real-world/high-level-fraud-workflow`: account observations become risk belief, response action, entity ranking, and alert uncertainty.
- `real-world/high-level-customer-lifecycle`: SaaS lifecycle state becomes forecast, retention action, journey prediction, and conversion uncertainty.
- `real-world/high-level-inventory-control`: noisy stock signals become reorder plans, supplier availability, demand pressure, and backlog estimates.

The correctness and edge-case test suite lives in [`../tests`](../tests/). These examples avoid exhaustive failure-mode testing so they can stay readable.
