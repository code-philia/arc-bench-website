import type {
  AuthResponse,
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
  SubmissionPreviewStatus,
  SubmissionSseEvent,
  SubmissionSummary,
  SubmissionTraceabilityPayload,
  UserTaskDraft,
  UserTaskDetail,
  UserTaskSummary,
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
  getCompetition(competitionId: string) {
    return request<CompetitionDetail>(`/competitions/${competitionId}`);
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
  async getStarterAgentFile() {
    const response = await fetch(`${API_BASE}/requirements/starter-agent`, {
      credentials: "include",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ detail: response.statusText }))) as ApiErrorPayload;
      throw new ApiError(formatErrorMessage(payload, response.statusText || "Request failed"), response.status);
    }
    const blob = await response.blob();
    const filename = response.headers.get("Content-Disposition")
      ?.match(/filename=\"?([^"]+)\"?/)
      ?.[1] ?? "arcbench-agent-starter.zip";
    return new File([blob], filename, { type: "application/zip" });
  },
  listRequirements(catalog: "playground" | "competition" = "playground") {
    return request<RequirementSummary[]>(`/requirements?catalog=${catalog}`);
  },
  getRequirement(requirementId: string, catalog: "playground" | "competition" = "playground") {
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
      assets_base_url: `${API_BASE}/submissions/${submissionId}/task-assets/assets/`,
      references_base_url: `${API_BASE}/submissions/${submissionId}/task-assets/references/`,
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
    payload: { filePath: string; firstLine?: number | null; kind?: "file" | "diff"; commitOid?: string | null },
  ) {
    const params = new URLSearchParams({
      file_path: payload.filePath,
      kind: payload.kind ?? "file",
    });
    if (payload.firstLine && payload.firstLine > 0) {
      params.set("first_line", String(payload.firstLine));
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
  ) {
    const source = new EventSource(`${API_BASE}/submissions/${submissionId}/events`, { withCredentials: true });
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
    agentSource?: "upload" | "builtin_arc_agent";
    file?: File | null;
    displayName?: string;
    modelName?: string;
    catalog?: "playground" | "competition";
  }) {
    const form = new FormData();
    form.append("requirement_id", payload.requirementId);
    form.append("runtime", payload.runtime);
    form.append("catalog", payload.catalog ?? "playground");
    form.append("agent_source", payload.agentSource ?? "upload");
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
  listMyTasks() {
    return request<UserTaskSummary[]>("/my-tasks");
  },
  getMyTask(taskId: string) {
    return request<UserTaskDetail>(`/my-tasks/${taskId}`);
  },
  createMyTask(payload: {
    title: string;
    task_type: "web" | "mobile" | "kernel" | "mixed";
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
  createMyTaskDraft() {
    return request<UserTaskDraft>("/my-tasks/drafts", {
      method: "POST",
    });
  },
  async uploadMyTaskDraftReference(draftId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<{ filename: string; relative_path: string; url: string }>(`/my-tasks/drafts/${draftId}/reference`, {
      method: "POST",
      body: form,
    });
  },
};
