import { describe, expect, test } from "bun:test";
import {
  AbsorbingChain,
  BayesianNetwork,
  HiddenMarkovModel,
  MDP,
  SeededRng,
  metropolisHastings,
  pagerank,
} from "../../index.ts";

const key = (values: readonly string[]) => JSON.stringify(values);

describe("real-world example: fraud kill chain", () => {
  test("infers account compromise, ranks risky entities, chooses friction, and estimates alert uncertainty", () => {
    const accountState = HiddenMarkovModel.from({
      states: ["Normal", "Compromised", "Exfiltrating"],
      observations: ["usual-login", "new-device", "large-transfer"],
      initial: { Normal: 0.92, Compromised: 0.07, Exfiltrating: 0.01 },
      transition: {
        Normal: { Normal: 0.9, Compromised: 0.09, Exfiltrating: 0.01 },
        Compromised: { Normal: 0.15, Compromised: 0.65, Exfiltrating: 0.2 },
        Exfiltrating: { Compromised: 0.2, Exfiltrating: 0.8 },
      },
      emission: {
        Normal: { "usual-login": 0.85, "new-device": 0.13, "large-transfer": 0.02 },
        Compromised: { "usual-login": 0.2, "new-device": 0.55, "large-transfer": 0.25 },
        Exfiltrating: { "usual-login": 0.05, "new-device": 0.25, "large-transfer": 0.7 },
      },
    });

    const alertModel = new BayesianNetwork({
      variables: ["Fraud", "Device", "Amount"],
      domains: { Fraud: ["yes", "no"], Device: ["new", "known"], Amount: ["large", "normal"] },
      parents: { Fraud: [], Device: ["Fraud"], Amount: ["Fraud"] },
      cpt: {
        Fraud: { [key([])]: { yes: 0.04, no: 0.96 } },
        Device: { [key(["yes"])]: { new: 0.7, known: 0.3 }, [key(["no"])]: { new: 0.1, known: 0.9 } },
        Amount: { [key(["yes"])]: { large: 0.65, normal: 0.35 }, [key(["no"])]: { large: 0.08, normal: 0.92 } },
      },
    });

    const lossPath = AbsorbingChain.from({
      Flagged: { Reviewed: 0.7, Loss: 0.3 },
      Reviewed: { Prevented: 0.85, Loss: 0.15 },
      Prevented: { Prevented: 1 },
      Loss: { Loss: 1 },
    });

    const response = MDP.from({
      states: ["Suspicious", "HighRisk"],
      actions: ["MFA", "Lock"],
      discount: 0.9,
      transition: {
        Suspicious: { MFA: { Suspicious: 0.85, HighRisk: 0.15 }, Lock: { Suspicious: 0.95, HighRisk: 0.05 } },
        HighRisk: { MFA: { HighRisk: 0.55, Suspicious: 0.45 }, Lock: { HighRisk: 0.2, Suspicious: 0.8 } },
      },
      reward: {
        Suspicious: { MFA: 3, Lock: 1 },
        HighRisk: { MFA: -2, Lock: 4 },
      },
    });

    const riskGraph: Record<string, readonly string[]> = {
      Account: ["Device", "Merchant"],
      Device: ["Account"],
      Merchant: ["Account"],
      Mule: ["Merchant", "Account"],
    };
    const ranks = pagerank(riskGraph);
    const falsePositivePosterior = metropolisHastings({
      initial: 0.1,
      rng: new SeededRng(50),
      logTarget: (p) => p <= 0 || p >= 1 ? Number.NEGATIVE_INFINITY : 8 * Math.log(p) + 92 * Math.log(1 - p),
      proposal: (p, rng) => Math.min(0.99, Math.max(0.01, p + rng.normal(0, 0.03))),
    }).run({ iterations: 800, burnIn: 100 });

    const observations = ["usual-login", "new-device", "large-transfer"] as const;
    const posterior = accountState.forward(observations).posterior;
    const fraudGivenSignals = alertModel.query("Fraud", { Device: "new", Amount: "large" });
    const absorption = lossPath.absorptionProbabilities();
    const policy = response.valueIteration().policy;

    expect(posterior.Exfiltrating).toBeGreaterThan(posterior.Normal);
    expect(fraudGivenSignals.yes).toBeGreaterThan(0.2);
    expect(absorption.Flagged.Prevented).toBeGreaterThan(absorption.Flagged.Loss);
    expect(policy.HighRisk).toBe("Lock");
    expect(ranks.Account!).toBeGreaterThan(ranks.Device!);
    expect(falsePositivePosterior.mean()).toBeLessThan(0.2);
  });
});
