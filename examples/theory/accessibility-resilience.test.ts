import { describe, expect, test } from "bun:test";
import { accessibilityMetrics, resilienceMetrics } from "../../index.ts";

describe("theory example: accessibility and resilience metrics", () => {
  test("summarizes service access, equity gap, and normalized resilience", () => {
    const access = accessibilityMetrics({
      demand: { zoneA: 100, zoneB: 100 },
      delivered: { zoneA: 100, zoneB: 50 },
    });
    const resilience = resilienceMetrics({
      accessibility: access.accessibility,
      baselineAccessibility: 1,
      responseTime: 12,
      baselineResponseTime: 10,
      cost: 120,
      baselineCost: 100,
    });

    expect(access.accessibility).toBe(0.75);
    expect(access.equityGap).toBe(0.5);
    expect(resilience.resilienceIndex).toBeGreaterThan(0);
    expect(resilience.resilienceIndex).toBeLessThan(1);
  });
});
