import { describe, expect, test } from "bun:test";
import { MarkovRandomField, mrfEdgeKey } from "../../index.ts";

const key = (values: readonly string[]) => JSON.stringify(values);

describe("theory example: Markov random field locality", () => {
  test("conditions a variable only on neighboring labels", () => {
    const mrf = new MarkovRandomField({
      variables: ["Center", "Neighbor"],
      domains: { Center: ["0", "1"], Neighbor: ["0", "1"] },
      edges: [["Center", "Neighbor"]],
      unary: { Center: { "0": 1, "1": 1 }, Neighbor: { "0": 1, "1": 1 } },
      pairwise: {
        [mrfEdgeKey("Center", "Neighbor")]: {
          [key(["0", "0"])]: 3,
          [key(["1", "1"])]: 3,
          [key(["0", "1"])]: 1,
          [key(["1", "0"])]: 1,
        },
      },
    });

    expect(mrf.conditional("Center", { Center: "1", Neighbor: "0" })["0"]).toBeGreaterThan(0.5);
  });
});
