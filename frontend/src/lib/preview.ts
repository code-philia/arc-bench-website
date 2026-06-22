import { api } from "./api";

export async function checkHostDemoPreview(submissionId: string): Promise<boolean> {
  const response = await api.getSubmissionPreviewStatus(submissionId);
  return response.available;
}
