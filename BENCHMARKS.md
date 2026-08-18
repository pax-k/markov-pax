# Manual Finite-Scale Benchmark

Run:

```sh
bun run benchmark
```

The benchmark creates a reversible 12-state ring chain. It performs two bounded exact operations:

- It builds all 4,095 nonempty trace windows. Twelve states are the default full-enumeration limit.
- It scores all 2,509 subsets of size one through six for conductance, then returns the best ten cuts.

The script verifies result counts and finite conductance values. It prints elapsed times for local comparison. It does not enforce a time threshold because host speed and load differ.

This benchmark is manual and deterministic apart from elapsed time. It does not measure large-state approximate methods, memory limits, browser performance, or production workloads.
