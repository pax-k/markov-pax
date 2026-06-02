import { describe, expect, test } from "bun:test";
import { QuantumMarkovChain, bitFlipChannel, complex, trace } from "../../index.ts";

describe("module example: quantum Markov chains", () => {
  test("applies repeated quantum noise to a density matrix", () => {
    const zero = [[complex(1), complex(0)], [complex(0), complex(0)]];
    const chain = new QuantumMarkovChain(zero, bitFlipChannel(0.1));
    const states = chain.simulate(3);

    expect(states).toHaveLength(4);
    expect(trace(states.at(-1)!).re).toBeCloseTo(1);
  });
});
