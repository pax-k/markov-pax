# Defense Tech Example Suite

This catalog defines the safety, evidence, and model-selection boundary for the executable examples in [`examples/defense-tech`](./examples/defense-tech/).

## Scope and Safety Boundary

Every name, state, action, probability, cost, topology, observation, and outcome in this suite is synthetic. The examples support research, readiness, assurance, training, and human-supervised planning. They are executable software examples, not operational validation, deployment guidance, or real-world recommendations.

The suite explicitly excludes:

- targeting, target selection, and weapon assignment or effects;
- autonomous engagement or autonomous lethal decisions;
- real platform vulnerabilities, operational frequencies, coordinates, and engagement thresholds;
- classified, controlled, export-restricted, or non-public operational data.

Safe actions include monitoring, maintenance, alternate routing, pre-positioning, isolation, human-approved containment, human handoff, abort, repair, reorganization, and reduced-autonomy modes. A passing example proves only that the stated synthetic computation is reproducible with the current SDK.

## Select a Model

| Model | Use it when | Main limit |
| --- | --- | --- |
| Markov chain | The current named state is observable and a fixed-step transition matrix is a useful abstraction. | The next-state rule does not use the earlier path. |
| Hidden Markov model (HMM) | The important condition is hidden and observations provide indirect evidence about it. | Actions do not change the transition or observation model. |
| Semi-Markov process | State residence time matters and cannot be represented honestly by one fixed-step transition probability. | The duration law and next-state law must be supplied. |
| Continuous-time Markov chain (CTMC) | State changes occur in continuous time and rates are a useful abstraction for failure, repair, or availability. | Exponential holding times are implicit in a time-homogeneous finite CTMC. |
| Markov decision process (MDP) | The state is observable and actions affect transitions, rewards, or costs. | It assumes the decision state is known. |
| Partially observable MDP (POMDP) | Decisions must use a belief because the decision state is not directly observable. | The result depends on synthetic transition, observation, reward, and belief assumptions. |
| Constrained MDP | A policy must satisfy an explicit budget, capacity, risk, or resource limit. | A finite example is not proof that a real constraint is complete or calibrated. |
| Interacting-particle model | Many abstract agents or components change state through local interaction and propagation. | Synthetic topology and interaction rules are not a real organizational or platform model. |

An absorbing chain is useful when a terminal outcome must be reached and compared. A multi-objective MDP is useful when a decision must make an explicit trade-off between two or more synthetic objectives. A queue can add workload and service pressure to a state model.

## Evidence Rule

The public sources below describe defense needs, research programs, or modeling requirements. Unless a source explicitly names the same Markov model, the mapping from that need to an SDK composition is a **project hypothesis**. The examples test the software composition only. They do not claim that the source organization selected, approved, or validated the model.

## Theme Catalog

| Theme and executable example | SDK composition | Synthetic result demonstrated | Public need and model-mapping status |
| --- | --- | --- | --- |
| [Asset health and readiness](./examples/defense-tech/asset-health-and-readiness.test.ts) | HMM, CTMC, semi-Markov process, constrained MDP | Warning observations increase degraded-state belief; the selected maintenance policy stays within its resource budget. | The [Army CBM+ program](https://www.army.mil/article/120896/enabling_fleet_management_with_cbm) motivates condition-based fleet maintenance. The selected Markov composition is a project hypothesis. |
| [Contested logistics and sustainment](./examples/defense-tech/contested-logistics-and-sustainment.test.ts) | Route availability, disrupted supply network, inventory, constrained MDP | Disruption reduces expected capacity; the policy selects an alternate route or pre-positioning action. | [Army supply-chain resilience work](https://asc.army.mil/web/big-data-and-predictive-analytics-for-army-supply-chain/) motivates predictive logistics. The selected Markov composition is a project hypothesis. |
| [Autonomy assurance](./examples/defense-tech/autonomy-assurance.test.ts) | POMDP, constrained MDP | Conflicting telemetry increases unsafe-state belief; degraded states select reduced autonomy or human handoff. | [DARPA Assured Autonomy](https://www.darpa.mil/research/programs/assured-autonomy) motivates assurance of learning-enabled systems. The selected Markov composition is a project hypothesis. |
| [Cyber mission assurance](./examples/defense-tech/cyber-mission-assurance.test.ts) | HMM, absorbing chain, MDP | Defensive telemetry advances synthetic attack-stage belief; the policy selects isolation or human-approved containment before impact. | [NIST Fronesis research](https://www.nist.gov/publications/fronesis-digital-forensics-based-early-detection-ongoing-cyber-attacks) motivates early detection of ongoing cyber attacks. The selected Markov composition is a project hypothesis. |
| [Multi-sensor state estimation](./examples/defense-tech/multi-sensor-state-estimation.test.ts) | POMDP, Bayesian network, multi-objective MDP | Sequential observations produce a normalized belief; the policy selects a sensor task that reduces uncertainty. | [DARPA LINC](https://www.darpa.mil/research/programs/learning-introspective-control) motivates introspective control under changing conditions. The selected Markov composition is a project hypothesis. |
| [Electromagnetic-spectrum resilience](./examples/defense-tech/electromagnetic-spectrum-resilience.test.ts) | POMDP, constrained MDP | Interference observations increase degraded-regime belief; the policy selects a resilient abstract communications mode. | [NATO modeling and simulation requirements](https://www.act.nato.int/wp-content/uploads/2024/06/ifib024028_amdt1.pdf) motivate interoperable modeling and simulation. This theme and its Markov composition are project hypotheses; no operational frequency is modeled. |
| [Multi-agent team resilience](./examples/defense-tech/multi-agent-team-resilience.test.ts) | Interacting particle system, seeded simulation, MDP | Abstract compromise or agent loss propagates deterministically; the recovery policy isolates or reorganizes the team. | [DARPA DICE](https://www.darpa.mil/research/programs/decentralized-artificial-intelligence-through-controlled-emergence) motivates controlled emergence in decentralized AI. The selected Markov composition is a project hypothesis. |
| [Base infrastructure resilience](./examples/defense-tech/base-infrastructure-resilience.test.ts) | CTMC, reliability chain, queue, MDP | Backup and repair decisions improve expected availability under a synthetic cascading failure. | NATO modeling and simulation requirements provide a public planning context. The infrastructure scenario and selected Markov composition are project hypotheses. |
| [Training and force readiness](./examples/defense-tech/training-and-force-readiness.test.ts) | Semi-Markov process, queue, constrained MDP | The model forecasts time in training and certified states and selects a feasible resource allocation. | NATO modeling and simulation requirements provide a public training context. The readiness scenario and selected Markov composition are project hypotheses. |
| [Decision-support policy evaluation](./examples/defense-tech/decision-support-policy-evaluation.test.ts) | Markov chain, MDP, seeded Monte Carlo simulation | A robust abstract policy has higher expected value than a fixed baseline across synthetic scenario transitions. | NATO modeling and simulation requirements provide a public decision-support context. The scenario and selected Markov composition are project hypotheses. |

## Interpretation Limits

Model selection does not establish model validity. A real validation program would require representative authorized data, domain review, calibration, uncertainty analysis, independent assurance, and evidence from the intended environment. None of those activities is part of this suite.

The examples do not provide reusable Defense Tech workflows. They do not connect to sensors, platforms, command systems, networks, or external data. They do not authorize an action. All decisions remain abstract and human-supervised.

## Run the Suite

```sh
bun test examples/defense-tech
```

The repository release gate also checks the documentation paths, public ESM package, declarations, packed contents, and clean-consumer use:

```sh
bun run check
```
