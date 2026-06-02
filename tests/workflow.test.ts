import { describe, expect, test } from "bun:test";
import {
  AbsorbingChain,
  BayesianNetwork,
  CTMC,
  deterministicHoldingTime,
  HiddenMarkovModel,
  MarkovChain,
  MarkovWorkflow,
  MDP,
  POMDP,
  SemiMarkovProcess,
  createWorkflow,
  exponentialHoldingTime,
  workflows,
} from "../index.ts";

function expectDistribution(distribution: Record<string, number>, tolerance = 1e-8) {
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  expect(Math.abs(total - 1)).toBeLessThanOrEqual(tolerance);
}

const riskHMM = HiddenMarkovModel.from({
  states: ["Normal", "Compromised"],
  observations: ["login", "chargeback"],
  initial: { Normal: 0.92, Compromised: 0.08 },
  transition: {
    Normal: { Normal: 0.86, Compromised: 0.14 },
    Compromised: { Normal: 0.25, Compromised: 0.75 },
  },
  emission: {
    Normal: { login: 0.9, chargeback: 0.1 },
    Compromised: { login: 0.25, chargeback: 0.75 },
  },
});

const responseMDP = MDP.from({
  states: ["Normal", "Compromised"],
  actions: ["Allow", "Review"],
  discount: 0.8,
  transition: {
    Normal: {
      Allow: { Normal: 0.9, Compromised: 0.1 },
      Review: { Normal: 0.98, Compromised: 0.02 },
    },
    Compromised: {
      Allow: { Normal: 0.1, Compromised: 0.9 },
      Review: { Normal: 0.75, Compromised: 0.25 },
    },
  },
  reward: {
    Normal: { Allow: 3, Review: 1 },
    Compromised: { Allow: -8, Review: 2 },
  },
});

describe("MarkovWorkflow", () => {
  test("runs HMM inference, absorbing forecast, decision, simulation, and uncertainty stages", () => {
    const churn = AbsorbingChain.from({
      Investigate: { Investigate: 0.4, Recovered: 0.4, Fraud: 0.2 },
      Recovered: { Recovered: 1 },
      Fraud: { Fraud: 1 },
    });
    const activity = MarkovChain.from({
      Normal: { Normal: 0.8, Compromised: 0.2 },
      Compromised: { Normal: 0.3, Compromised: 0.7 },
    });

    const result = MarkovWorkflow.create({ name: "fraud triage" })
      .withInference({ kind: "hmm", model: riskHMM, observations: ["login", "chargeback", "chargeback"] })
      .withForecast({ kind: "absorbing", model: churn, from: "Investigate" })
      .withDecision({ model: responseMDP, state: "Compromised" })
      .withSimulation({ kind: "markov", model: activity, start: "Normal", steps: 3, seed: 7 })
      .withUncertainty({
        parameter: "fraudRate",
        initial: 0.2,
        logTarget: (x) => x > 0 && x < 1 ? -((x - 0.35) ** 2) / 0.02 : Number.NEGATIVE_INFINITY,
        proposalStandardDeviation: 0.05,
        iterations: 80,
        burnIn: 10,
        seed: 11,
      })
      .run();

    expectDistribution(result.belief!);
    expect(result.inferredState).toBe("Compromised");
    expect(result.recommendedAction).toBe("Review");
    expect(result.actionValues!.Review!).toBeGreaterThan(result.actionValues!.Allow!);
    expect(result.simulatedPath).toHaveLength(4);
    expect(result.uncertainty!.fraudRate!.samples.length).toBe(70);
    expect(result.details.inference).toBeDefined();
    expect(result.details.forecast).toBeDefined();
    expect(result.details.decision).toBeDefined();
    expect(result.details.simulation).toBeDefined();
    expect(result.details.uncertainty).toBeDefined();
  });

  test("runs POMDP and Bayesian-network inference with CTMC, MDP, and Semi-Markov stages", () => {
    const pomdp = POMDP.from({
      states: ["InStock", "Backordered"],
      actions: ["Audit"],
      observations: ["ok", "delay"],
      transition: {
        InStock: { Audit: { InStock: 0.8, Backordered: 0.2 } },
        Backordered: { Audit: { InStock: 0.35, Backordered: 0.65 } },
      },
      observation: {
        InStock: { Audit: { ok: 0.85, delay: 0.15 } },
        Backordered: { Audit: { ok: 0.2, delay: 0.8 } },
      },
    });
    const supplier = CTMC.fromGenerator({
      Up: { Up: -0.1, Down: 0.1 },
      Down: { Up: 0.4, Down: -0.4 },
    });
    const service = SemiMarkovProcess.from({
      Queue: { Queue: 0.4, Done: 0.6 },
      Done: { Done: 1 },
    }, {
      Queue: deterministicHoldingTime(2),
      Done: deterministicHoldingTime(1),
    });

    const result = createWorkflow()
      .withInference({ kind: "pomdp", model: pomdp, belief: { InStock: 0.7, Backordered: 0.3 }, action: "Audit", observation: "delay" })
      .withForecast({ kind: "ctmc", model: supplier, start: "Up", time: 2 })
      .withSimulation({ kind: "semiMarkov", model: service, start: "Queue", horizon: 5, seed: 3 })
      .run();

    expect(result.inferredState).toBe("Backordered");
    expectDistribution(result.forecast as Record<string, number>);
    expect(result.simulatedPath!.length).toBeGreaterThan(0);

    const bn = new BayesianNetwork({
      variables: ["Fraud", "Alert"],
      domains: { Fraud: ["yes", "no"], Alert: ["yes", "no"] },
      parents: { Fraud: [], Alert: ["Fraud"] },
      cpt: {
        Fraud: { "[]": { yes: 0.1, no: 0.9 } },
        Alert: {
          "[\"yes\"]": { yes: 0.95, no: 0.05 },
          "[\"no\"]": { yes: 0.1, no: 0.9 },
        },
      },
    });
    const inferred = createWorkflow()
      .withInference({ kind: "bayesianNetwork", model: bn, variable: "Fraud", evidence: { Alert: "yes" } })
      .run();
    expect(inferred.inferredState).toBe("yes");
    expectDistribution(inferred.belief!);

    const ctmcStationary = createWorkflow()
      .withForecast({ kind: "ctmc", model: supplier, time: 2 })
      .run();
    expectDistribution(ctmcStationary.forecast as Record<string, number>);

    const markovForecast = createWorkflow()
      .withForecast({
        kind: "markov",
        model: MarkovChain.from({ A: { A: 0.5, B: 0.5 }, B: { A: 0.2, B: 0.8 } }),
        distribution: { A: 1, B: 0 },
        steps: 2,
      })
      .run();
    expectDistribution(markovForecast.forecast as Record<string, number>);
  });

  test("supports MDP simulation and input overrides", () => {
    const result = createWorkflow()
      .withSimulation({
        kind: "mdp",
        model: responseMDP,
        start: "Normal",
        steps: 2,
        policy: { Normal: "Allow", Compromised: "Review" },
        seed: 12,
      })
      .run({ start: "Normal", steps: 3, seed: 12 });

    expect(result.simulatedPath).toHaveLength(3);

    const ctmc = CTMC.fromGenerator({
      Up: { Up: -0.1, Down: 0.1 },
      Down: { Up: 0.5, Down: -0.5 },
    });
    const events = createWorkflow()
      .withSimulation({ kind: "ctmc", model: ctmc, start: "Up", horizon: 3, seed: 2 })
      .run();
    expect(events.simulatedPath!.at(0)).toEqual({ state: "Up", time: 0 });
  });

  test("rejects empty workflows, missing stage inputs, bad uncertainty options, and unknown CTMC states", () => {
    expect(() => createWorkflow().run()).toThrow(/at least one stage/i);
    expect(() => createWorkflow().withInference({ kind: "hmm", model: riskHMM }).run()).toThrow(/observations/i);
    expect(() => createWorkflow().withInference({
      kind: "pomdp",
      model: POMDP.from({
        states: ["A"],
        actions: ["sense"],
        observations: ["x"],
        transition: { A: { sense: { A: 1 } } },
        observation: { A: { sense: { x: 1 } } },
      }),
    }).run()).toThrow(/prior belief/i);
    expect(() => createWorkflow().withInference({
      kind: "bayesianNetwork",
      model: new BayesianNetwork({
        variables: ["A"],
        domains: { A: ["yes"] },
        parents: { A: [] },
        cpt: { A: { "[]": { yes: 1 } } },
      }),
    }).run()).toThrow(/query variable/i);
    expect(() => createWorkflow().withForecast({
      kind: "markov",
      model: MarkovChain.from({ A: { A: 1 } }),
    }).run()).toThrow(/starting distribution/i);
    expect(() => createWorkflow().withDecision({ model: responseMDP }).run()).toThrow(/current state/i);
    expect(() => createWorkflow().withForecast({
      kind: "ctmc",
      model: CTMC.fromGenerator({ Up: { Up: -1, Down: 1 }, Down: { Down: 0 } }),
      time: 1,
      start: "Missing",
    }).run()).toThrow(/unknown state/i);
    expect(() => createWorkflow().withUncertainty({
      parameter: "x",
      initial: 0,
      logTarget: () => 0,
      proposalStandardDeviation: 0,
    }).run()).toThrow(/positive/i);
  });
});

describe("domain workflow templates", () => {
  test("fraudDetection returns risk, response, loss, graph rank, alert belief, and uncertainty", () => {
    const result = workflows.fraudDetection({
      hiddenState: {
        states: ["Normal", "Compromised"],
        observations: ["login", "chargeback"],
        initial: { Normal: 0.92, Compromised: 0.08 },
        transition: {
          Normal: { Normal: 0.86, Compromised: 0.14 },
          Compromised: { Normal: 0.25, Compromised: 0.75 },
        },
        emission: {
          Normal: { login: 0.9, chargeback: 0.1 },
          Compromised: { login: 0.25, chargeback: 0.75 },
        },
      },
      response: {
        states: ["Normal", "Compromised"],
        actions: ["Allow", "Review"],
        discount: 0.8,
        transition: {
          Normal: {
            Allow: { Normal: 0.9, Compromised: 0.1 },
            Review: { Normal: 0.98, Compromised: 0.02 },
          },
          Compromised: {
            Allow: { Normal: 0.1, Compromised: 0.9 },
            Review: { Normal: 0.75, Compromised: 0.25 },
          },
        },
        reward: {
          Normal: { Allow: 3, Review: 1 },
          Compromised: { Allow: -8, Review: 2 },
        },
      },
      responseState: "Compromised",
      loss: {
        Investigate: { Investigate: 0.4, Recovered: 0.4, Fraud: 0.2 },
        Recovered: { Recovered: 1 },
        Fraud: { Fraud: 1 },
      },
      lossFrom: "Investigate",
      alertNetwork: {
        variables: ["Fraud", "Alert"],
        domains: { Fraud: ["yes", "no"], Alert: ["yes", "no"] },
        parents: { Fraud: [], Alert: ["Fraud"] },
        cpt: {
          Fraud: { "[]": { yes: 0.2, no: 0.8 } },
          Alert: {
            "[\"yes\"]": { yes: 0.9, no: 0.1 },
            "[\"no\"]": { yes: 0.15, no: 0.85 },
          },
        },
      },
      alertVariable: "Fraud",
      riskGraph: { user: ["card"], card: ["device"], device: ["user"], merchant: ["card"] },
      uncertainty: {
        parameter: "alertRate",
        initial: 0.2,
        logTarget: (x) => x > 0 && x < 1 ? -((x - 0.25) ** 2) / 0.01 : Number.NEGATIVE_INFINITY,
        iterations: 50,
        burnIn: 5,
        seed: 9,
      },
    }).assess({ observations: ["login", "chargeback"], evidence: { Alert: "yes" } });

    expect(result.inferredState).toBe("Compromised");
    expect(result.recommendedAction).toBe("Review");
    expect(result.details.alertBelief).toBeDefined();
    expect(result.details.rankedEntities).toBeDefined();
    expect(result.uncertainty!.alertRate!.samples.length).toBe(45);
  });

  test("customerLifecycle combines lifecycle forecast, retention action, journeys, onboarding, and uncertainty", () => {
    const result = workflows.customerLifecycle({
      lifecycle: {
        Trial: { Trial: 0.2, Active: 0.7, Churned: 0.1 },
        Active: { Active: 0.75, Expansion: 0.15, Churned: 0.1 },
        Expansion: { Expansion: 0.85, Active: 0.15 },
        Churned: { Churned: 1 },
      },
      lifecycleStart: { Trial: 1 },
      forecastSteps: 3,
      absorption: {
        Trial: { Trial: 0.2, Success: 0.7, Churn: 0.1 },
        Success: { Success: 1 },
        Churn: { Churn: 1 },
      },
      absorptionFrom: "Trial",
      journeySequences: [["view", "invite", "upgrade"], ["view", "invite", "invite"], ["view", "docs", "invite"]],
      journeyOrder: 1,
      journeyContext: ["invite"],
      retention: {
        states: ["Trial", "Active"],
        actions: ["Nudge", "Wait"],
        discount: 0.8,
        transition: {
          Trial: {
            Nudge: { Active: 0.8, Trial: 0.2 },
            Wait: { Active: 0.45, Trial: 0.55 },
          },
          Active: {
            Nudge: { Active: 0.85, Trial: 0.15 },
            Wait: { Active: 0.9, Trial: 0.1 },
          },
        },
        reward: {
          Trial: { Nudge: 3, Wait: 1 },
          Active: { Nudge: 2, Wait: 4 },
        },
      },
      retentionState: "Trial",
      onboarding: {
        transitions: { Setup: { Setup: 0.2, Activated: 0.8 }, Activated: { Activated: 1 } },
        holdingTimes: { Setup: deterministicHoldingTime(1), Activated: deterministicHoldingTime(1) },
        start: "Setup",
        horizon: 2,
        seed: 1,
      },
      uncertainty: {
        parameter: "conversion",
        initial: 0.4,
        logTarget: (x) => x > 0 && x < 1 ? -((x - 0.6) ** 2) / 0.02 : Number.NEGATIVE_INFINITY,
        iterations: 40,
        burnIn: 5,
        seed: 4,
      },
    }).analyze();

    expectDistribution(result.forecast as Record<string, number>);
    expect(result.recommendedAction).toBe("Nudge");
    expect(result.details.absorption).toBeDefined();
    expect(result.details.journeyPrediction).toBeDefined();
    expect(result.details.onboardingSimulation).toBeDefined();
    expect(result.uncertainty!.conversion!.samples.length).toBe(35);
  });

  test("inventoryControl combines belief update, reorder decision, supplier, demand, queue, and backlog outputs", () => {
    const result = workflows.inventoryControl({
      stockBelief: {
        states: ["Enough", "Short"],
        actions: ["Inspect"],
        observations: ["normal", "late"],
        transition: {
          Enough: { Inspect: { Enough: 0.75, Short: 0.25 } },
          Short: { Inspect: { Enough: 0.25, Short: 0.75 } },
        },
        observation: {
          Enough: { Inspect: { normal: 0.8, late: 0.2 } },
          Short: { Inspect: { normal: 0.15, late: 0.85 } },
        },
      },
      policy: {
        states: ["Enough", "Short"],
        actions: ["Order", "Hold"],
        discount: 0.85,
        transition: {
          Enough: {
            Order: { Enough: 0.9, Short: 0.1 },
            Hold: { Enough: 0.7, Short: 0.3 },
          },
          Short: {
            Order: { Enough: 0.85, Short: 0.15 },
            Hold: { Enough: 0.2, Short: 0.8 },
          },
        },
        reward: {
          Enough: { Order: 1, Hold: 3 },
          Short: { Order: 2, Hold: -4 },
        },
      },
      policyState: "Short",
      supplier: {
        Available: { Available: -0.05, Delayed: 0.05 },
        Delayed: { Available: 0.3, Delayed: -0.3 },
      },
      supplierState: "Available",
      supplierTime: 2,
      demand: { waitingTime: exponentialHoldingTime(1.5), horizon: 3, seed: 7 },
      queue: { arrivalRate: 2, serviceRate: 5 },
      backlog: {
        birthRate: () => 1,
        deathRate: () => 2,
        maxState: 3,
      },
    }).plan({
      belief: { Enough: 0.6, Short: 0.4 },
      action: "Inspect",
      observation: "late",
    });

    expect(result.inferredState).toBe("Short");
    expect(result.recommendedAction).toBe("Order");
    expect(result.details.supplierAvailability).toBeDefined();
    expect(result.details.demandCount).toBeGreaterThanOrEqual(0);
    expect(result.details.queuePressure).toBeDefined();
    expect(result.details.backlogDistribution).toBeDefined();
  });

  test("inventoryControl covers supplier stationary fallback, unseeded demand, and invalid supplier states", () => {
    const config = {
      stockBelief: {
        states: ["Enough", "Short"],
        actions: ["Inspect"],
        observations: ["normal"],
        transition: {
          Enough: { Inspect: { Enough: 1, Short: 0 } },
          Short: { Inspect: { Enough: 0, Short: 1 } },
        },
        observation: {
          Enough: { Inspect: { normal: 1 } },
          Short: { Inspect: { normal: 1 } },
        },
      },
      policy: {
        states: ["Enough", "Short"],
        actions: ["Order", "Hold"],
        discount: 0.8,
        transition: {
          Enough: {
            Order: { Enough: 1, Short: 0 },
            Hold: { Enough: 1, Short: 0 },
          },
          Short: {
            Order: { Enough: 1, Short: 0 },
            Hold: { Enough: 0, Short: 1 },
          },
        },
        reward: {
          Enough: { Order: 1, Hold: 2 },
          Short: { Order: 3, Hold: -2 },
        },
      },
      policyState: "Short",
      supplier: {
        Available: { Available: -0.1, Delayed: 0.1 },
        Delayed: { Available: 0.3, Delayed: -0.3 },
      },
      demand: { waitingTime: deterministicHoldingTime(1), horizon: 2 },
    };

    const result = workflows.inventoryControl(config).plan({
      belief: { Enough: 0.5, Short: 0.5 },
      action: "Inspect",
      observation: "normal",
    });

    expectDistribution(result.details.supplierAvailability as Record<string, number>);
    expect(result.details.demandCount).toBe(2);

    expect(() => workflows.inventoryControl({
      ...config,
      supplierState: "Missing",
    }).plan({
      belief: { Enough: 0.5, Short: 0.5 },
      action: "Inspect",
      observation: "normal",
    })).toThrow(/unknown state/i);
  });
});
