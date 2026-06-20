import type { RequirementVisualState, SubmissionDetail, SubmissionLogs } from "../lib/types";

export type QuickStartMode = "real" | "mock";

export type QuickStartStepId =
  | "home-task-type"
  | "task-list-item"
  | "detail-contents"
  | "detail-document"
  | "detail-submit"
  | "submission-canvas"
  | "submission-node-detail"
  | "submission-api-doc";

export type QuickStartStep = {
  id: QuickStartStepId;
  route: string;
  targetId: string;
  title: string;
  message: string;
  buttonLabel: string;
  codeSnippet?: string;
  preferredPlacement?: "left" | "right" | "up" | "down";
};

export type QuickStartMockSubmission = {
  submission: SubmissionDetail;
  logs: SubmissionLogs;
};

export type QuickStartCanvasDemoState = {
  active: boolean;
  completed: boolean;
  currentNodeId: string | null;
  nodeStates: Record<string, RequirementVisualState>;
  selectedNodeId: string | null;
  detailExpanded: boolean;
};

export type QuickStartPrefill = {
  runtime: string;
  displayName: string;
  modelName: string;
  file: File | null;
  loading: boolean;
  error: string | null;
};
