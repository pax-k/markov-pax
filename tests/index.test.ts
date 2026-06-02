import { describe, expect, test } from "bun:test";
import * as SDK from "../index.ts";

describe("package root exports", () => {
  test("exposes representative SDK classes and functions from the root entrypoint", () => {
    expect(SDK.MarkovChain).toBeFunction();
    expect(SDK.AbsorbingChain).toBeFunction();
    expect(SDK.CTMC).toBeFunction();
    expect(SDK.HiddenMarkovModel).toBeFunction();
    expect(SDK.MDP).toBeFunction();
    expect(SDK.POMDP).toBeFunction();
    expect(SDK.RandomWalkGraph).toBeFunction();
    expect(SDK.MM1Queue).toBeFunction();
    expect(SDK.BirthDeathProcess).toBeFunction();
    expect(SDK.SeededRng).toBeFunction();
    expect(SDK.matrixMultiply).toBeFunction();
    expect(SDK.pagerank).toBeFunction();
    expect(SDK.metropolisHastings).toBeFunction();
    expect(SDK.gibbsSampler).toBeFunction();
    expect(SDK.KernelChain).toBeFunction();
    expect(SDK.HigherOrderMarkovModel).toBeFunction();
    expect(SDK.spectralGap).toBeFunction();
    expect(SDK.SemiMarkovProcess).toBeFunction();
    expect(SDK.RenewalProcess).toBeFunction();
    expect(SDK.Diffusion1D).toBeFunction();
    expect(SDK.hittingProbability).toBeFunction();
    expect(SDK.timeAverage).toBeFunction();
    expect(SDK.mala).toBeFunction();
    expect(SDK.baumWelch).toBeFunction();
    expect(SDK.BayesianNetwork).toBeFunction();
    expect(SDK.MarkovRandomField).toBeFunction();
    expect(SDK.GaltonWatsonProcess).toBeFunction();
    expect(SDK.voterModel).toBeFunction();
    expect(SDK.QuantumChannel).toBeFunction();
  });
});
