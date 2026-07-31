export class AgentRuntime {
  static fromEnv(overrides?: Record<string, string>): AgentRuntime;
  paths: RuntimePaths;
  events: EventClient;
  traceability: TraceabilityStore;
  git: GitClient;
}
export class RuntimePaths {
  projectDir: string;
  runnerEventsPath: string;
  traceabilityDir: string;
}
export class EventClient {
  markDesignStarted(nodeId: string, message?: string | null): void;
  markDesignDone(nodeId: string, message?: string | null): void;
  markDesignFailed(nodeId: string, message?: string | null): void;
  markImplementationStarted(nodeId: string, message?: string | null): void;
  markImplementationDone(nodeId: string, message?: string | null): void;
  markImplementationFailed(nodeId: string, message?: string | null): void;
  markTestPassed(nodeId: string, message?: string | null): void;
  markTestFailed(nodeId: string, message?: string | null): void;
  notifyTraceabilityChanged(reason: string): void;
  notifyCommitHistoryChanged(reason: string, options?: { preview?: boolean }): void;
}
export class TraceabilityStore {
  initDb(options?: { reset?: boolean }): void;
  upsertRequirement(payload: Record<string, unknown>): void;
  upsertInterface(payload: Record<string, unknown>): void;
  setInterfaceImplemented(interfaceId: string, implemented: boolean, message?: string | null): void;
  upsertTest(payload: Record<string, unknown>): void;
  setTestPassStatus(testId: string, passed: boolean | null): void;
  upsertNodeState(reqId: string, state: string, phase?: string | null): void;
}
export class GitClient {
  ensureRepo(options?: { createInitialCommit?: boolean }): void;
  commit(message: string): void;
}
