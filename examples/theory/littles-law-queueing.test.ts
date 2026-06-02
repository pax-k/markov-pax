import { describe, expect, test } from "bun:test";
import { MMcQueue } from "../../index.ts";

describe("theory example: Little's law for queues", () => {
  test("checks L = lambda W for the system and waiting line", () => {
    const queue = new MMcQueue({ arrivalRate: 3, serviceRate: 2, servers: 2 });

    expect(queue.expectedNumberInSystem()).toBeCloseTo(
      queue.arrivalRate * queue.expectedTimeInSystem(),
    );
    expect(queue.expectedNumberInQueue()).toBeCloseTo(
      queue.arrivalRate * queue.expectedTimeInQueue(),
    );
  });
});
