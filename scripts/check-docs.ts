import { existsSync } from "node:fs";

const root = new URL("../", import.meta.url);

const requiredDocuments = [
  "README.md",
  "DEFENSE_TECH.md",
  "IMPLEMENTATION_STATUS.md",
  "EXAMPLES_1.md",
  "EXAMPLES_2.md",
  "THEORY.md",
  "LICENSE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "BENCHMARKS.md",
] as const;

const evidencePaths = [
  "src/workflows/emergency-department-capacity-workflow.ts",
  "examples/real-world/emergency-department-capacity.test.ts",
  "tests/emergency-department-capacity-workflow.test.ts",
  "src/workflows/disaster-supply-chain-workflow.ts",
  "examples/real-world/disaster-food-medicine-supply-chain.test.ts",
  "tests/disaster-supply-chain-workflow.test.ts",
  "examples/real-world/maintenance-and-renewal.test.ts",
  "examples/real-world/operations-and-reliability.test.ts",
  "examples/modules/trace-chain.test.ts",
  "examples/modules/trace-logic.test.ts",
  "examples/modules/recursive-trace-system.test.ts",
  "examples/modules/markov-geometry.test.ts",
  "examples/modules/measure-logic.test.ts",
  "examples/modules/no-cloning.test.ts",
  "examples/defense-tech/asset-health-and-readiness.test.ts",
  "examples/defense-tech/contested-logistics-and-sustainment.test.ts",
  "examples/defense-tech/autonomy-assurance.test.ts",
  "examples/defense-tech/cyber-mission-assurance.test.ts",
  "examples/defense-tech/multi-sensor-state-estimation.test.ts",
  "examples/defense-tech/electromagnetic-spectrum-resilience.test.ts",
  "examples/defense-tech/multi-agent-team-resilience.test.ts",
  "examples/defense-tech/base-infrastructure-resilience.test.ts",
  "examples/defense-tech/training-and-force-readiness.test.ts",
  "examples/defense-tech/decision-support-policy-evaluation.test.ts",
] as const;

const errors: string[] = [];

for (const path of [...requiredDocuments, ...evidencePaths]) {
  if (!(await Bun.file(new URL(path, root)).exists())) {
    errors.push(`Missing documented path: ${path}`);
  }
}

for (const path of ["README.md", "examples/README.md", "DEFENSE_TECH.md", "IMPLEMENTATION_STATUS.md", "EXAMPLES_1.md", "EXAMPLES_2.md", "THEORY.md"] as const) {
  const documentUrl = new URL(path, root);
  const content = await Bun.file(documentUrl).text();
  if (content.includes("\uFFFC")) {
    errors.push(`${path} contains a lost object-replacement marker`);
  }

  for (const match of content.matchAll(/\]\(((?:\.\.?\/)[^\s)#]+)(?:#[^)]*)?\)/g)) {
    const target = match[1]!;
    if (!existsSync(new URL(target, documentUrl))) {
      errors.push(`${path} links to a missing local file: ${target}`);
    }
  }
}

const readme = await Bun.file(new URL("README.md", root)).text();
const defenseCatalogUrl = "https://github.com/pax-k/markov-pax/blob/main/DEFENSE_TECH.md";
if (!readme.includes(defenseCatalogUrl)) {
  errors.push("README.md must use the absolute GitHub link for DEFENSE_TECH.md");
}

const defenseCatalog = await Bun.file(new URL("DEFENSE_TECH.md", root)).text();
for (const marker of [
  "project hypothesis",
  "synthetic",
  "not operational validation",
  "targeting",
  "weapon assignment",
  "autonomous lethal decisions",
  "classified",
]) {
  if (!defenseCatalog.includes(marker)) {
    errors.push(`DEFENSE_TECH.md must contain the boundary marker: ${marker}`);
  }
}
for (const path of evidencePaths.filter((path) => path.startsWith("examples/defense-tech/"))) {
  if (!defenseCatalog.includes(`./${path}`)) {
    errors.push(`DEFENSE_TECH.md must link the evidence path: ${path}`);
  }
}

const examplesOne = await Bun.file(new URL("EXAMPLES_1.md", root)).text();
const researchRows = examplesOne.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| ---"));
if (researchRows.length !== 13) {
  errors.push(`EXAMPLES_1.md must contain one header and 12 application rows; found ${researchRows.length}`);
}
if (!examplesOne.includes("could not be verified from a primary source")) {
  errors.push("EXAMPLES_1.md must state the removed unsupported research claim");
}

const theory = await Bun.file(new URL("THEORY.md", root)).text();
for (const staleCall of [
  "model.analyze();",
  "model.predict();",
  "model.fit(data);",
  "chain.expectedReturnTime(\"A\");",
  "model.kernel;",
]) {
  if (theory.includes(staleCall)) {
    errors.push(`THEORY.md contains a stale implemented-API example: ${staleCall}`);
  }
}

if (errors.length > 0) {
  throw new Error(`Documentation check failed:\n- ${errors.join("\n- ")}`);
}

console.log(`documentation check passed (${requiredDocuments.length} documents, ${evidencePaths.length} evidence paths)`);
