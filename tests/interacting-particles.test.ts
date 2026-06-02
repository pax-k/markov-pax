import { describe, expect, test } from "bun:test";
import {
  InteractingParticleSystem,
  SeededRng,
  contactProcess,
  exclusionProcess,
  glauberIsingModel,
  voterModel,
} from "../index.ts";

describe("interacting particle systems", () => {
  test("runs voter, contact, exclusion, and Glauber dynamics", () => {
    const graph = { A: ["B"], B: ["A"] };
    const voter = voterModel(graph, { A: 1, B: 0 });
    const voterPath = voter.simulate(3, { rng: new SeededRng(1) });
    expect(voterPath).toHaveLength(4);
    expect(Object.values(voter.stateCounts(voterPath.at(-1)!)).reduce((a, b) => a + b, 0)).toBe(2);
    expect(voter.consensusReached({ A: 1, B: 1 })).toBe(true);

    const contact = contactProcess(graph, { A: 1, B: 0 }, 1, 0);
    expect(contact.step({ A: 1, B: 0 }, { rng: new SeededRng(2) }).B).toBe(1);
    const recovered = contactProcess(graph, { A: 1, B: 0 }, 1, 1);
    expect(recovered.step({ A: 1, B: 0 }, { rng: new SeededRng(2) }).A).toBe(0);

    const exclusion = exclusionProcess(graph, { A: 1, B: 0 });
    expect(exclusion.step({ A: 1, B: 0 }, { rng: new SeededRng(3) }).B).toBe(1);
    expect(exclusionProcess(graph, { A: 0, B: 0 }).step({ A: 0, B: 0 }, { rng: new SeededRng(3) })).toEqual({ A: 0, B: 0 });

    const ising = glauberIsingModel(graph, { A: 1, B: -1 }, 0.5);
    expect(Number.isFinite(ising.step({ A: 1, B: -1 }, { rng: new SeededRng(4) }).A)).toBe(true);
  });

  test("rejects invalid particle systems and inputs", () => {
    expect(() => voterModel({ A: [] }, { A: 1 })).toThrow();
    expect(() => voterModel({ A: ["B"] as unknown as "A"[] }, { A: 1 })).toThrow();
    expect(() => contactProcess({ A: ["A"] }, { A: 1 }, -1, 0)).toThrow();
    expect(() => contactProcess({ A: ["A"] }, { A: 1 }, 0, 2)).toThrow();
    expect(() => glauberIsingModel({ A: ["A"] }, { A: 1 }, Number.NaN)).toThrow();
    const system = new InteractingParticleSystem({ nodes: ["A"], initial: { A: 1 }, update: () => ({ A: Number.NaN }) });
    expect(() => system.step({ A: 1 })).toThrow();
    expect(() => system.simulate(-1)).toThrow();
    expect(() => system.stateCounts({ A: Number.NaN })).toThrow();
  });
});
