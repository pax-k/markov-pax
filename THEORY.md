# Markov Theory

This document summarizes the mathematical theory, adjacent stochastic-process
theories, practical applications, computer-science interpretation, and a
TypeScript SDK design for modeling Markov systems.

The unifying idea is:

```txt
state space + probability distribution + transition rule
```

For finite Markov chains, the transition rule is a stochastic matrix. For more
general theories, the matrix becomes a kernel, generator, graph, operator,
policy, observation model, or sampler.

## 1. Discrete-Time Markov Chains

A discrete-time Markov chain is a random process

```txt
X_0, X_1, X_2, ...
```

on a state space `S` such that the future depends only on the present state, not
the full history.

Mathematically:

```txt
Pr(X_{n+1} = j | X_n = i, X_{n-1}, ..., X_0)
  =
Pr(X_{n+1} = j | X_n = i)
```

This is the Markov property.

For a finite state space

```txt
S = {s_1, s_2, ..., s_m}
```

the one-step transition probabilities are stored in a matrix `P`:

```txt
P_ij = Pr(X_{n+1} = j | X_n = i)
```

The matrix is stochastic:

```txt
P_ij >= 0
sum_j P_ij = 1
```

Each row is a probability distribution over the next state.

Example:

```txt
P =
[
  [0.7, 0.2, 0.1],
  [0.3, 0.4, 0.3],
  [0.2, 0.3, 0.5]
]
```

If the states are `Sunny`, `Cloudy`, and `Rainy`, then the first row says:

```txt
Pr(Sunny -> Sunny) = 0.7
Pr(Sunny -> Cloudy) = 0.2
Pr(Sunny -> Rainy) = 0.1
```

## 2. Matrix Dynamics

Let `mu_n` be a row vector representing the distribution of `X_n`.

Then:

```txt
mu_{n+1} = mu_n P
```

After `n` steps:

```txt
mu_n = mu_0 P^n
```

The entry `(P^n)_ij` gives the probability of moving from state `i` to state
`j` in exactly `n` steps:

```txt
(P^n)_ij = Pr(X_n = j | X_0 = i)
```

Matrix multiplication works here because it sums over all possible intermediate
paths.

For two steps:

```txt
(P^2)_ij = sum_k P_ik P_kj
```

That means: to go from `i` to `j` in two steps, go through any intermediate
state `k`.

The general rule is the Chapman-Kolmogorov equation:

```txt
P^{m+n} = P^m P^n
```

## 3. Path Probabilities

If the initial distribution is `mu`, then the probability of the path

```txt
i_0 -> i_1 -> ... -> i_n
```

is:

```txt
Pr(X_0 = i_0, ..., X_n = i_n)
  =
mu_{i_0}
  P_{i_0 i_1}
  P_{i_1 i_2}
  ...
  P_{i_{n-1} i_n}
```

So a Markov chain assigns probabilities to paths by multiplying transition
probabilities.

## 4. Stationary Distributions

A distribution `pi` is stationary if applying the transition matrix leaves it
unchanged:

```txt
pi P = pi
```

with:

```txt
sum_i pi_i = 1
pi_i >= 0
```

If `X_0` is distributed according to `pi`, then every later `X_n` is also
distributed according to `pi`.

So `pi` is a left eigenvector of `P` with eigenvalue `1`.

For finite Markov chains, at least one stationary distribution always exists.

## 5. Long-Term Behavior

A central theorem:

If a finite Markov chain is irreducible and aperiodic, then it has a unique
stationary distribution `pi`, and:

```txt
lim_{n -> infinity} (P^n)_ij = pi_j
```

for all states `i` and `j`.

Equivalently:

```txt
mu_0 P^n -> pi
```

for every starting distribution `mu_0`.

Intuitively, the chain forgets where it started.

## 6. Irreducibility

State `j` is accessible from state `i` if:

```txt
(P^n)_ij > 0
```

for some `n >= 0`.

States `i` and `j` communicate if each is accessible from the other.

A chain is irreducible if every state communicates with every other state.

Graph interpretation: the directed graph of possible transitions is strongly
connected.

## 7. Periodicity

The period of a state `i` is:

```txt
d(i) = gcd { n >= 1 : (P^n)_ii > 0 }
```

If `d(i) = 1`, the state is aperiodic.

In an irreducible chain, all states have the same period.

A periodic chain can fail to converge even if it has a stationary distribution.

Example:

```txt
P =
[
  [0, 1],
  [1, 0]
]
```

The chain alternates forever:

```txt
A -> B -> A -> B -> ...
```

## 8. Recurrence and Transience

Let:

```txt
T_i = inf { n >= 1 : X_n = i }
```

be the first return time to state `i`.

State `i` is recurrent if:

```txt
Pr_i(T_i < infinity) = 1
```

meaning the chain returns to `i` eventually with probability `1`.

State `i` is transient if:

```txt
Pr_i(T_i < infinity) < 1
```

meaning there is a positive chance it never returns.

Equivalent criterion:

```txt
i is recurrent
  iff
sum_{n=0}^{infinity} (P^n)_ii = infinity
```

and:

```txt
i is transient
  iff
sum_{n=0}^{infinity} (P^n)_ii < infinity
```

For finite irreducible chains, every state is recurrent.

## 9. Positive Recurrence

A recurrent state is positive recurrent if its expected return time is finite:

```txt
E_i[T_i] < infinity
```

For irreducible chains, a stationary distribution exists exactly when the chain
is positive recurrent.

In that case:

```txt
pi_i = 1 / E_i[T_i]
```

So stationary probability is the reciprocal of expected return time.

## 10. Absorbing Chains

A state `i` is absorbing if:

```txt
P_ii = 1
```

Once entered, it cannot be left.

For absorbing Markov chains, reorder the states so transient states come first
and absorbing states last:

```txt
P =
[
  [Q, R],
  [0, I]
]
```

Here:

```txt
Q = transitions among transient states
R = transitions from transient states to absorbing states
I = identity matrix on absorbing states
```

The fundamental matrix is:

```txt
N = (I - Q)^{-1}
```

The entry `N_ij` is the expected number of visits to transient state `j`,
starting from transient state `i`.

Absorption probabilities:

```txt
B = N R
```

Expected time to absorption:

```txt
t = N 1
```

where `1` is a column vector of ones.

## 11. Reversibility

A Markov chain is reversible with respect to `pi` if:

```txt
pi_i P_ij = pi_j P_ji
```

This is called detailed balance.

If detailed balance holds, then `pi` is stationary:

```txt
pi P = pi
```

Reversible chains are important in physics, random walks, MCMC, and equilibrium
models.

## 12. Spectral Theory

For finite chains, long-term behavior is controlled by the eigenvalues of `P`.

Because `P` is stochastic, `1` is always an eigenvalue.

If the chain is finite, irreducible, and aperiodic, then the powers of `P`
converge:

```txt
P^n ->
[
  [pi],
  [pi],
  ...
  [pi]
]
```

where each row is the stationary distribution.

The second-largest eigenvalue magnitude controls mixing speed:

```txt
distance to stationarity roughly behaves like |lambda_2|^n
```

The spectral gap is:

```txt
1 - |lambda_2|
```

A larger spectral gap usually means faster convergence.

## 13. Perron-Frobenius Theory

Finite Markov chains are closely connected to nonnegative matrix theory.

A stochastic matrix is a nonnegative matrix whose rows sum to `1`. Perron-
Frobenius theory explains why an irreducible nonnegative matrix has a dominant
positive eigenvector.

For Markov chains, that dominant eigenvector corresponds to the stationary
distribution.

This is the linear-algebraic backbone of finite Markov-chain theory and is
central to algorithms such as PageRank.

## 14. Continuous-Time Markov Chains

A continuous-time Markov chain has time parameter:

```txt
t >= 0
```

Instead of a transition matrix for one step, it has a generator matrix `Q`.

For `i != j`:

```txt
Q_ij >= 0
```

and:

```txt
Q_ii = -sum_{j != i} Q_ij
```

Rows sum to `0`:

```txt
sum_j Q_ij = 0
```

The transition matrix at time `t` is:

```txt
P(t) = exp(t Q)
```

The Kolmogorov equations are:

```txt
d/dt P(t) = Q P(t)
d/dt P(t) = P(t) Q
```

A stationary distribution satisfies:

```txt
pi Q = 0
```

Continuous-time Markov chains are used for queues, chemical reactions, server
failures, reliability systems, hospital patient flow, and epidemic models.

## 15. General Markov Processes

For infinite, continuous, or abstract state spaces, matrices are replaced by
transition kernels.

Instead of:

```txt
P_ij = Pr(X_{n+1} = j | X_n = i)
```

write:

```txt
K(x, A) = Pr(X_{n+1} in A | X_n = x)
```

where `x` is a state and `A` is a measurable set of states.

This is the general theory of Markov chains on arbitrary state spaces.

## 16. Diffusions and SDEs

A diffusion is a continuous-state, continuous-time Markov process.

A common model is a stochastic differential equation:

```txt
dX_t = b(X_t) dt + sigma(X_t) dW_t
```

where:

```txt
b = drift
sigma = volatility or noise scale
W_t = Brownian motion
```

The generator becomes a differential operator:

```txt
L f(x)
  =
b(x) dot grad f(x)
  +
1/2 sigma(x) sigma(x)^T : Hessian f(x)
```

Diffusions connect Markov theory to partial differential equations through the
Kolmogorov and Fokker-Planck equations.

Examples:

```txt
Brownian motion
Ornstein-Uhlenbeck processes
Langevin dynamics
stochastic volatility models
interest-rate models
```

## 17. Hidden Markov Models

A Hidden Markov Model has hidden states `X_t` and observations `Y_t`.

The hidden state is Markov:

```txt
Pr(X_{t+1} | X_t)
```

Each observation depends on the current hidden state:

```txt
Pr(Y_t | X_t)
```

The model contains:

```txt
initial distribution
transition probabilities
emission probabilities
```

Important algorithms:

```txt
Forward algorithm: probability of an observation sequence
Backward algorithm: reverse dynamic program for observations
Viterbi algorithm: most likely hidden state path
Baum-Welch / EM: parameter learning
```

Applications:

```txt
speech recognition
part-of-speech tagging
gene prediction
state estimation
activity recognition
fault detection
```

## 18. Markov Decision Processes

A Markov Decision Process adds actions and rewards.

Instead of:

```txt
P(s' | s)
```

an MDP has:

```txt
P(s' | s, a)
```

and a reward:

```txt
R(s, a)
```

A policy chooses actions:

```txt
pi(a | s)
```

The goal is to maximize expected return.

The Bellman optimality equation is:

```txt
V(s) = max_a [
  R(s, a) + gamma sum_{s'} P(s' | s, a) V(s')
]
```

This is the foundation of:

```txt
dynamic programming
reinforcement learning
robotics
stochastic control
game AI
inventory control
dynamic pricing
```

## 19. Partially Observable MDPs

A POMDP combines MDPs and HMMs.

The true state is hidden. The agent sees observations and maintains a belief
distribution:

```txt
b_t(s) = Pr(S_t = s | history)
```

The belief is updated using Bayes' rule after each action and observation.

In computer-science terms:

```txt
POMDP = MDP + hidden state + Bayesian filtering
```

POMDPs are used in autonomous driving, medical diagnosis, robot planning,
search-and-rescue, and decision-making under incomplete information.

## 20. Semi-Markov Processes

Ordinary Markov chains have fixed time steps or, in continuous time, exponential
waiting times.

A semi-Markov process allows arbitrary waiting-time distributions.

It models both:

```txt
Pr(X_{n+1} = j | X_n = i)
```

and:

```txt
Pr(T_{n+1} - T_n <= t | X_n = i, X_{n+1} = j)
```

This is useful when time spent in a state matters and is not memoryless.

Examples:

```txt
patient time in ICU
machine degradation states
insurance claim lifetimes
workflow durations
```

## 21. Renewal Theory

Renewal theory studies repeated random events.

If `X_1, X_2, ...` are waiting times, event times are:

```txt
S_n = X_1 + ... + X_n
```

Renewal theory is adjacent to Markov chains because return times, hitting times,
recurrence, and regeneration all use renewal ideas.

A recurrent Markov chain can often be studied by cutting its path into cycles
between visits to a chosen state.

Applications:

```txt
warranty failures
maintenance cycles
bus arrivals
telecom packet arrivals
repeated server failures
```

## 22. Martingales

A martingale is a stochastic process satisfying:

```txt
E[M_{n+1} | F_n] = M_n
```

It is not necessarily Markov, but martingales are deeply connected to Markov
chains.

If `h` is harmonic for a Markov chain:

```txt
P h = h
```

then:

```txt
h(X_n)
```

is a martingale.

This connects Markov chains to:

```txt
potential theory
optional stopping
hitting probabilities
stochastic calculus
financial mathematics
```

## 23. Random Walks

A random walk is a Markov chain where the state evolves by random increments.

On the integers:

```txt
X_{n+1} = X_n + xi_{n+1}
```

where `xi_{n+1}` might be `+1` or `-1`.

On a graph:

```txt
current node -> randomly choose a neighboring node
```

Random walks connect Markov chains to:

```txt
graph theory
PageRank
network centrality
electrical networks
Brownian motion
probability on groups
statistical physics
```

## 24. Markov Random Fields

A Markov chain is a temporal Markov model.

A Markov random field is a spatial or graphical Markov model.

Variables live on a graph, and the Markov property is local:

```txt
Pr(X_i | X_all_others)
  =
Pr(X_i | X_neighbors_of_i)
```

Applications:

```txt
image denoising
medical image segmentation
texture modeling
spatial statistics
Ising models
Bayesian statistics
```

## 25. Bayesian Networks and Graphical Models

A Markov chain is a simple directed graphical model:

```txt
X_0 -> X_1 -> X_2 -> ...
```

Graphical models generalize this to arbitrary dependency structures:

```txt
A -> B -> C
A -> C <- B
X_t -> X_{t+1}
X_t -> Y_t
```

HMMs, Kalman filters, dynamic Bayesian networks, and Markov random fields all
live in the broader world of probabilistic graphical models.

## 26. MCMC

Markov Chain Monte Carlo uses Markov chains as computational tools.

The goal is to sample from a complicated target distribution `pi`.

One constructs a Markov chain whose stationary distribution is `pi`:

```txt
X_n approximately distributed as pi for large n
```

Important algorithms:

```txt
Metropolis-Hastings
Gibbs sampling
Hamiltonian Monte Carlo
Langevin Monte Carlo
```

This turns hard integrals into sample averages.

Instead of computing:

```txt
E[f(X)] = integral f(x) pi(x) dx
```

approximate:

```txt
1/N sum_{i=1}^N f(x_i)
```

where the samples `x_i` come from the Markov chain.

Applications:

```txt
Bayesian inference
probabilistic programming
physics simulations
machine learning
uncertainty estimation
election forecasting
```

## 27. Ergodic Theory

Ergodic theory studies long-run averages.

For many Markov chains:

```txt
1/n sum_{k=0}^{n-1} f(X_k) -> E_pi[f]
```

This says that time averages along one trajectory converge to averages under
the stationary distribution.

This is stronger than merely saying that `mu_n` converges to `pi`.

Ergodic theorems justify using one long simulation to estimate long-run
behavior.

## 28. Queueing Theory

Queueing systems are often Markov chains or continuous-time Markov chains.

Example: an `M/M/1` queue has state:

```txt
X_t = number of customers in the system
```

with arrival rate `lambda` and service rate `mu`.

The stationary distribution is:

```txt
pi_n = (1 - rho) rho^n
rho = lambda / mu
```

for `rho < 1`.

Applications:

```txt
cloud servers
API latency
database load
worker pools
airports
hospitals
checkout lines
network routers
```

## 29. Branching Processes

A branching process models random reproduction.

The classic Galton-Watson process is:

```txt
X_{n+1} = sum_{i=1}^{X_n} xi_i
```

where `xi_i` is the number of children of individual `i`.

It studies:

```txt
extinction probabilities
growth rates
criticality
population survival
```

Applications:

```txt
epidemics
family names
nuclear chain reactions
startup virality
information cascades
```

## 30. Interacting Particle Systems

Interacting particle systems are Markov processes with many local components
interacting over space.

Examples:

```txt
voter model
contact process
exclusion process
Ising/Glauber dynamics
```

Applications:

```txt
traffic flow
epidemics on networks
opinion spread
statistical physics
distributed systems models
```

## 31. Quantum Markov Chains

Quantum Markov chains replace probability vectors with density matrices and
stochastic matrices with completely positive trace-preserving maps.

Classical:

```txt
mu_{n+1} = mu_n P
```

Quantum:

```txt
rho_{n+1} = E(rho_n)
```

where `rho` is a density operator and `E` is a quantum channel.

Applications:

```txt
quantum computing error models
quantum communication channels
open quantum systems
```

## 32. Higher-Order Markov Models

A standard Markov chain has memory one:

```txt
Pr(X_{n+1} | X_n, X_{n-1}, ...)
  =
Pr(X_{n+1} | X_n)
```

A higher-order Markov chain allows dependence on the last `k` states:

```txt
Pr(X_{n+1} | X_n, ..., X_{n-k+1})
```

Any finite-order Markov chain can be converted into a first-order chain by
enlarging the state space.

For example, a second-order chain on `X_n` becomes a first-order chain on pairs:

```txt
Y_n = (X_{n-1}, X_n)
```

Applications:

```txt
text generation
music generation
DNA sequence modeling
user behavior prediction
clickstream modeling
```

## 33. Practical Application Map

| Theory | Practical use | Real-world example |
| --- | --- | --- |
| Finite Markov chains | Model switching between discrete states | Weather, credit ratings, customer lifecycle states |
| Transition matrices | Forecast future distributions | Predict app navigation or segment migration |
| Stationary distributions | Find long-run behavior | PageRank and network ranking |
| Absorbing chains | Model eventual endpoints | Loan default, churn, disease recovery or death |
| Continuous-time Markov chains | Random events in continuous time | Call centers, queues, server failures |
| General Markov processes | Continuous or abstract state spaces | Robot position, inventory levels, asset values |
| Diffusions / SDEs | Continuous noisy dynamics | Finance, physics, climate noise, sensor drift |
| Hidden Markov Models | Hidden state with noisy observations | Speech recognition, gene prediction |
| Kalman filters | Linear-Gaussian tracking | GPS, radar, phone motion estimation |
| Particle filters | Nonlinear tracking | Drone localization, video object tracking |
| MDPs | Decisions under uncertainty | Reinforcement learning, robot navigation |
| POMDPs | Decisions with partial observability | Autonomous driving, diagnosis |
| Semi-Markov processes | State duration matters | ICU stays, degradation, insurance claims |
| Renewal theory | Repeated event arrivals | Warranty failures, maintenance cycles |
| Martingales | Fairness, stopping rules, risk | Option pricing, A/B testing, gambling models |
| Random walks | Movement on graphs or spaces | PageRank, social diffusion, graph embeddings |
| Markov random fields | Spatial dependencies | Image denoising, medical segmentation |
| Bayesian networks | Probabilistic reasoning | Medical diagnosis, fraud detection |
| MCMC | Sampling hard distributions | Bayesian statistics, probabilistic programming |
| Ergodic theory | Time averages | Simulation-based estimation |
| Perron-Frobenius theory | Dominant matrix behavior | Search ranking, population models |
| Queueing theory | Waiting lines and congestion | Cloud services, routers, hospitals |
| Branching processes | Reproduction and spread | Epidemics, virality, chain reactions |
| Interacting particle systems | Many local interacting agents | Traffic, opinion spread, epidemics |
| Quantum Markov chains | Noisy quantum state evolution | Quantum error modeling |
| Higher-order Markov models | Recent history matters | Text, music, DNA, clickstreams |

## 34. Concrete Examples

### PageRank

The web is modeled as a huge Markov chain.

```txt
state = web page
transition = follow a link, with random teleportation
stationary distribution = page importance
```

The ranking is the long-run probability that a random surfer lands on each page.

### Speech Recognition

An HMM models hidden phonemes or words and observed audio.

```txt
hidden state = word or phoneme
observation = audio features
goal = most likely hidden sequence given the sound
```

The Viterbi algorithm computes the most likely hidden path.

### Self-Driving Cars

Autonomous vehicles combine filtering and decision models.

```txt
hidden state = true position, velocity, nearby objects
observations = camera, lidar, radar, GPS
actions = brake, accelerate, turn, wait
```

This mixes Markov processes, HMM-style filtering, MDPs, and POMDPs.

### Hospitals

Patient states can be modeled as:

```txt
healthy -> infected -> ICU -> recovered
healthy -> infected -> ICU -> dead
```

Markov and semi-Markov models estimate bed demand, ICU occupancy, recovery
probabilities, and expected time in each state.

### Finance

Diffusions and martingales model asset prices, interest rates, and risk.

Option pricing uses the idea that discounted asset prices behave like
martingales under a risk-neutral probability measure.

### Cloud Infrastructure

A service queue can be modeled as:

```txt
state = number of jobs in queue
arrival = state -> state + 1
service = state -> state - 1
```

This helps answer:

```txt
How many workers are needed?
What is the expected wait time?
When does the system become unstable?
```

## 35. Computer-Science Interpretation

In computer science, Markov theory becomes:

```txt
probabilistic state machines
+ weighted graphs
+ linear algebra
+ dynamic programming
+ simulation
```

### States

Mathematics:

```txt
S = {s_1, s_2, ..., s_n}
```

TypeScript:

```ts
type State = "Sunny" | "Cloudy" | "Rainy";

const states = ["Sunny", "Cloudy", "Rainy"] as const;
```

Large systems usually encode states as integer indices because arrays and
matrices are fast.

### Transition Matrix

Mathematics:

```txt
P_ij = Pr(X_{t+1} = j | X_t = i)
```

TypeScript:

```ts
const P = [
  [0.7, 0.2, 0.1],
  [0.3, 0.4, 0.3],
  [0.2, 0.3, 0.5],
];
```

### Distribution Vector

If:

```txt
mu_t = [1, 0, 0]
```

then the system is certainly in the first state.

One step forward:

```txt
mu_{t+1} = mu_t P
```

TypeScript:

```ts
function stepDistribution(mu: number[], P: number[][]): number[] {
  const next = Array(P.length).fill(0);

  for (let i = 0; i < P.length; i++) {
    for (let j = 0; j < P.length; j++) {
      next[j] += mu[i] * P[i][j];
    }
  }

  return next;
}
```

### Simulation

Instead of evolving the full probability distribution, simulate one path:

```ts
function sampleNext(row: number[]): number {
  const r = Math.random();
  let cumulative = 0;

  for (let i = 0; i < row.length; i++) {
    cumulative += row[i];
    if (r <= cumulative) return i;
  }

  return row.length - 1;
}

function simulate(start: number, P: number[][], steps: number): number[] {
  const path = [start];
  let current = start;

  for (let t = 0; t < steps; t++) {
    current = sampleNext(P[current]);
    path.push(current);
  }

  return path;
}
```

This implements:

```txt
X_{t+1} sampled from P(X_t, .)
```

### Graph Representation

A Markov chain is also a weighted directed graph.

```ts
const graph = {
  Sunny: [
    ["Sunny", 0.7],
    ["Cloudy", 0.2],
    ["Rainy", 0.1],
  ],
  Cloudy: [
    ["Sunny", 0.3],
    ["Cloudy", 0.4],
    ["Rainy", 0.3],
  ],
  Rainy: [
    ["Sunny", 0.2],
    ["Cloudy", 0.3],
    ["Rainy", 0.5],
  ],
};
```

Sparse graph representation is better than a dense matrix when most transition
probabilities are zero.

### Stationary Distribution as an Algorithm

The equation:

```txt
pi P = pi
```

is an eigenvector problem.

A simple approximation repeatedly applies the transition matrix:

```ts
let pi = [1, 0, 0];

for (let k = 0; k < 1000; k++) {
  pi = stepDistribution(pi, P);
}
```

This is the same broad computational pattern used by PageRank.

### Markov Models as Automata

Normal finite-state machine:

```txt
state + input -> next state
```

Markov chain:

```txt
state -> probability distribution over next states
```

MDP:

```txt
state + action -> probability distribution over next states
```

HMM:

```txt
hidden state -> next hidden state
hidden state -> observed symbol
```

So Markov theory extends automata theory with probability.

### Learning a Markov Chain from Data

Given observations:

```txt
A -> B -> A -> C -> A -> B
```

count transitions:

```txt
A -> B: 2
A -> C: 1
B -> A: 1
C -> A: 1
```

Normalize rows:

```txt
Pr(A -> B) = 2/3
Pr(A -> C) = 1/3
Pr(B -> A) = 1
Pr(C -> A) = 1
```

With smoothing:

```txt
P_ij = (N_ij + alpha) / (sum_k N_ik + alpha |S|)
```

This avoids zero probabilities for transitions not seen in the sample.

## 36. SDK Design

The SDK should be layered, not one giant `MarkovTheory` class.

The unifying abstraction is:

```txt
state space + probability distribution + transition kernel
```

Everything else is a specialization:

```txt
HMMs add observations.
MDPs add actions and rewards.
POMDPs add hidden state and beliefs.
CTMCs add generators.
MCMC changes the purpose of the chain.
Random walks specialize transitions on graphs.
```

### Core Types

```ts
type Probability = number;

type Distribution<S> = Map<S, Probability>;

interface Rng {
  next(): number;
}

interface TransitionKernel<S> {
  next(state: S): Distribution<S>;
  sample(state: S, rng?: Rng): S;
}

interface MarkovProcess<S> {
  initial: Distribution<S>;
  kernel: TransitionKernel<S>;
}
```

### Finite Markov Chain

```ts
type Matrix = number[][];

class MarkovChain<S> {
  constructor(
    readonly states: S[],
    readonly transition: Matrix,
    readonly initial?: number[],
  ) {}

  step(distribution: number[]): number[] {
    throw new Error("not implemented");
  }

  simulate(start: S, steps: number): S[] {
    throw new Error("not implemented");
  }

  nStep(n: number): Matrix {
    throw new Error("not implemented");
  }

  stationary(): number[] {
    throw new Error("not implemented");
  }

  isIrreducible(): boolean {
    throw new Error("not implemented");
  }

  period(state: S): number {
    throw new Error("not implemented");
  }

  isAperiodic(): boolean {
    throw new Error("not implemented");
  }
}
```

High-level usage:

```ts
const weather = MarkovChain.from({
  Sunny: { Sunny: 0.7, Cloudy: 0.2, Rainy: 0.1 },
  Cloudy: { Sunny: 0.3, Cloudy: 0.4, Rainy: 0.3 },
  Rainy: { Sunny: 0.2, Cloudy: 0.3, Rainy: 0.5 },
});

weather.stepFrom("Sunny");
weather.simulate("Sunny", 30);
weather.stationary();
weather.probabilityAfter("Sunny", "Rainy", 10);
```

The user should not need to think about matrix indices unless they want to.

### Suggested Package Layout

```txt
src/
  core/
    distribution.ts
    matrix.ts
    rng.ts
    validation.ts
    state-space.ts

  chains/
    markov-chain.ts
    absorbing-chain.ts
    classification.ts
    stationary.ts
    hitting-times.ts

  continuous/
    ctmc.ts
    generator.ts
    poisson.ts

  hmm/
    hidden-markov-model.ts
    forward.ts
    backward.ts
    viterbi.ts
    baum-welch.ts

  mdp/
    mdp.ts
    policy.ts
    value-iteration.ts
    policy-iteration.ts

  pomdp/
    pomdp.ts
    belief-state.ts
    belief-update.ts

  mcmc/
    metropolis-hastings.ts
    gibbs.ts
    diagnostics.ts

  graphs/
    random-walk.ts
    pagerank.ts

  queues/
    birth-death.ts
    mm1.ts

  index.ts
```

### Markov Chain Construction

Expose both dictionary and matrix construction.

Dictionary:

```ts
const chain = MarkovChain.from({
  A: { A: 0.1, B: 0.9 },
  B: { A: 0.4, B: 0.6 },
});
```

Internally:

```txt
states = ["A", "B"]

transition =
[
  [0.1, 0.9],
  [0.4, 0.6]
]
```

Core methods:

```ts
chain.transitionProbability("A", "B");
chain.distributionAfter({ A: 1 }, 5);
chain.pathProbability(["A", "B", "B", "A"]);
chain.stationary();
chain.classify();
chain.expectedReturnTime("A");
```

### Absorbing Chains

```ts
const chain = AbsorbingChain.from({
  Start: { Work: 0.8, Churn: 0.2 },
  Work: { Work: 0.6, Success: 0.3, Churn: 0.1 },
  Success: { Success: 1 },
  Churn: { Churn: 1 },
});

chain.absorbingStates();
chain.absorptionProbabilities();
chain.expectedTimeToAbsorption();
```

This wraps:

```txt
N = (I - Q)^{-1}
B = N R
t = N 1
```

but exposes results by named state.

### Hidden Markov Models

```ts
const hmm = HiddenMarkovModel.from({
  states: ["Healthy", "Sick"],
  observations: ["normal", "dizzy", "fever"],
  initial: { Healthy: 0.8, Sick: 0.2 },
  transition: {
    Healthy: { Healthy: 0.7, Sick: 0.3 },
    Sick: { Healthy: 0.4, Sick: 0.6 },
  },
  emission: {
    Healthy: { normal: 0.8, dizzy: 0.15, fever: 0.05 },
    Sick: { normal: 0.1, dizzy: 0.3, fever: 0.6 },
  },
});

hmm.forward(["normal", "fever"]);
hmm.viterbi(["normal", "dizzy", "fever"]);
hmm.sample(20);
```

### MDPs

```ts
const mdp = MDP.from({
  states: ["Low", "High"],
  actions: ["Save", "Spend"],
  discount: 0.95,

  transition: {
    Low: {
      Save: { Low: 0.7, High: 0.3 },
      Spend: { Low: 0.9, High: 0.1 },
    },
    High: {
      Save: { High: 0.9, Low: 0.1 },
      Spend: { High: 0.6, Low: 0.4 },
    },
  },

  reward: {
    Low: { Save: 1, Spend: 3 },
    High: { Save: 2, Spend: 5 },
  },
});

const result = mdp.valueIteration();

result.policy;
result.values;
```

Core algorithms:

```ts
mdp.evaluatePolicy(policy);
mdp.valueIteration();
mdp.policyIteration();
mdp.simulate(policy, startState, steps);
```

### POMDPs

A POMDP should be belief-oriented:

```ts
pomdp.updateBelief({
  belief,
  action: "Move",
  observation: "WallNearby",
});
```

The user interacts with probability distributions over hidden states rather than
directly with hidden states.

### MCMC

```ts
const sampler = metropolisHastings({
  initial: 0,
  logTarget: (x) => -0.5 * x * x,
  proposal: (x) => x + randomNormal(0, 1),
});

const samples = sampler.run({
  iterations: 10_000,
  burnIn: 1_000,
});
```

This belongs in the same SDK because MCMC uses Markov chains as computational
machinery.

### Three SDK Layers

Keep the SDK organized around three levels:

```txt
1. Mathematical primitives
   Distribution, Matrix, Kernel, StateSpace

2. Models
   MarkovChain, CTMC, HMM, MDP, POMDP, RandomWalk

3. Algorithms
   stationary(), viterbi(), valueIteration(), pagerank(), metropolisHastings()
```

The high-level API should make simple things easy:

```ts
const model = MarkovChain.from(...);

model.analyze();
model.simulate();
model.predict();
model.fit(data);
```

while still keeping the math inspectable:

```ts
model.matrix;
model.states;
model.kernel;
```

## 37. Big Picture

Markov chains are the study of powers of stochastic matrices.

The broader theory is the study of uncertain state evolution:

```txt
Markov chains
  subset of Markov processes
  subset of stochastic processes
```

Adjacent theories arise by relaxing or enriching some part of the basic model:

```txt
probability vectors -> measures or quantum density matrices
discrete time -> continuous time
finite matrices -> kernels, generators, graphs, or operators
passive dynamics -> controlled dynamics
visible state -> hidden state
memoryless dynamics -> semi-Markov or higher-order dynamics
single process -> interacting multi-agent or particle systems
```

In computer science, the same ideas become:

```txt
states as data structures
transitions as weighted edges or matrices
probability updates as algorithms
long-term behavior as linear algebra
decisions as dynamic programming
uncertainty as Bayesian filtering
sampling as MCMC
```

The core SDK design principle:

```txt
Make the model easy to use at a high level, but keep the underlying math visible.
```

## 38. Trace Logic Layer

The SDK now includes a finite-state trace layer for observer-window style models.
This layer implements standard finite Markov-chain constructions and uses
physics/consciousness language only as modeling analogy.

Given a parent chain with visible states `A` and hidden states `B`, the induced
visible trace is:

```txt
P_trace = P_AA + P_AB (I - P_BB)^-1 P_BA
```

This differs from simply deleting hidden states and renormalizing rows. Hidden
states may contain corridors through which probability leaves the visible
window and later re-enters. The trace matrix is the exact finite-chain dynamics
seen at re-entry times, provided hidden states return to the visible window with
probability one.

The trace layer exposes:

```txt
traceChain(parent, visibleStates)
traceKernelOnParent(parent, visibleStates)
naiveRestriction(parent, visibleStates)
estimateTraceFromPath(path, visibleStates)
traceObservationDiagnostics(parent, visibleStates, path)
restrictedStationaryBelief(parent, visibleStates)
traceStationaryDiagnostics(parent, visibleStates)
ObserverWindow
EnhancedMarkovChain
counterDilation(fullPath, visibleStates)
TracePoset
localTraceMeet / localTraceJoin / localTraceComplement
PolicyOverWindows
RecursiveTraceSystem
dirichletForm / conductance / metastableCommunities
finite event logic over probability measures
entropyRate / determinantInvariant / traceDynamicsInvariants
Markov linear no-cloning demonstrations
```

There are two useful representations of a trace:

```txt
1. As a Markov chain on only the visible states.
2. As a semimarkovian kernel on the parent state space whose support is the
   visible window and whose hidden rows are zero.
```

The second representation is useful when comparing many observer windows that
all live inside the same parent system. The SDK exposes it with
`traceKernelOnParent`.

For an irreducible finite parent chain, the stationary distribution of the
trace equals the normalized restriction of the parent stationary distribution
to the visible window:

```txt
pi_trace(a) = pi_parent(a) / sum_{b in A} pi_parent(b)
```

The SDK exposes this as `restrictedStationaryBelief` and
`traceStationaryDiagnostics`. This is the finite SDK analogue of the stationary
measure map from trace order to probability-measure logic.

Real observations are finite samples, not infinite traces. Given a full or
partially reconstructed path, `estimateTraceFromPath` filters to visible states
and estimates the transition matrix between consecutive visible observations.
`traceObservationDiagnostics` compares that empirical visible chain with the
theoretical trace induced by the parent chain.

The trace layer also exposes finite dynamics diagnostics:

```txt
entropyRate(P) = - sum_i pi_i sum_j P_ij log2(P_ij)
determinantInvariant(P) = det(P)
```

These are ordinary finite-matrix quantities. They can be used to compare
predictability, degeneracy, or coarse-graining behavior. They are not presented
as physical mass, spin, or a derivation of spacetime.

Interpretation boundaries:

```txt
observer window = named finite Markov chain + visible states
belief = stationary distribution of an observer window
counter dilation = fewer visible ticks than full parent-chain ticks
apparent jump = hidden-corridor toy model
local trace logic = Boolean set operations inside one fixed parent window
```

The SDK does not claim to derive relativity, quantum field theory, or
consciousness. It provides executable finite models for exploring those analogies
and for testing which claims survive concrete Markov-chain calculations.
