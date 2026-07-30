import { AgentRuntime } from "arcbench-agent-runtime-js";

export function sdkUsageExample(): void {
  // Load ARC-Bench paths from environment variables injected by the runner.
  const runtime = AgentRuntime.fromEnv();

  // Initialize the traceability store under `.arc/traceability/`.
  runtime.traceability.initDb();

  // Mark a requirement node as having completed the design phase.
  runtime.events.markDesignDone("REQ-1", "Design completed");

  // Register or update a requirement record with its scenario structure.
  runtime.traceability.upsertRequirement({
    req_id: "REQ-1",
    name: "Login",
    description: "User can log in",
    scenarios: [
      {
        id: "REQ-1-SCN-1",
        name: "Happy path",
        steps: [
          { keyword: "GIVEN", content: "user opens the login page" },
          { keyword: "WHEN", content: "user submits valid credentials" },
          { keyword: "THEN", content: "user enters the home page" },
        ],
      },
    ],
  });

  // Register an implementation interface and link it back to its requirement.
  runtime.traceability.upsertInterface({
    interface_id: "IF-LOGIN-API",
    req_ids: ["REQ-1"],
    type: "API",
    content: "POST /api/auth/login",
    file_path: "backend/src/routes/auth.ts",
    first_line: "18",
    implemented: false,
  });

  // Register a test record and link it to the requirement and interface.
  runtime.traceability.upsertTest({
    test_id: "TEST-LOGIN-E2E",
    req_id: "REQ-1",
    type: "E2E",
    file_path: "tests/login.spec.ts",
    first_line: "7",
    interface_ids: ["IF-LOGIN-API"],
  });

  // Mark the interface as implemented once the source code exists.
  runtime.traceability.setInterfaceImplemented("IF-LOGIN-API", true, "Login endpoint is implemented");

  // Mark the test as passing after the agent has run or reasoned about validation.
  runtime.traceability.setTestPassStatus("TEST-LOGIN-E2E", true);

  // Mark the requirement node state so ARC-Bench can visualize progress.
  runtime.traceability.upsertNodeState("REQ-1", "PASSED");

  // Ensure the generated project is a git repo with an initial baseline commit.
  runtime.git.ensureRepo({ createInitialCommit: true });

  // Commit meaningful changes so the platform can inspect implementation history.
  runtime.git.commit("REQ-1 (design): Login");
}

export function skillUsageExample(): void {
  /*
   * --- arcbench-checkpoint ---
   *
   * Use this skill for resumable task management in long or multi-step runs.
   * It helps record milestones, preserve restart state, and make progress visible.
   *
   * --- arcbench-runtime-signals ---
   *
   * Use this skill when your agent runs build, install, preview-server, or test
   * commands and wants to report structured runtime status.
   *
   * --- arcbench-traceability ---
   *
   * Use this skill to connect requirement-tree items to implementation evidence:
   * interfaces, files, tests, and pass/fail states.
   */
}
