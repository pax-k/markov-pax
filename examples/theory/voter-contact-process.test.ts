import { describe, expect, test } from "bun:test";
import { SeededRng, contactProcess, voterModel } from "../../index.ts";

describe("theory example: interacting particle systems", () => {
  test("updates one local component according to neighbor states", () => {
    const graph = { A: ["B"], B: ["A"] };
    const voter = voterModel(graph, { A: 1, B: 0 });
    const contact = contactProcess(graph, { A: 1, B: 0 }, 1, 0);

    expect(voter.step({ A: 1, B: 0 }, { rng: new SeededRng(1) })).toBeDefined();
    expect(contact.step({ A: 1, B: 0 }, { rng: new SeededRng(2) }).B).toBe(1);
  });
});
