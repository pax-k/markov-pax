import { AbsorbingChain } from "../chains/absorbing-chain.ts";
import { type Distribution, SeededRng, type WeightedTransitions } from "../shared/core.ts";
import { HigherOrderMarkovModel } from "../chains/higher-order.ts";
import { MarkovChain } from "../chains/markov-chain.ts";
import { MDP, type MDPConfig } from "../models/mdp.ts";
import { type HoldingTimeDistribution, SemiMarkovProcess } from "../chains/semi-markov.ts";
import {
  createWorkflow,
  type WorkflowResult,
  type WorkflowRunInput,
  type WorkflowUncertaintyStage,
} from "./workflow.ts";

export interface CustomerLifecycleWorkflowConfig {
  lifecycle: WeightedTransitions<string>;
  lifecycleStart: Partial<Distribution<string>>;
  forecastSteps: number;
  absorption?: WeightedTransitions<string>;
  absorptionFrom?: string;
  journeySequences?: readonly (readonly string[])[];
  journeyOrder?: number;
  journeyContext?: readonly string[];
  retention?: MDPConfig<string, string>;
  retentionState?: string;
  onboarding?: {
    transitions: WeightedTransitions<string>;
    holdingTimes: Record<string, HoldingTimeDistribution>;
    start: string;
    horizon: number;
    seed?: number;
  };
  uncertainty?: WorkflowUncertaintyStage;
}

export function customerLifecycleWorkflow(config: CustomerLifecycleWorkflowConfig) {
  return {
    analyze(input: WorkflowRunInput = {}): WorkflowResult {
      const workflow = createWorkflow({ name: "customer lifecycle" })
        .withForecast({
          kind: "markov",
          model: MarkovChain.from(config.lifecycle),
          distribution: input.distribution ?? config.lifecycleStart,
          steps: input.steps ?? config.forecastSteps,
        });
      if (config.retention) {
        workflow.withDecision({
          model: MDP.from(config.retention),
          state: input.start ?? config.retentionState,
        });
      }
      if (config.uncertainty) workflow.withUncertainty(config.uncertainty);
      const result = workflow.run(input);

      if (config.absorption) {
        const absorbing = AbsorbingChain.from(config.absorption);
        const absorption = absorbing.absorptionProbabilities();
        const from = input.from ?? config.absorptionFrom;
        result.details.absorption = from ? absorption[from] : absorption;
      }
      if (config.journeySequences && config.journeyContext && config.journeyOrder) {
        const journey = HigherOrderMarkovModel.fit(config.journeySequences, { order: config.journeyOrder, smoothing: 1 });
        result.details.journeyPrediction = journey.predictNext(config.journeyContext);
      }
      if (config.onboarding) {
        const process = SemiMarkovProcess.from(config.onboarding.transitions, config.onboarding.holdingTimes);
        result.details.onboardingSimulation = process.simulateUntil(
          config.onboarding.horizon,
          config.onboarding.start,
          { rng: seeded(config.onboarding.seed) },
        );
      }
      return result;
    },
  };
}

function seeded(seed: number | undefined) {
  return seed === undefined ? undefined : new SeededRng(seed);
}
