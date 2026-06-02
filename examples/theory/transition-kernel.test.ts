import { describe, expect, test } from "bun:test";
import { KernelChain, finiteKernel } from "../../index.ts";

describe("theory example: transition kernels", () => {
  test("represents K(x, A) through a sampler over next states", () => {
    const kernel = finiteKernel({ x: { x: 0.4, y: 0.6 }, y: { x: 1 } });
    const process = new KernelChain(kernel);

    expect(process.simulate("y", 1).at(-1)).toBe("x");
  });
});
