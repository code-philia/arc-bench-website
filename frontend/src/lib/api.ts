import type {
  AuthResponse,
  BenchmarkDetail,
  BenchmarkSummary,
  CompetitionLeaderboardEntry,
  CompetitionDetail,
  CompetitionSummary,
  RequirementDetail,
  SubmissionEditableTaskPayload,
  SubmissionTaskAssets,
  SubmissionSourcePayload,
  RequirementSummary,
  SubmissionDetail,
  SubmissionCommitHistoryPayload,
  SubmissionLogs,
  SubmissionManualEditCommitPreview,
  SubmissionPreviewStatus,
  SubmissionSseEvent,
  SubmissionSummary,
  SubmissionTraceabilityPayload,
  UserTaskDraft,
  UserTaskDetail,
  UserTaskSummary,
  WorkspaceFileListPayload,
  FileUpdatePayload,
  TestCreatePayload,
} from "./types";

const API_BASE = "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiErrorPayload = {
  detail?: string | Array<{ msg?: string; loc?: Array<string | number> }>;
};

function formatErrorMessage(payload: ApiErrorPayload, fallback: string): string {
  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (Array.isArray(payload.detail) && payload.detail.length > 0) {
    return payload.detail
      .map((item) => {
        const path = Array.isArray(item.loc) ? item.loc.slice(1).join(".") : "";
        if (path && item.msg) {
          return `${path}: ${item.msg}`;
        }
        return item.msg;
      })
      .filter((message): message is string => Boolean(message && message.trim()))
      .join("; ");
  }

  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ detail: response.statusText }))) as ApiErrorPayload;
    throw new ApiError(formatErrorMessage(payload, response.statusText || "Request failed"), response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

function encodePathSegments(path: string) {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export const api = {
  getCurrentUser() {
    return request<AuthResponse>("/auth/me");
  },
  updateProfile(payload: { github_email?: string | null; github_username?: string | null }) {
    return request<AuthResponse>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  register(payload: { email: string; username: string; password: string }) {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload: { email: string; password: string }) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logout() {
    return request<{ detail: string }>("/auth/logout", {
      method: "POST",
    });
  },
  listCompetitions() {
    return request<CompetitionSummary[]>("/competitions");
  },
  getCompetitionLeaderboard(track: "all" | "web" | "mobile" | "kernel" = "all") {
    return request<CompetitionLeaderboardEntry[]>(`/competitions/leaderboard?track=${track}`);
  },
  getCompetition(competitionId: string) {
    return request<CompetitionDetail>(`/competitions/${competitionId}`);
  },
  listBenchmarks() {
    return request<BenchmarkSummary[]>("/benchmarks");
  },
  getBenchmark(benchmarkId: string) {
    return request<BenchmarkDetail>(`/benchmarks/${benchmarkId}`);
  },
  async getDemoAgentFile() {
    const response = await fetch(`${API_BASE}/competitions/public/demo-agent`, {
      credentials: "include",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ detail: response.statusText }))) as ApiErrorPayload;
      throw new ApiError(formatErrorMessage(payload, response.statusText || "Request failed"), response.status);
    }
    const blob = await response.blob();
    const filename = response.headers.get("Content-Disposition")
      ?.match(/filename=\"?([^"]+)\"?/)
      ?.[1] ?? "demo_agent.zip";
    return new File([blob], filename, { type: "application/zip" });
  },
  listRequirements(catalog: "playground" | "competition" | "benchmark" = "playground") {
    return request<RequirementSummary[]>(`/requirements?catalog=${catalog}`);
  },
  getRequirement(requirementId: string, catalog: "playground" | "competition" | "benchmark" = "playground") {
    return request<RequirementDetail>(`/requirements/${requirementId}?catalog=${catalog}`);
  },
  listSubmissions(requirementId?: string) {
    const query = requirementId ? `?requirement_id=${encodeURIComponent(requirementId)}` : "";
    return request<SubmissionSummary[]>(`/submissions${query}`);
  },
  getSubmission(submissionId: string) {
    return request<SubmissionDetail>(`/submissions/${submissionId}`);
  },
  pauseSubmission(submissionId: string) {
    return request<SubmissionDetail>(`/submissions/${submissionId}/pause`, {
      method: "POST",
    });
  },
  resumeSubmission(submissionId: string) {
    return request<SubmissionDetail>(`/submissions/${submissionId}/resume`, {
      method: "POST",
    });
  },
  getManualEditCommitPreview(submissionId: string) {
    return request<SubmissionManualEditCommitPreview>(`/submissions/${submissionId}/manual-edit/commit-preview`, {
      method: "POST",
    });
  },
  rewindSubmission(submissionId: string, payload: { commit_oid: string }) {
    return request<SubmissionDetail>(`/submissions/${submissionId}/rewind`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getSubmissionEditableTask(submissionId: string) {
    return request<SubmissionEditableTaskPayload>(`/submissions/${submissionId}/editable-task`);
  },
  updateSubmissionEditableTask(submissionId: string, payload: SubmissionEditableTaskPayload) {
    return request<{ detail: string }>(`/submissions/${submissionId}/editable-task`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getSubmissionTaskAssets(submissionId: string): SubmissionTaskAssets {
    return {
      assets_base_url: `${API_BASE}/submissions/${submissionId}/requirements-assets/assets/`,
      references_base_url: `${API_BASE}/submissions/${submissionId}/requirements-assets/references/`,
    };
  },
  getSubmissionLogs(submissionId: string) {
    return request<SubmissionLogs>(`/submissions/${submissionId}/logs`);
  },
  getSubmissionTraceability(submissionId: string, nodeId: string) {
    return request<SubmissionTraceabilityPayload>(
      `/submissions/${submissionId}/traceability?node_id=${encodeURIComponent(nodeId)}`,
    );
  },
  getSubmissionAllTraceability(submissionId: string) {
    return request<SubmissionTraceabilityPayload>(
      `/submissions/${submissionId}/traceability?node_id=__all__`,
    );
  },
  getSubmissionCommitHistory(submissionId: string) {
    return request<SubmissionCommitHistoryPayload>(`/submissions/${submissionId}/commit-history`);
  },
  getSubmissionSource(
    submissionId: string,
    payload: { filePath: string; firstLine?: string | number | null; kind?: "file" | "diff"; commitOid?: string | null },
  ) {
    const params = new URLSearchParams({
      file_path: payload.filePath,
      kind: payload.kind ?? "file",
    });
    if (payload.firstLine !== undefined && payload.firstLine !== null) {
      const normalizedFirstLine = String(payload.firstLine).trim();
      if (normalizedFirstLine) {
        params.set("first_line", normalizedFirstLine);
      }
    }
    if (payload.commitOid && payload.commitOid.trim()) {
      params.set("commit_oid", payload.commitOid.trim());
    }
    return request<SubmissionSourcePayload>(`/submissions/${submissionId}/source?${params.toString()}`);
  },
  getSubmissionPreviewStatus(submissionId: string) {
    return request<SubmissionPreviewStatus>(`/submissions/${submissionId}/preview/status`);
  },
  connectSubmissionEvents(
    submissionId: string,
    handlers: {
      onEvent: (event: SubmissionSseEvent) => void;
      onError?: () => void;
    },
    options?: { sinceVersion?: number },
  ) {
    const params = new URLSearchParams();
    if (options?.sinceVersion && options.sinceVersion > 0) {
      params.set("since_version", String(options.sinceVersion));
    }
    const query = params.toString();
    const source = new EventSource(
      `${API_BASE}/submissions/${submissionId}/events${query ? `?${query}` : ""}`,
      { withCredentials: true },
    );
    source.addEventListener("submission-update", (rawEvent) => {
      try {
        const payload = JSON.parse((rawEvent as MessageEvent<string>).data) as SubmissionSseEvent;
        handlers.onEvent(payload);
      } catch {
        // Ignore malformed SSE payloads.
      }
    });
    source.onerror = () => {
      handlers.onError?.();
    };
    return source;
  },
  refreshSubmissionPreview(submissionId: string) {
    return request<SubmissionPreviewStatus>(`/submissions/${submissionId}/preview/refresh`, {
      method: "POST",
    });
  },
  async createSubmission(payload: {
    requirementId: string;
    runtime: string;
    file?: File | null;
    agentSource?: "upload" | "builtin_arc_agent" | "builtin_octos_agent";
    taskType?: "web" | "mobile" | "kernel" | "mixed" | "cli";
    displayName?: string;
    modelName?: string;
    catalog?: "playground" | "competition" | "benchmark" | "my_tasks";
  }) {
    const form = new FormData();
    form.append("requirement_id", payload.requirementId);
    form.append("runtime", payload.runtime);
    form.append("catalog", payload.catalog ?? "playground");
    form.append("agent_source", payload.agentSource ?? "upload");
    if (payload.taskType) {
      form.append("task_type", payload.taskType);
    }
    if (payload.displayName && payload.displayName.trim()) {
      form.append("display_name", payload.displayName.trim());
    }
    if (payload.modelName && payload.modelName.trim()) {
      form.append("model_name", payload.modelName.trim());
    }
    if (payload.file) {
      form.append("file", payload.file);
    }
    return request<{ submission: SubmissionSummary }>("/submissions", {
      method: "POST",
      body: form,
    });
  },
  startSubmission(submissionId: string) {
    return request<SubmissionDetail>(`/submissions/${submissionId}/start`, {
      method: "POST",
    });
  },
  getSubmissionPreviewUrl(submissionId: string) {
    return "http://1.95.169.80:3001/";
  },

  getWorkspaceFiles(submissionId: string) {
    return request<WorkspaceFileListPayload>(`/submissions/${submissionId}/workspace/files`);
  },

  async downloadSubmissionTemplateBundle(submissionId: string) {
    const response = await fetch(`${API_BASE}/submissions/${submissionId}/workspace/template-bundle`, {
      credentials: "include",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ detail: response.statusText }))) as ApiErrorPayload;
      throw new ApiError(formatErrorMessage(payload, response.statusText || "Request failed"), response.status);
    }
    const blob = await response.blob();
    const filename = response.headers.get("Content-Disposition")
      ?.match(/filename=\"?([^"]+)\"?/)
      ?.[1] ?? `${submissionId}-template.zip`;
    return new File([blob], filename, { type: "application/zip" });
  },

  updateWorkspaceFile(submissionId: string, payload: FileUpdatePayload) {
    return request<{ detail: string }>(`/submissions/${submissionId}/workspace/files`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  createTest(submissionId: string, payload: TestCreatePayload) {
    return request<{ detail: string; file_path: string }>(`/submissions/${submissionId}/workspace/tests`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listMyTasks() {
    return request<UserTaskSummary[]>("/my-tasks");
  },
  getMyTask(taskId: string) {
    return request<UserTaskDetail>(`/my-tasks/${taskId}`);
  },
  createMyTask(payload: {
    title: string;
    task_type: "web" | "mobile" | "kernel" | "mixed" | "cli";
    summary: string;
    root_requirement_id: string;
    node_count: number;
    atomic_count: number;
    yaml_content: string;
    markdown_content: string;
    draft_id?: string | null;
  }) {
    return request<UserTaskDetail>("/my-tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateMyTask(taskId: string, payload: {
    title: string;
    task_type: "web" | "mobile" | "kernel" | "mixed" | "cli";
    summary: string;
    root_requirement_id: string;
    node_count: number;
    atomic_count: number;
    yaml_content: string;
    markdown_content: string;
  }) {
    return request<UserTaskDetail>(`/my-tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  createMyTaskDraft() {
    return request<UserTaskDraft>("/my-tasks/drafts", {
      method: "POST",
    });
  },
  saveMyTaskDraft(draftId: string, payload: {
    title: string;
    task_type: "web" | "mobile" | "kernel" | "mixed" | "cli";
    yaml_content: string;
    markdown_content: string;
  }) {
    return request<UserTaskDraft>(`/my-tasks/drafts/${draftId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async downloadMyTaskDraftBundle(draftId: string) {
    const response = await fetch(`${API_BASE}/my-tasks/drafts/${draftId}/bundle`, {
      credentials: "include",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ detail: response.statusText }))) as ApiErrorPayload;
      throw new ApiError(formatErrorMessage(payload, response.statusText || "Request failed"), response.status);
    }
    const blob = await response.blob();
    const filename = response.headers.get("Content-Disposition")
      ?.match(/filename=\"?([^"]+)\"?/)
      ?.[1] ?? "requirement.zip";
    return new File([blob], filename, { type: "application/zip" });
  },
  async uploadMyTaskDraftReference(draftId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<{ filename: string; relative_path: string; url: string }>(`/my-tasks/drafts/${draftId}/reference`, {
      method: "POST",
      body: form,
    });
  },
  deleteMyTaskDraftReference(draftId: string, assetPath: string) {
    return request<void>(`/my-tasks/drafts/${draftId}/reference/${encodePathSegments(assetPath)}`, {
      method: "DELETE",
    });
  },
  async uploadMyTaskReference(taskId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<{ filename: string; relative_path: string; url: string }>(`/my-tasks/${taskId}/reference`, {
      method: "POST",
      body: form,
    });
  },
  deleteMyTaskReference(taskId: string, assetPath: string) {
    return request<void>(`/my-tasks/${taskId}/reference/${encodePathSegments(assetPath)}`, {
      method: "DELETE",
    });
  },
  async downloadMyTaskBundle(taskId: string) {
    const response = await fetch(`${API_BASE}/my-tasks/${taskId}/bundle`, {
      credentials: "include",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ detail: response.statusText }))) as ApiErrorPayload;
      throw new ApiError(formatErrorMessage(payload, response.statusText || "Request failed"), response.status);
    }
    const blob = await response.blob();
    const filename = response.headers.get("Content-Disposition")
      ?.match(/filename=\"?([^"]+)\"?/)
      ?.[1] ?? `${taskId}.zip`;
    return new File([blob], filename, { type: "application/zip" });
  },
};
