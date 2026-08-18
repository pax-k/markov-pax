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
5. Use [`defense-tech/`](./defense-tech/) for synthetic, safety-bounded Defense Tech compositions.

## Folders

- `modules`: focused examples for one SDK module at a time, including finite chains, HMMs, MDPs, constrained MDPs, queues, supply chains, arrival processes, resource optimizers, kernels, SDEs, trace logic, graphical models, particle systems, and quantum channels.
- `theory`: mathematical identities and concepts implemented with the SDK, from matrix powers through queueing formulas, renewal, min-cost flow, constrained policy choice, accessibility/resilience metrics, trace formulas, ergodic, branching, and quantum examples.
- `real-world`: applied examples such as churn, reliability, triage, queues, ED capacity, disaster supply chains, PageRank, Bayesian inference, maintenance planning, limited sensors, epidemic spread, diagnosis, finance, and quantum noise.
- `defense-tech`: ten deterministic examples for synthetic research, readiness, assurance, training, and human-supervised planning. See the [authoritative catalog and safety boundary](../DEFENSE_TECH.md).

## Defense Tech Collection

All names, probabilities, costs, topology, observations, and outcomes in this collection are synthetic. These examples are not reusable operational workflows and are not externally validated capabilities.

- [`asset-health-and-readiness.test.ts`](./defense-tech/asset-health-and-readiness.test.ts)
- [`contested-logistics-and-sustainment.test.ts`](./defense-tech/contested-logistics-and-sustainment.test.ts)
- [`autonomy-assurance.test.ts`](./defense-tech/autonomy-assurance.test.ts)
- [`cyber-mission-assurance.test.ts`](./defense-tech/cyber-mission-assurance.test.ts)
- [`multi-sensor-state-estimation.test.ts`](./defense-tech/multi-sensor-state-estimation.test.ts)
- [`electromagnetic-spectrum-resilience.test.ts`](./defense-tech/electromagnetic-spectrum-resilience.test.ts)
- [`multi-agent-team-resilience.test.ts`](./defense-tech/multi-agent-team-resilience.test.ts)
- [`base-infrastructure-resilience.test.ts`](./defense-tech/base-infrastructure-resilience.test.ts)
- [`training-and-force-readiness.test.ts`](./defense-tech/training-and-force-readiness.test.ts)
- [`decision-support-policy-evaluation.test.ts`](./defense-tech/decision-support-policy-evaluation.test.ts)

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
- `disaster-food-medicine-supply-chain`: flood-disrupted warehouses, routes, cold-chain medicine, food access, alternate depots, rationing, and response planning.
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
- `modules/disaster-supply-chain-workflow`: disaster-resilient food and medicine response planning over finite logistics primitives.
- `real-world/high-level-fraud-workflow`: account observations become risk belief, response action, entity ranking, and alert uncertainty.
- `real-world/high-level-customer-lifecycle`: SaaS lifecycle state becomes forecast, retention action, journey prediction, and conversion uncertainty.
- `real-world/high-level-inventory-control`: noisy stock signals become reorder plans, supplier availability, demand pressure, and backlog estimates.

The correctness and edge-case test suite lives in [`../tests`](../tests/). These examples avoid exhaustive failure-mode testing so they can stay readable.
