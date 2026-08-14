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
  assets_base_url: string;
  references_base_url: string;
  public_downloads: CompetitionTaskDownloadLinks | null;
};

export type RequirementTestFile = {
  path: string;
  content: string;
};

export type RequirementTests = {
  files: RequirementTestFile[];
};

export type CompetitionSummary = {
  id: string;
  title: string;
  type: string;
  summary: string;
  task_count: number;
  total_tests: number;
  is_public: boolean;
  starts_at: string | null;
  ends_at: string | null;
  status: "open" | "upcoming" | string;
  notice: string;
};

export type CompetitionLeaderboardEntry = {
  username: string;
  model_name: string | null;
  track: string;
  avg_pass_rate: number;
  total_token_millions: number | null;
  avg_runtime_seconds: number | null;
  submission_count: number;
};

export type CompetitionTaskRunScore = {
  task_id: string;
  task_title: string;
  run_id: string | null;
  status: string | null;
  test_pass_rate: number | null;
  feature_implementation_rate: number | null;
  run_duration_seconds: number | null;
  token_cost_usd: number | null;
  completed_at: string | null;
};

export type CompetitionSubmissionHistoryEntry = {
  id: string;
  display_name: string | null;
  model_name: string | null;
  original_filename: string;
  runtime: string;
  created_at: string;
  task_scores: CompetitionTaskRunScore[];
  average_test_pass_rate: number;
  average_feature_implementation_rate: number;
  total_run_duration_seconds: number;
  token_cost_usd: number | null;
  is_selected_score: boolean;
};

export type CompetitionDetail = CompetitionSummary & {
  downloads: CompetitionTaskDownloadLinks | null;
  tasks: CompetitionTaskSummary[];
  flow: string[];
  rules: string[];
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
  submission_id: string;
  display_name: string | null;
  model_name: string | null;
  requirement_id: string;
  catalog: "playground" | "competition" | "benchmark" | "my_tasks" | string;
  competition_id: string | null;
  runtime: string;
  agent_source: "upload" | string;
  original_filename: string;
  status: string;
  score: number | null;
  test_pass_rate: number | null;
  passed_count: number;
  failed_count: number;
  run_duration_seconds: number | null;
  token_cost_usd: number | null;
  feature_implemented_count: number;
  feature_total_count: number;
  feature_implementation_rate: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  failure_reason: string | null;
};

export type AgentSubmissionSummary = {
  id: string;
  display_name: string | null;
  model_name: string | null;
  catalog: string;
  competition_id: string | null;
  requirement_id: string | null;
  runtime: string;
  agent_source: "upload" | string;
  original_filename: string;
  created_at: string;
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
  can_cancel: boolean;
  can_continue: boolean;
};

export type SubmissionLogs = {
  events: string;
  stdout: string;
  stderr: string;
  console: string;
  log_offset: number;
  last_event_id: string | null;
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
  event_id: string;
  timestamp: string;
  stage: "Preparing environment" | "Running agent" | "Evaluating result" | string;
  status: string;
  summary: string;
  heartbeat: boolean;
  artifact_reference: string | null;
};

export type NotificationItem = {
  id: string;
  run_id: string | null;
  kind: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type NotificationList = {
  items: NotificationItem[];
  unread_count: number;
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
  preview_url: string | null;
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
  task_type: "web" | "mobile" | "kernel" | "mixed" | "cli";
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
  task_type: "web" | "mobile" | "kernel" | "mixed" | "cli";
  yaml_content: string;
  markdown_content: string;
};

export type UserSummary = {
  id: string;
  email: string;
  username: string;
  github_email: string | null;
  github_username: string | null;
  registration_source: "standard" | "beta" | "hackathon";
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type TeamSummary = {
  id: string;
  name: string;
  leader_user_id: string;
  leader_username: string;
  member_count: number;
  source_provider: string | null;
  source_team_id: string | null;
  github_repo: string | null;
  model_name: string | null;
  harness: string | null;
  created_at: string;
};

export type TeamMemberSummary = {
  user_id: string;
  username: string;
  display_name: string | null;
  role: "leader" | "member";
  created_at: string;
};

export type TeamJoinRequestSummary = {
  id: string;
  team_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  created_at: string;
};

export type MyTeamResponse = {
  team: TeamSummary | null;
  members: TeamMemberSummary[];
  incoming_requests: TeamJoinRequestSummary[];
  pending_request: TeamJoinRequestSummary | null;
  source_managed: boolean;
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
