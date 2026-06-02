import { describe, expect, test } from "bun:test";
import { QuantumMarkovChain, bitFlipChannel, complex, trace } from "../../index.ts";

describe("real-world example: quantum memory bit-flip noise", () => {
  test("tracks repeated noise applied to a stored qubit", () => {
    const storedZero = [[complex(1), complex(0)], [complex(0), complex(0)]];
    const memory = new QuantumMarkovChain(storedZero, bitFlipChannel(0.02));
    const afterTenTicks = memory.simulate(10).at(-1)!;

    expect(trace(afterTenTicks).re).toBeCloseTo(1);
    expect(afterTenTicks[0]![0]!.re).toBeGreaterThan(afterTenTicks[1]![1]!.re);
  });
});
