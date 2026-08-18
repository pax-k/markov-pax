# Research-Backed Application Map

This file maps useful Markov methods to real problems. A cited paper supports the problem-method match. It does not prove that this SDK implements or validates the complete system.

For code support, use [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

| Area | Markov formulation | Research evidence | SDK status |
| --- | --- | --- | --- |
| Emergency-department capacity | Patient queues and bed or service capacity are states. Capacity changes are actions. | A two-class queue and optimization study models beds, servers, and waiting performance ([Scientific Reports, 2025](https://doi.org/10.1038/s41598-025-86158-w)). | Direct workflow |
| Disaster food and medicine supply | Facility, route, inventory, demand, and access conditions are states. Rerouting and alternate depots are actions. | An MDP study models food-supply resilience during natural disasters and reports a Qatar flood case ([Supply Chain Analytics, 2025](https://qspace.qu.edu.qa/bitstream/handle/10576/68140/1-s2.0-S2949863525000366-main.pdf?isAllowed=y&sequence=1)). | Direct workflow |
| Wildfire response | Fuel, weather, burning, containment, and access conditions can form a stochastic grid state. Response choices are actions. | A preprint combines stochastic cellular automata with multi-agent reinforcement learning for wildfire response ([WARP-CA, 2024](https://arxiv.org/abs/2407.02613)). Treat this as an early research direction, not established operational proof. | Building blocks only |
| Renewable microgrids | Component health, storage, weather, and load form system states. Dispatch and maintenance are actions. | A Markov reliability study compares 20 hybrid microgrid configurations ([Sustainable Energy Technologies and Assessments, 2024](https://doi.org/10.1016/j.seta.2024.103623)). | Building blocks only |
| Infrastructure deterioration | Inspection grades form condition states. A semi-Markov model can include time spent in each state. | A bridge study uses inspection data with an unsupervised semi-Markov approach ([Structural Concrete, 2025](https://doi.org/10.1002/suco.70046)). Earlier work explains why memoryless homogeneous chains can be too restrictive ([ASCE, 2016](https://doi.org/10.1061/%28ASCE%29IS.1943-555X.0000298)). | Adjacent example |
| Water quality | Hidden water-quality regimes change over time and produce measurements at connected stations. | An HMM and graph-convolution model represents latent water-quality transitions across monitoring locations ([Journal of Hydrology, 2026](https://doi.org/10.1016/j.jhydrol.2025.134341)). | Building blocks only |
| Urban land use | Land-cover classes are states. Satellite history estimates transitions. Policy changes can define scenarios. | A CA-Markov and GIS study examines Lahore data from 1994 to 2024 and forecasts 2034 and 2044 ([Scientific Reports, 2025](https://doi.org/10.1038/s41598-025-87796-w)). | Building blocks only |
| Cyber defense | Attack stages or ATT&CK techniques are hidden states. Alerts are observations. Defensive controls are actions. | [MITRE ATT&CK](https://attack.mitre.org/) provides an evidence-based vocabulary for adversary behavior. An HMM, MDP, or game model is a possible analysis layer; no matching domain workflow exists here. | Building blocks only |
| EV battery lifecycle | Health and lifecycle stages are states. Continued use, second life, repair, recycling, and disposal are decisions. | A real-world battery study uses a stochastic degradation process and first-passage probabilities for maintenance planning ([Energy, 2025](https://doi.org/10.1016/j.energy.2025.134663)). This supports stochastic health decisions, not the full circular-routing proposal. | Building blocks only |
| Manufacturing reliability | Machine condition, process, inspection, rework, and scrap can form states. Maintenance and process controls are actions. | An HMM study predicts equipment state with the production plan ([IEEE, 2025](https://ieeexplore.ieee.org/document/10874870)). | Adjacent example |
| Drug discovery | Molecular candidates or conformations are states. Edits or molecular moves are transition proposals. | MARS uses MCMC and adaptive molecular-graph edits for multi-objective molecule discovery ([ICLR, 2021](https://openreview.net/forum?id=kHSu4ebxFXY)). | Building blocks only |
| AI-agent runtime safety | Task, tool, memory, environment, and risk conditions can form states. Allow, block, redirect, and confirm can be actions. | This is a project idea. The earlier precise 2025 research claim could not be verified from a primary source and was removed. | Building blocks only |

## Priority order for future domain work

The next domain work is not part of the current release. The planned order is:

1. Wildfire response and evacuation.
2. Cyber attack-chain prediction and defense.
3. Water-quality and water-system forecasting.
4. EV battery lifecycle decisions.
5. Renewable microgrid reliability.
6. Urban land-use policy simulation.
7. Drug-discovery sampling workflow.
8. AI-agent runtime safety.

## Model-selection warning

A first-order, time-homogeneous chain is often too simple. Use a semi-Markov model when time in state matters. Use an HMM when the state is hidden. Use an MDP or POMDP when actions affect outcomes. Use a non-homogeneous model when transitions change with time, age, season, or policy. Use MCMC when the chain is a sampling method rather than a model of operational time.
