import type {
  RequirementDetail,
  RequirementSummary,
  SubmissionDetail,
  SubmissionLogs,
  SubmissionSummary,
} from "./types";

const API_BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(payload.detail ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export const api = {
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
  async createSubmission(requirementId: string, runtime: string, file: File) {
    const form = new FormData();
    form.append("requirement_id", requirementId);
    form.append("runtime", runtime);
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
};
