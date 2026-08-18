import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "markov-pax-package-"));
const archivePath = join(temporaryRoot, "markov-pax.tgz");

try {
  await run(["bun", "run", "build"], projectRoot);
  await run(["bun", "pm", "pack", "--filename", archivePath, "--ignore-scripts"], projectRoot);

  await Bun.write(join(temporaryRoot, "package.json"), JSON.stringify({
    name: "markov-pax-consumer",
    private: true,
    type: "module",
  }, null, 2));
  await Bun.write(join(temporaryRoot, "consumer.ts"), `
import { MarkovChain } from "markov-pax";

const chain = MarkovChain.from({
  active: { active: 0.8, churned: 0.2 },
  churned: { churned: 1 },
});
const forecast = chain.distributionAfter({ active: 1, churned: 0 }, 2);
if (Math.abs(forecast.churned - 0.36) > 1e-12) throw new Error("unexpected forecast");
console.log("package consumer passed");
`);

  await run(["bun", "add", archivePath], temporaryRoot);
  await run([
    join(projectRoot, "node_modules", ".bin", "tsc"),
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--module",
    "Preserve",
    "--moduleResolution",
    "bundler",
    "--target",
    "ESNext",
    "consumer.ts",
  ], temporaryRoot);
  await run(["bun", "consumer.ts"], temporaryRoot);

  const packedFiles = await listArchive(archivePath);
  const allowed = [
    "package/package.json",
    "package/README.md",
    "package/LICENSE",
    "package/CHANGELOG.md",
  ];
  const unexpected = packedFiles.filter((path) =>
    !path.startsWith("package/dist/") && !allowed.includes(path)
  );
  if (unexpected.length > 0) {
    throw new Error(`Package contains unexpected files: ${unexpected.join(", ")}`);
  }
  console.log(`package contents passed (${packedFiles.length} files)`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function run(command: string[], cwd: string) {
  const process = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" });
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed with exit code ${exitCode}`);
}

async function listArchive(path: string): Promise<string[]> {
  const process = Bun.spawn(["tar", "-tzf", path], { stdout: "pipe", stderr: "inherit" });
  const output = await new Response(process.stdout).text();
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error("Could not inspect the package archive");
  return output.split("\n").filter(Boolean);
}
