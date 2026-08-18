import { expect, test } from "bun:test";
import { MDP, SeededRng, contactProcess } from "../../index.ts";

test("seeded abstract compromise propagation selects team isolation or reorganization", () => {
  const teamModel = contactProcess(
    {
      Alpha: ["Bravo", "Charlie"],
      Bravo: ["Alpha", "Delta"],
      Charlie: ["Alpha", "Delta"],
      Delta: ["Bravo", "Charlie"],
    },
    { Alpha: 1, Bravo: 0, Charlie: 0, Delta: 0 },
    0.9,
    0.05,
  );
  const firstRun = teamModel.simulate(8, { rng: new SeededRng(202) });
  const replay = teamModel.simulate(8, { rng: new SeededRng(202) });
  const finalCounts = teamModel.stateCounts(firstRun.at(-1)!);

  const recovery = MDP.from({
    states: ["TeamHealthy", "PartialLoss", "WidespreadLoss"],
    actions: ["Continue", "IsolateAffected", "ReorganizeTeam"],
    discount: 0.85,
    transition: {
      TeamHealthy: {
        Continue: { TeamHealthy: 0.9, PartialLoss: 0.1 },
        IsolateAffected: { TeamHealthy: 0.96, PartialLoss: 0.04 },
        ReorganizeTeam: { TeamHealthy: 0.94, PartialLoss: 0.06 },
      },
      PartialLoss: {
        Continue: { TeamHealthy: 0.1, PartialLoss: 0.55, WidespreadLoss: 0.35 },
        IsolateAffected: { TeamHealthy: 0.65, PartialLoss: 0.3, WidespreadLoss: 0.05 },
        ReorganizeTeam: { TeamHealthy: 0.55, PartialLoss: 0.4, WidespreadLoss: 0.05 },
      },
      WidespreadLoss: {
        Continue: { PartialLoss: 0.1, WidespreadLoss: 0.9 },
        IsolateAffected: { TeamHealthy: 0.2, PartialLoss: 0.55, WidespreadLoss: 0.25 },
        ReorganizeTeam: { TeamHealthy: 0.55, PartialLoss: 0.4, WidespreadLoss: 0.05 },
      },
    },
    reward: {
      TeamHealthy: { Continue: 6, IsolateAffected: 2, ReorganizeTeam: 1 },
      PartialLoss: { Continue: -7, IsolateAffected: 6, ReorganizeTeam: 4 },
      WidespreadLoss: { Continue: -12, IsolateAffected: 2, ReorganizeTeam: 7 },
    },
  });
  const policy = recovery.valueIteration().policy;

  expect(firstRun).toEqual(replay);
  expect(finalCounts[1]).toBeGreaterThan(1);
  expect((finalCounts[0] ?? 0) + (finalCounts[1] ?? 0)).toBe(4);
  expect(["IsolateAffected", "ReorganizeTeam"]).toContain(policy.PartialLoss);
  expect(policy.WidespreadLoss).toBe("ReorganizeTeam");
});
