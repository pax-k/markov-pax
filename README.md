# markov-pax

`markov-pax` is a TypeScript SDK for finite-state stochastic models. It includes Markov chains, hidden Markov models, decision processes, queues, reliability models, sampling methods, and finite trace-analysis tools.

The package is prepared for a public release, but it is not published. Use it from this repository until a release is available.

## Install and check

```sh
bun install
bun run check
```

After publication, the install command will be:

```sh
bun add markov-pax
```

## Quick start

```ts
import { MarkovChain } from "markov-pax";

const weather = MarkovChain.from({
  Sunny: { Sunny: 0.7, Cloudy: 0.2, Rainy: 0.1 },
  Cloudy: { Sunny: 0.3, Cloudy: 0.4, Rainy: 0.3 },
  Rainy: { Sunny: 0.2, Cloudy: 0.3, Rainy: 0.5 },
});

const tomorrow = weather.stepFrom("Sunny");
const tenDayRain = weather.probabilityAfter("Sunny", "Rainy", 10);
const stationary = weather.stationary();
```

Fit a finite chain from an observed path:

```ts
const fitted = MarkovChain.fit(
  ["idle", "busy", "busy", "idle", "failed", "idle"],
  { states: ["idle", "busy", "failed"], smoothing: 1 },
);
```

## What is included

- Finite chains, absorbing chains, higher-order chains, semi-Markov processes, and continuous-time Markov chains.
- HMM, MDP, POMDP, queue, reliability, renewal, Bayesian, Monte Carlo, random-walk, and stochastic-process tools.
- High-level workflows for emergency-department capacity and disaster supply chains.
- Finite trace chains, observer windows, local trace logic, trace policies, conductance, finite event logic, and a linear no-cloning example.
- Executable examples and tests that show the supported behavior.

See [the implementation status](./IMPLEMENTATION_STATUS.md) for the exact support level and proof path for each main area. See [the examples guide](./examples/README.md) for the learning path.

## Evidence and limits

The automated checks cover types, behavior, coverage, documentation paths, the ESM build, declarations, package contents, and a clean consumer install. Run one example with:

```sh
bun test examples/modules/markov-chain.test.ts
```

Run the bounded 12-state trace and conductance benchmark with `bun run benchmark`. See [BENCHMARKS.md](./BENCHMARKS.md) for its exact scale and limits.

The SDK contains finite computational models. It does not prove that trace logic derives physics, consciousness, artificial general intelligence, or reports about unidentified anomalous phenomena. [EXAMPLES_2.md](./EXAMPLES_2.md) records those ideas as transcript claims and conjectures. They are not package guarantees.

The domain examples use small synthetic data. They prove that the code path runs. They do not prove clinical, safety, financial, scientific, or production validity. Validate a model with domain experts and representative data before operational use.

## Project documents

- [Theory and API guide](./THEORY.md)
- [Research-backed application map](./EXAMPLES_1.md)
- [Transcript-derived trace research notes](./EXAMPLES_2.md)
- [Implementation status and priorities](./IMPLEMENTATION_STATUS.md)
- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Changelog](./CHANGELOG.md)
- [Manual benchmark](./BENCHMARKS.md)

## License

MIT. See [LICENSE](./LICENSE).
