import { describe, expect, test } from "bun:test";
import {
  QuantumChannel,
  QuantumMarkovChain,
  amplitudeDampingChannel,
  applyChannel,
  bitFlipChannel,
  complex,
  depolarizingChannel,
  isDensityMatrix,
  isTracePreserving,
  phaseFlipChannel,
  trace,
} from "../index.ts";

describe("quantum Markov chains", () => {
  const zero = [
    [complex(1), complex(0)],
    [complex(0), complex(0)],
  ];

  test("applies trace-preserving quantum channels", () => {
    expect(trace(zero).re).toBe(1);
    expect(isDensityMatrix(zero)).toBe(true);
    expect(isTracePreserving(bitFlipChannel(0.1).kraus)).toBe(true);
    expect(bitFlipChannel(1).apply(zero)[1]![1]!.re).toBeCloseTo(1);
    expect(phaseFlipChannel(0.5).apply([
      [complex(0.5), complex(0.5)],
      [complex(0.5), complex(0.5)],
    ])[0]![1]!.re).toBeCloseTo(0);
    expect(depolarizingChannel(0.3).apply(zero)[1]![1]!.re).toBeGreaterThan(0);
    expect(amplitudeDampingChannel(1).apply([
      [complex(0), complex(0)],
      [complex(0), complex(1)],
    ])[0]![0]!.re).toBeCloseTo(1);

    const chain = new QuantumMarkovChain(zero, bitFlipChannel(0.25));
    expect(chain.step()[0]![0]!.re).toBeCloseTo(0.75);
    expect(chain.simulate(2)).toHaveLength(3);
  });

  test("rejects invalid quantum states and channels", () => {
    expect(() => complex(Number.NaN)).toThrow();
    expect(() => trace([])).toThrow();
    expect(isDensityMatrix([])).toBe(false);
    expect(isDensityMatrix([[complex(1), complex(0)]] as never)).toBe(false);
    expect(isDensityMatrix([[complex(1), complex(1)], [complex(0), complex(0)]])).toBe(false);
    expect(isDensityMatrix([[complex(2), complex(0)], [complex(0), complex(-1)]])).toBe(false);
    expect(isTracePreserving([])).toBe(false);
    expect(isTracePreserving([[[complex(1), complex(0)]] as never])).toBe(false);
    expect(() => new QuantumChannel([])).toThrow();
    expect(() => new QuantumChannel([[[complex(2)]]])).toThrow();
    expect(() => applyChannel([[complex(2)]], [new QuantumChannel([[[complex(1)]]]).kraus[0]!])).toThrow();
    expect(() => new QuantumMarkovChain([[complex(2)]], new QuantumChannel([[[complex(1)]]]))).toThrow();
    expect(() => new QuantumMarkovChain(zero, bitFlipChannel(0.1)).simulate(-1)).toThrow();
    expect(() => bitFlipChannel(-1)).toThrow();
    expect(() => depolarizingChannel(2)).toThrow();
  });
});
