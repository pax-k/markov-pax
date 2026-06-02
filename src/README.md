# Source Layout

The source tree is grouped by dependency level and responsibility:

- `shared/`: generic primitives used across the SDK: matrix operations, distribution helpers, RNGs, validation, and sampling.
- `chains/`: core Markov-chain and chain-analysis modules: discrete chains, continuous-time chains, transition kernels, semi-Markov and higher-order chains, absorbing-chain analysis, spectral utilities, ergodic diagnostics, and harmonic/martingale helpers.
- `models/`: adjacent stochastic and probabilistic model modules that use the shared primitives or chain concepts but are not workflow-specific, including HMMs, MDP/POMDPs, MCMC, queues, graphical models, renewal processes, SDEs, branching processes, interacting particles, and quantum channels.
- `workflows/`: orchestration APIs and domain-specific workflow templates that compose lower-level modules into higher-level use cases.

The package root re-exports all public APIs through `src/index.ts`.
