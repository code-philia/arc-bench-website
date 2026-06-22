import type {
  AuthResponse,
  CompetitionDetail,
  CompetitionSummary,
  RequirementDetail,
  RequirementSummary,
  SubmissionDetail,
  SubmissionLogs,
  SubmissionSummary,
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
  listRequirements() {
    return request<RequirementSummary[]>("/requirements");
  },
  getRequirement(requirementId: string) {
    return request<RequirementDetail>(`/requirements/${requirementId}`);
  },
  listSubmissions(requirementId?: string) {
    const query = requirementId ? `?requirement_id=${encodeURIComponent(requirementId)}` : "";
    return request<SubmissionSummary[]>(`/submissions${query}`);
  },
  getSubmission(submissionId: string) {
    return request<SubmissionDetail>(`/submissions/${submissionId}`);
  },
  getSubmissionLogs(submissionId: string) {
    return request<SubmissionLogs>(`/submissions/${submissionId}/logs`);
  },
  getSubmissionPreviewStatus(submissionId: string) {
    return request<{ available: boolean; entry_file?: string }>(`/submissions/${submissionId}/preview/status`);
  },
  async createSubmission(
    requirementId: string,
    runtime: string,
    file: File,
    displayName?: string,
    modelName?: string,
  ) {
    const form = new FormData();
    form.append("requirement_id", requirementId);
    form.append("runtime", runtime);
    if (displayName && displayName.trim()) {
      form.append("display_name", displayName.trim());
    }
    if (modelName && modelName.trim()) {
      form.append("model_name", modelName.trim());
    }
    form.append("file", file);
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
    return `${API_BASE}/submissions/${submissionId}/preview/`;
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
  }) {
    return request<UserTaskDetail>("/my-tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
