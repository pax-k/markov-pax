import { describe, expect, test } from "bun:test";
import { bitFlipChannel, complex, trace } from "../../index.ts";

describe("theory example: quantum channels", () => {
  test("updates a density matrix as rho_{n+1} = E(rho_n)", () => {
    const rho = [[complex(1), complex(0)], [complex(0), complex(0)]];
    const next = bitFlipChannel(0.25).apply(rho);

    expect(next[0]![0]!.re).toBeCloseTo(0.75);
    expect(trace(next).re).toBeCloseTo(1);
  });
});
