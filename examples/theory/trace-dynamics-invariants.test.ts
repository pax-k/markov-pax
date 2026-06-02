import { describe, expect, test } from "bun:test";
import { MarkovChain, traceDynamicsInvariants } from "../../index.ts";

describe("theory example: finite trace dynamics diagnostics", () => {
  test("entropy rate measures transition unpredictability and determinant is a matrix invariant", () => {
    const deterministic = MarkovChain.from({
      a: { b: 1 },
      b: { a: 1 },
    });
    const noisy = MarkovChain.from({
      a: { a: 0.7, b: 0.3 },
      b: { a: 0.4, b: 0.6 },
    });

    const deterministicDiagnostics = traceDynamicsInvariants(deterministic);
    const noisyDiagnostics = traceDynamicsInvariants(noisy);

    expect(deterministicDiagnostics.entropyRate).toBeCloseTo(0);
    expect(noisyDiagnostics.entropyRate).toBeGreaterThan(deterministicDiagnostics.entropyRate);
    expect(noisyDiagnostics.determinant).toBeCloseTo(0.3);
  });
});
