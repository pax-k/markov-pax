import { customerLifecycleWorkflow } from "./customer-lifecycle-workflow.ts";
import { emergencyDepartmentCapacityWorkflow } from "./emergency-department-capacity-workflow.ts";
import { fraudDetectionWorkflow } from "./fraud-detection-workflow.ts";
import { inventoryControlWorkflow } from "./inventory-control-workflow.ts";

export * from "./workflow.ts";
export * from "./customer-lifecycle-workflow.ts";
export * from "./emergency-department-capacity-workflow.ts";
export * from "./fraud-detection-workflow.ts";
export * from "./inventory-control-workflow.ts";

export const workflows = {
  fraudDetection: fraudDetectionWorkflow,
  customerLifecycle: customerLifecycleWorkflow,
  inventoryControl: inventoryControlWorkflow,
  emergencyDepartmentCapacity: emergencyDepartmentCapacityWorkflow,
};
