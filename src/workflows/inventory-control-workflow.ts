import { type Distribution, SeededRng, vectorToDistribution } from "../shared/core.ts";
import { CTMC, type GeneratorTransitions } from "../chains/ctmc.ts";
import { MDP, type MDPConfig, POMDP, type POMDPConfig } from "../models/mdp.ts";
import { BirthDeathProcess, type BirthDeathProcessConfig, MM1Queue, type MM1QueueConfig } from "../models/queue.ts";
import { RenewalProcess } from "../models/renewal.ts";
import { type HoldingTimeDistribution } from "../chains/semi-markov.ts";
import { createWorkflow, type WorkflowResult, type WorkflowRunInput } from "./workflow.ts";

export interface InventoryControlWorkflowConfig {
  stockBelief: POMDPConfig<string, string, string>;
  policy: MDPConfig<string, string>;
  policyState?: string;
  supplier?: GeneratorTransitions<string>;
  supplierState?: string;
  supplierTime?: number;
  demand?: { waitingTime: HoldingTimeDistribution; horizon: number; seed?: number };
  queue?: MM1QueueConfig;
  backlog?: BirthDeathProcessConfig & { maxState: number };
}

export function inventoryControlWorkflow(config: InventoryControlWorkflowConfig) {
  return {
    plan(input: WorkflowRunInput = {}): WorkflowResult {
      const workflow = createWorkflow({ name: "inventory control" })
        .withInference({
          kind: "pomdp",
          model: POMDP.from(config.stockBelief),
          belief: input.belief,
          action: input.action,
          observation: input.observation,
        })
        .withDecision({ model: MDP.from(config.policy), state: input.start ?? config.policyState });
      const result = workflow.run(input);

      if (config.supplier) {
        const ctmc = CTMC.fromGenerator(config.supplier);
        result.details.supplierAvailability = config.supplierState
          ? ctmcRowDistribution(ctmc, ctmc.transitionMatrix(input.time ?? config.supplierTime ?? 1), config.supplierState)
          : ctmc.stationary();
      }
      if (config.demand) {
        result.details.demandCount = new RenewalProcess(config.demand.waitingTime)
          .countBy(config.demand.horizon, { rng: seeded(config.demand.seed) });
      }
      if (config.queue) {
        const queue = new MM1Queue(config.queue);
        result.details.queuePressure = {
          expectedNumberInSystem: queue.expectedNumberInSystem(),
          expectedTimeInQueue: queue.expectedTimeInQueue(),
        };
      }
      if (config.backlog) {
        result.details.backlogDistribution = new BirthDeathProcess(config.backlog)
          .stationaryDistribution(config.backlog.maxState);
      }
      return result;
    },
  };
}

function ctmcRowDistribution(model: CTMC<string>, matrix: number[][], start: string): Distribution<string> {
  const index = model.states.indexOf(start);
  if (index < 0) {
    throw new Error(`Unknown state: ${String(start)}`);
  }
  return vectorToDistribution(model.states, matrix[index]!);
}

function seeded(seed: number | undefined) {
  return seed === undefined ? undefined : new SeededRng(seed);
}
