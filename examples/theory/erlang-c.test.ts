import { describe, expect, test } from "bun:test";
import { MMcQueue } from "../../index.ts";

describe("theory example: Erlang-C", () => {
  test("computes the probability an arrival must wait in an M/M/c queue", () => {
    const queue = new MMcQueue({ arrivalRate: 6, serviceRate: 4, servers: 2 });

    // Erlang-C is P(wait), the stationary probability an arrival finds all servers busy.
    expect(queue.erlangC()).toBeCloseTo(queue.probabilityOfWait());
    expect(queue.erlangC()).toBeGreaterThan(0);
    expect(queue.erlangC()).toBeLessThan(1);
  });
});
