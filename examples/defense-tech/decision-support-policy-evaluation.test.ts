import { expect, test } from "bun:test";
import { MDP, MarkovChain, SeededRng } from "../../index.ts";

type Scenario = "StableContext" | "ChangedContext" | "RecoveringContext";
type Action = "FixedBaseline" | "AdaptivePlan";

function evaluateScenarioPaths(
  chain: MarkovChain<Scenario>,
  policy: Record<Scenario, Action>,
  reward: Record<Scenario, Record<Action, number>>,
) {
  let value = 0;
  const counts: Record<Scenario, number> = {
    StableContext: 0,
    ChangedContext: 0,
    RecoveringContext: 0,
  };
  for (let trial = 0; trial < 100; trial++) {
    const path = chain.simulate("StableContext", 10, { rng: new SeededRng(400 + trial) });
    for (const state of path) {
      counts[state] += 1;
      value += reward[state][policy[state]];
    }
  }
  return { counts, meanValue: value / 100 };
}

test("a robust abstract policy outperforms a fixed baseline across seeded scenarios", () => {
  const scenarios = MarkovChain.from<Scenario>({
    StableContext: { StableContext: 0.65, ChangedContext: 0.25, RecoveringContext: 0.1 },
    ChangedContext: { StableContext: 0.1, ChangedContext: 0.6, RecoveringContext: 0.3 },
    RecoveringContext: { StableContext: 0.45, ChangedContext: 0.15, RecoveringContext: 0.4 },
  });
  const transition = {
    StableContext: {
      FixedBaseline: { StableContext: 0.7, ChangedContext: 0.2, RecoveringContext: 0.1 },
      AdaptivePlan: { StableContext: 0.72, ChangedContext: 0.13, RecoveringContext: 0.15 },
    },
    ChangedContext: {
      FixedBaseline: { StableContext: 0.08, ChangedContext: 0.72, RecoveringContext: 0.2 },
      AdaptivePlan: { StableContext: 0.25, ChangedContext: 0.3, RecoveringContext: 0.45 },
    },
    RecoveringContext: {
      FixedBaseline: { StableContext: 0.35, ChangedContext: 0.25, RecoveringContext: 0.4 },
      AdaptivePlan: { StableContext: 0.55, ChangedContext: 0.1, RecoveringContext: 0.35 },
    },
  };
  const reward: Record<Scenario, Record<Action, number>> = {
    StableContext: { FixedBaseline: 7, AdaptivePlan: 6 },
    ChangedContext: { FixedBaseline: -6, AdaptivePlan: 7 },
    RecoveringContext: { FixedBaseline: 1, AdaptivePlan: 6 },
  };
  const decisionModel = MDP.from({
    states: ["StableContext", "ChangedContext", "RecoveringContext"],
    actions: ["FixedBaseline", "AdaptivePlan"],
    discount: 0.9,
    transition,
    reward,
  });
  const robustPolicy = decisionModel.valueIteration().policy;
  const fixedPolicy: Record<Scenario, Action> = {
    StableContext: "FixedBaseline",
    ChangedContext: "FixedBaseline",
    RecoveringContext: "FixedBaseline",
  };
  const robust = evaluateScenarioPaths(scenarios, robustPolicy, reward);
  const baseline = evaluateScenarioPaths(scenarios, fixedPolicy, reward);
  const replay = evaluateScenarioPaths(scenarios, robustPolicy, reward);

  expect(robustPolicy.ChangedContext).toBe("AdaptivePlan");
  expect(robustPolicy.RecoveringContext).toBe("AdaptivePlan");
  expect(robust.meanValue).toBeGreaterThan(baseline.meanValue);
  expect(robust.counts).toEqual(replay.counts);
  expect(Object.values(robust.counts).reduce((sum, count) => sum + count, 0)).toBe(1_100);
});
