import { describe, expect, test } from "bun:test";
import { MarkovRandomField, mrfEdgeKey } from "../../index.ts";

const key = (values: readonly string[]) => JSON.stringify(values);

describe("module example: Markov random fields", () => {
  test("uses local neighbor compatibility to score labels", () => {
    const mrf = new MarkovRandomField({
      variables: ["A", "B"],
      domains: { A: ["dark", "light"], B: ["dark", "light"] },
      edges: [["A", "B"]],
      unary: { A: { dark: 2, light: 1 }, B: { dark: 2, light: 1 } },
      pairwise: {
        [mrfEdgeKey("A", "B")]: {
          [key(["dark", "dark"])]: 4,
          [key(["dark", "light"])]: 1,
          [key(["light", "dark"])]: 1,
          [key(["light", "light"])]: 4,
        },
      },
    });

    expect(mrf.conditional("A", { A: "light", B: "dark" }).dark).toBeGreaterThan(0.5);
  });
});
