import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TABLE_NAMES = ["requirements", "scenarios", "interfaces", "tests", "call_edges", "node_states", "node_contracts"];

function utcTimestamp() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function appendJsonl(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return { ...fallback };
  }
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function optionalString(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export class RuntimePaths {
  constructor({ projectDir, runnerEventsPath, traceabilityDir }) {
    this.projectDir = path.resolve(projectDir);
    this.runnerEventsPath = path.isAbsolute(runnerEventsPath) ? runnerEventsPath : path.join(this.projectDir, runnerEventsPath);
    this.traceabilityDir = path.isAbsolute(traceabilityDir) ? traceabilityDir : path.join(this.projectDir, traceabilityDir);
  }

  static fromEnv(overrides = {}) {
    const projectDir = overrides.projectDir || process.env.ARCBENCH_OUTPUT_DIR || process.env.ARCBENCH_PROJECT_DIR || process.env.ARCBENCH_TEMPLATE_DIR || ".";
    return new RuntimePaths({
      projectDir,
      runnerEventsPath: overrides.runnerEventsPath || process.env.ARCBENCH_RUNNER_EVENTS_PATH || ".arc/runner-events.jsonl",
      traceabilityDir: overrides.traceabilityDir || process.env.ARCBENCH_TRACEABILITY_DIR || ".arc/traceability",
    });
  }

  ensureParentDirs() {
    ensureDir(this.projectDir);
    ensureDir(path.dirname(this.runnerEventsPath));
    ensureDir(this.traceabilityDir);
  }
}

export class EventClient {
  constructor(paths) {
    this.paths = paths;
    this.requirementStateWriter = null;
  }

  setRequirementStateWriter(writer) {
    this.requirementStateWriter = writer;
  }

  emitRequirementState(nodeId, phase, status, message = null) {
    const normalizedNodeId = String(nodeId || "").trim();
    if (!normalizedNodeId) return;
    appendJsonl(this.paths.runnerEventsPath, {
      type: "requirement_state",
      node_id: normalizedNodeId,
      phase: String(phase || "").trim(),
      status: String(status || "").trim(),
      timestamp: utcTimestamp(),
      message,
    });
    const state = {
      "design:running": "DESIGNING",
      "design:completed": "DESIGNED",
      "design:failed": "FAILED",
      "implement:running": "IMPLEMENTING",
      "implement:completed": "IMPLEMENTED",
      "implement:failed": "FAILED",
      "test:passed": "PASSED",
      "test:failed": "FAILED",
    }[`${phase}:${status}`];
    if (state && this.requirementStateWriter) {
      this.requirementStateWriter(normalizedNodeId, state, phase);
    }
  }

  markDesignStarted(nodeId, message = null) { this.emitRequirementState(nodeId, "design", "running", message); }
  markDesignDone(nodeId, message = null) { this.emitRequirementState(nodeId, "design", "completed", message); }
  markDesignFailed(nodeId, message = null) { this.emitRequirementState(nodeId, "design", "failed", message); }
  markImplementationStarted(nodeId, message = null) { this.emitRequirementState(nodeId, "implement", "running", message); }
  markImplementationDone(nodeId, message = null) { this.emitRequirementState(nodeId, "implement", "completed", message); }
  markImplementationFailed(nodeId, message = null) { this.emitRequirementState(nodeId, "implement", "failed", message); }
  markTestPassed(nodeId, message = null) { this.emitRequirementState(nodeId, "test", "passed", message); }
  markTestFailed(nodeId, message = null) { this.emitRequirementState(nodeId, "test", "failed", message); }

  notifyTraceabilityChanged(reason) {
    appendJsonl(this.paths.runnerEventsPath, {
      type: "signal",
      reason,
      timestamp: utcTimestamp(),
      refresh: { submission: true, logs: false, commit_history: false, traceability_selected: true, traceability_all: true, preview: false },
    });
  }

  notifyCommitHistoryChanged(reason, { preview = false } = {}) {
    appendJsonl(this.paths.runnerEventsPath, {
      type: "signal",
      reason,
      timestamp: utcTimestamp(),
      refresh: { submission: false, logs: false, commit_history: true, traceability_selected: false, traceability_all: false, preview },
    });
  }
}

export class TraceabilityStore {
  constructor(paths, events) {
    this.paths = paths;
    this.events = events;
  }

  tablePath(tableName) {
    if (!TABLE_NAMES.includes(tableName)) throw new Error(`Unknown traceability table: ${tableName}`);
    return path.join(this.paths.traceabilityDir, `${tableName}.json`);
  }

  readTable(tableName) {
    const payload = readJson(this.tablePath(tableName), {});
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  }

  writeTable(tableName, rows) {
    writeJson(this.tablePath(tableName), Object.fromEntries(Object.entries(rows).sort()));
  }

  initDb({ reset = false } = {}) {
    ensureDir(this.paths.traceabilityDir);
    for (const tableName of TABLE_NAMES) {
      const filePath = this.tablePath(tableName);
      if (reset || !fs.existsSync(filePath)) writeJson(filePath, {});
    }
    this.events.notifyTraceabilityChanged("traceability_store_initialized");
  }

  upsertRequirement(payload) {
    const reqId = String(payload.req_id || "").trim();
    if (!reqId) throw new Error("req_id is required");
    const rows = this.readTable("requirements");
    rows[reqId] = { ...payload, req_id: reqId, scenarios: asList(payload.scenarios) };
    this.writeTable("requirements", rows);
    this.events.notifyTraceabilityChanged("requirements_updated");
  }

  upsertInterface(payload) {
    const interfaceId = String(payload.interface_id || "").trim();
    if (!interfaceId) throw new Error("interface_id is required");
    const rows = this.readTable("interfaces");
    rows[interfaceId] = { ...payload, interface_id: interfaceId, req_ids: asList(payload.req_ids), implemented: Boolean(payload.implemented) };
    this.writeTable("interfaces", rows);
    appendJsonl(this.paths.runnerEventsPath, { type: "interface_upsert", ...rows[interfaceId], timestamp: utcTimestamp() });
  }

  setInterfaceImplemented(interfaceId, implemented, message = null) {
    const rows = this.readTable("interfaces");
    if (!rows[interfaceId]) throw new Error(`Interface not found: ${interfaceId}`);
    rows[interfaceId].implemented = Boolean(implemented);
    this.writeTable("interfaces", rows);
    appendJsonl(this.paths.runnerEventsPath, { type: "interface_status", interface_id: interfaceId, implemented: Boolean(implemented), message, timestamp: utcTimestamp() });
  }

  upsertTest(payload) {
    const testId = String(payload.test_id || "").trim();
    const reqId = String(payload.req_id || "").trim();
    if (!testId || !reqId) throw new Error("test_id and req_id are required");
    const rows = this.readTable("tests");
    rows[testId] = { ...payload, test_id: testId, req_id: reqId, interface_ids: asList(payload.interface_ids), scenario_id: optionalString(payload.scenario_id) };
    this.writeTable("tests", rows);
    appendJsonl(this.paths.runnerEventsPath, { type: "test_upsert", ...rows[testId], timestamp: utcTimestamp() });
  }

  setTestPassStatus(testId, passed) {
    const rows = this.readTable("tests");
    if (!rows[testId]) throw new Error(`Test not found: ${testId}`);
    rows[testId].passed = passed == null ? null : Boolean(passed);
    this.writeTable("tests", rows);
    this.events.notifyTraceabilityChanged("test_status_updated");
  }

  upsertNodeState(reqId, state, phase = null) {
    const rows = this.readTable("node_states");
    rows[reqId] = { req_id: reqId, state, phase, updated_at: utcTimestamp() };
    this.writeTable("node_states", rows);
    this.events.notifyTraceabilityChanged("node_state_updated");
  }
}

export class GitClient {
  constructor(paths, events) {
    this.paths = paths;
    this.events = events;
  }

  run(args, { check = true } = {}) {
    try {
      return execFileSync("git", args, { cwd: this.paths.projectDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      if (check) throw error;
      return `${error.stdout || ""}${error.stderr || ""}`;
    }
  }

  ensureRepo({ createInitialCommit = true } = {}) {
    if (!fs.existsSync(path.join(this.paths.projectDir, ".git"))) this.run(["init"]);
    this.run(["config", "user.name", process.env.ARC_GIT_USER_NAME || "ARC Bench Agent"]);
    this.run(["config", "user.email", process.env.ARC_GIT_USER_EMAIL || "arcbench@example.com"]);
    if (createInitialCommit) {
      this.run(["add", "."], { check: false });
      this.run(["commit", "-m", "init"], { check: false });
    }
    this.events.notifyCommitHistoryChanged("git_initialized", { preview: true });
  }

  commit(message) {
    this.run(["add", "."], { check: false });
    this.run(["commit", "-m", message], { check: false });
    this.events.notifyCommitHistoryChanged("git_commit", { preview: true });
  }
}

export class AgentRuntime {
  constructor(paths, events, traceability, git) {
    this.paths = paths;
    this.events = events;
    this.traceability = traceability;
    this.git = git;
  }

  static fromEnv(overrides = {}) {
    const paths = RuntimePaths.fromEnv(overrides);
    paths.ensureParentDirs();
    const events = new EventClient(paths);
    const traceability = new TraceabilityStore(paths, events);
    events.setRequirementStateWriter((reqId, state, phase) => traceability.upsertNodeState(reqId, state, phase));
    const git = new GitClient(paths, events);
    return new AgentRuntime(paths, events, traceability, git);
  }
}
