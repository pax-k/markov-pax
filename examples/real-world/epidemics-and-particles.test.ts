import { describe, expect, test } from "bun:test";
import { GaltonWatsonProcess, SeededRng, contactProcess } from "../../index.ts";

describe("real-world example: epidemic cascades and network spread", () => {
  test("combines branching-process risk with local contact spread", () => {
    const earlyOutbreak = new GaltonWatsonProcess({ 0: 0.35, 1: 0.25, 2: 0.4 });
    const network = contactProcess(
      { A: ["B"], B: ["A", "C"], C: ["B"] },
      { A: 1, B: 0, C: 0 },
      0.8,
      0.1,
    );
    const path = network.simulate(5, { rng: new SeededRng(15) });

    expect(earlyOutbreak.classification()).toBe("supercritical");
    expect(earlyOutbreak.extinctionProbability()).toBeLessThan(1);
    expect(Object.values(network.stateCounts(path.at(-1)!)).reduce((a, b) => a + b, 0)).toBe(3);
  });
});
