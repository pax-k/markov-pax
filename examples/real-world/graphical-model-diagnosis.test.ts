import { describe, expect, test } from "bun:test";
import { BayesianNetwork, MarkovRandomField, mrfEdgeKey } from "../../index.ts";

const key = (values: readonly string[]) => JSON.stringify(values);

describe("real-world example: diagnosis and denoising graphical models", () => {
  test("updates disease belief and smooths neighboring image labels", () => {
    const diagnosis = new BayesianNetwork({
      variables: ["Flu", "Fever"],
      domains: { Flu: ["yes", "no"], Fever: ["yes", "no"] },
      parents: { Flu: [], Fever: ["Flu"] },
      cpt: {
        Flu: { [key([])]: { yes: 0.08, no: 0.92 } },
        Fever: { [key(["yes"])]: { yes: 0.85, no: 0.15 }, [key(["no"])]: { yes: 0.1, no: 0.9 } },
      },
    });

    const image = new MarkovRandomField({
      variables: ["P1", "P2"],
      domains: { P1: ["tissue", "background"], P2: ["tissue", "background"] },
      edges: [["P1", "P2"]],
      unary: { P1: { tissue: 3, background: 1 }, P2: { tissue: 1, background: 2 } },
      pairwise: {
        [mrfEdgeKey("P1", "P2")]: {
          [key(["tissue", "tissue"])]: 4,
          [key(["background", "background"])]: 4,
          [key(["tissue", "background"])]: 1,
          [key(["background", "tissue"])]: 1,
        },
      },
    });

    expect(diagnosis.query("Flu", { Fever: "yes" }).yes).toBeGreaterThan(0.08);
    expect(image.conditional("P2", { P1: "tissue", P2: "background" }).tissue).toBeGreaterThan(0.5);
  });
});
