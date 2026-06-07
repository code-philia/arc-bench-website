export type RequirementSummary = {
  id: string;
  title: string;
  category: string;
  summary: string;
  test_runner: string;
  total_tests: number;
  module_count: number;
};

export type RequirementDetail = RequirementSummary & {
  requirements_markdown: string;
  prerequisites_markdown: string;
  assets_base_url: string;
  references_base_url: string;
};

export type CompetitionTaskDownloadLinks = {
  requirement_document: string | null;
  prerequisites_document: string | null;
  tests_bundle: string | null;
  demo_bundle: string | null;
  full_bundle: string | null;
};

export type CompetitionTaskSummary = RequirementSummary & {
  public_downloads: CompetitionTaskDownloadLinks | null;
};

export type CompetitionSummary = {
  id: string;
  title: string;
  type: string;
  summary: string;
  task_count: number;
  total_tests: number;
  is_public: boolean;
};

export type CompetitionDetail = CompetitionSummary & {
  downloads: CompetitionTaskDownloadLinks | null;
  tasks: CompetitionTaskSummary[];
};

export type SubmissionStep = {
  key: string;
  title: string;
  status: string;
  description: string;
  logs: string[];
};

export type SubmissionSummary = {
  id: string;
  display_name: string | null;
  model_name: string | null;
  requirement_id: string;
  runtime: string;
  original_filename: string;
  status: string;
  score: number | null;
  passed_count: number;
  failed_count: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  failure_reason: string | null;
};

export type SubmissionDetail = SubmissionSummary & {
  steps: SubmissionStep[];
  stdout_path: string | null;
  stderr_path: string | null;
  result_path: string | null;
  workspace_path: string | null;
  logs_available: boolean;
  tests: Array<{
    name: string;
    status: string;
    duration_ms: number;
    error: string | null;
  }>;
};

export type SubmissionLogs = {
  events: string;
  stdout: string;
  stderr: string;
};

export type UserSummary = {
  id: string;
  email: string;
  username: string;
  created_at: string;
};

export type AuthResponse = {
  user: UserSummary;
};
