export type RequirementSummary = {
  id: string;
  display_id: string;
  title: string;
  category: string;
  summary: string;
  test_runner: string;
  total_tests: number;
  module_count: number;
};

export type RequirementDetail = RequirementSummary & {
  requirements_markdown: string;
  requirements_yaml: string | null;
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

export type BenchmarkDownloadLinks = {
  track_bundle: string | null;
  task_bundle: string | null;
};

export type BenchmarkSummary = {
  id: string;
  title: string;
  type: string;
  summary: string;
  task_count: number;
  total_tests: number;
  downloads: BenchmarkDownloadLinks | null;
};

export type BenchmarkDetail = BenchmarkSummary & {
  tasks: Array<RequirementSummary & { downloads: BenchmarkDownloadLinks | null }>;
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
  agent_source: "upload" | string;
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
  node_states: Record<string, RequirementVisualState>;
  can_pause: boolean;
  can_resume: boolean;
  can_rewind: boolean;
  can_manual_edit: boolean;
  manual_edit_node_id: string | null;
  manual_edit_phase: "design" | "implement" | null;
  manual_edit_dirty: boolean;
  pause_available: boolean;
};

export type SubmissionLogs = {
  events: string;
  stdout: string;
  stderr: string;
  visual_events: SubmissionVisualEvent[];
  runner_events?: SubmissionRunnerEvent[];
  runner_event_lines?: string[];
};

export type SubmissionTraceabilityInterface = {
  interface_id: string;
  req_ids: string[];
  type: string;
  content: string;
  file_path: string;
  first_line: string | null;
  implemented: boolean;
  callers: string[];
  callees: string[];
};

export type SubmissionTraceabilityTest = {
  test_id: string;
  req_id: string;
  scenario_id: string | null;
  type: string;
  file_path: string;
  first_line: string | null;
  status: "passed" | "failed" | null;
};

export type SubmissionTraceabilityPayload = {
  interfaces: SubmissionTraceabilityInterface[];
  tests: SubmissionTraceabilityTest[];
};

export type SubmissionSourcePayload = {
  kind: "file" | "diff";
  file_path: string;
  language: string;
  content: string;
  first_line: number;
};

export type SubmissionCommitChangedFile = {
  file_path: string;
  change_type: "A" | "M" | "D" | "R" | string;
  old_file_path: string | null;
};

export type SubmissionCommitHistoryEntry = {
  oid: string;
  short_oid: string;
  committed_at: string;
  message: string;
  node_id: string | null;
  phase: "design" | "implement" | null;
  summary: string | null;
  changed_files: SubmissionCommitChangedFile[];
};

export type SubmissionCommitHistoryPayload = {
  availability: "available" | "workspace_unavailable" | "git_unavailable";
  commits: SubmissionCommitHistoryEntry[];
};

export type SubmissionVisualEvent = {
  type: "requirement_state";
  node_id: string;
  phase: "design" | "implement" | "test";
  status: "completed" | "passed" | "failed";
  timestamp: string;
  message: string | null;
};

export type SubmissionRunnerEvent = {
  type: "runner_state";
  state: "paused" | "resumed";
  timestamp: string;
  message: string | null;
};

export type RequirementVisualState = "default" | "design" | "implement" | "test-passed" | "test-failed";

export type SubmissionEditableTaskPayload = {
  requirements_md: string;
  requirements_yaml: string;
  prerequisites_md: string;
  edited_node_id?: string | null;
};

export type SubmissionTaskAssets = {
  assets_base_url: string;
  references_base_url: string;
};

export type SubmissionPreviewStatus = {
  available: boolean;
  stale: boolean;
  workspace_head_oid: string | null;
  preview_head_oid: string | null;
  error: string | null;
};

export type SubmissionManualEditCommitPreview = {
  message: string;
  node_id: string | null;
  phase: "design" | "implement" | null;
  dirty: boolean;
  dirty_files: string[];
};

export type SubmissionSseRefresh = {
  submission: boolean;
  logs: boolean;
  commit_history: boolean;
  traceability_selected: boolean;
  traceability_all: boolean;
  preview: boolean;
};

export type SubmissionSseEvent = {
  submission_id: string;
  timestamp: number;
  version: number;
  refresh: SubmissionSseRefresh;
  reason: string | null;
};

export type UserTaskSummary = {
  id: string;
  title: string;
  task_type: "web" | "mobile" | "kernel" | "mixed";
  summary: string;
  root_requirement_id: string;
  node_count: number;
  atomic_count: number;
  created_at: string;
  updated_at: string;
};

export type UserTaskDetail = UserTaskSummary & {
  yaml_content: string;
  markdown_content: string;
};

export type UserTaskDraft = {
  draft_id: string;
  references_base_url: string;
  title: string;
  task_type: "web" | "mobile" | "kernel" | "mixed";
  yaml_content: string;
  markdown_content: string;
};

export type UserSummary = {
  id: string;
  email: string;
  username: string;
  github_email: string | null;
  github_username: string | null;
  created_at: string;
};

export type WorkspaceFileEntry = {
  path: string;
  name: string;
  is_directory: boolean;
  children?: WorkspaceFileEntry[];
};

export type WorkspaceFileListPayload = {
  files: WorkspaceFileEntry[];
};

export type FileUpdatePayload = {
  path: string;
  content: string;
};

export type TestCreatePayload = {
  test_id: string;
  req_id: string;
  test_type: string;
  scenario_id?: string | null;
  file_path?: string | null;
};

export type AuthResponse = {
  user: UserSummary;
};
