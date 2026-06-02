import { AbsorbingChain } from "../chains/absorbing-chain.ts";
import { type WeightedTransitions } from "../shared/core.ts";
import { BayesianNetwork, type BayesianNetworkConfig } from "../models/graphical-models.ts";
import { type GraphAdjacency, pagerank } from "../models/graph.ts";
import { HiddenMarkovModel, type HMMConfig } from "../models/hmm.ts";
import { MDP, type MDPConfig } from "../models/mdp.ts";
import {
  createWorkflow,
  type WorkflowResult,
  type WorkflowRunInput,
  type WorkflowUncertaintyStage,
} from "./workflow.ts";

export interface FraudDetectionWorkflowConfig {
  hiddenState: HMMConfig<string, string>;
  response: MDPConfig<string, string>;
  responseState?: string;
  loss?: WeightedTransitions<string>;
  lossFrom?: string;
  alertNetwork?: BayesianNetworkConfig<string>;
  alertVariable?: string;
  riskGraph?: GraphAdjacency<string>;
  uncertainty?: WorkflowUncertaintyStage;
}

export function fraudDetectionWorkflow(config: FraudDetectionWorkflowConfig) {
  return {
    assess(input: WorkflowRunInput = {}): WorkflowResult {
      const workflow = createWorkflow({ name: "fraud detection" })
        .withInference({ kind: "hmm", model: HiddenMarkovModel.from(config.hiddenState), observations: input.observations })
        .withDecision({ model: MDP.from(config.response), state: input.start ?? config.responseState });
      if (config.loss) {
        workflow.withForecast({
          kind: "absorbing",
          model: AbsorbingChain.from(config.loss),
          from: input.from ?? config.lossFrom,
        });
      }
      if (config.uncertainty) workflow.withUncertainty(config.uncertainty);

      const result = workflow.run(input);
      if (config.alertNetwork) {
        const variable = requireValue(input.variable ?? config.alertVariable, "Fraud alert network requires a query variable");
        result.details.alertBelief = new BayesianNetwork(config.alertNetwork).query(variable, input.evidence ?? {});
      }
      if (config.riskGraph) {
        result.details.rankedEntities = pagerank(config.riskGraph);
      }
      return result;
    },
  };
}

function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}
