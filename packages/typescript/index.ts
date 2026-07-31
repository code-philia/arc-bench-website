import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AgentRuntime } from "arcbench-agent-runtime-js";

type AgentArgs = {
  requirementPath: string;
  outputDir: string;
};

function parseArgs(argv: string[]): AgentArgs {
  const args: AgentArgs = {
    requirementPath: process.env.ARCBENCH_TASK_DIR || "requirements",
    outputDir: process.env.ARCBENCH_OUTPUT_DIR || ".",
  };
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--output-dir") {
      args.outputDir = argv[++index] || args.outputDir;
    } else {
      positional.push(value);
    }
  }
  if (positional[0]) {
    args.requirementPath = positional[0];
  }
  return args;
}

function copyTemplateContentsToOutput(templateDir: string, outputDir: string): void {
  if (!fs.existsSync(templateDir) || !fs.statSync(templateDir).isDirectory()) {
    throw new Error(`Starter template directory not found: ${templateDir}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  for (const entry of fs.readdirSync(templateDir, { withFileTypes: true })) {
    const source = path.join(templateDir, entry.name);
    const destination = path.join(outputDir, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(source, destination, { recursive: true, force: true });
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  }
}

async function runAgent(runtime: AgentRuntime, requirementsDir: string, outputDir: string): Promise<void> {
  /*
   * Fill your agent logic here.
   *
   * Recommended flow:
   * 1. Copy bundled template/ CONTENTS into outputDir so outputDir is the project root.
   * 2. Read requirementsDir/requirements.yaml.
   * 3. Modify files under outputDir.
   * 4. Use runtime.events / runtime.traceability / runtime.git as needed.
   *
   * Runner-injected model environment variables:
   * - OPENAI_API_KEY
   * - OPENAI_BASE_URL
   * - MODEL
   *
   * Reference examples:
   * - examples/model_calling.ts: OpenAI-compatible model usage.
   * - examples/sdk_and_skill_usage.ts: SDK event/traceability/git usage and skill guidance.
   *
   */
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  copyTemplateContentsToOutput(path.join(currentDir, "template"), outputDir);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const runtime = AgentRuntime.fromEnv();
  const requirementsDir = path.resolve(args.requirementPath);
  const outputDir = path.resolve(args.outputDir);
  await runAgent(runtime, requirementsDir, outputDir);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
