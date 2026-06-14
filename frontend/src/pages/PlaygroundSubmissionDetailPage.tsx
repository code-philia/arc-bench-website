import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import RequirementTreeCanvas from "../components/requirements/RequirementTreeCanvas";
import SubmissionResultCard from "../components/submissions/SubmissionResultCard";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { ApiError, api } from "../lib/api";
import { requirementMarkdownToTree } from "../lib/taskTree";
import type { RequirementDetail, RequirementVisualState, SubmissionDetail, SubmissionLogs, SubmissionVisualEvent } from "../lib/types";

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt) return "-";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.round((end - start) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function resultSummary(submission: SubmissionDetail) {
  const total = submission.passed_count + submission.failed_count;
  if (total === 0) return "No test results yet";
  return `${submission.passed_count}/${total} passed`;
}

function normalizeTaskType(value: string) {
  if (value === "web" || value === "mobile" || value === "kernel" || value === "mixed") {
    return value;
  }
  return "web";
}

function toVisualState(event: SubmissionVisualEvent): RequirementVisualState {
  if (event.phase === "design") {
    return "design";
  }
  if (event.phase === "implement") {
    return "implement";
  }
  if (event.phase === "test" && event.status === "passed") {
    return "test-passed";
  }
  if (event.phase === "test" && event.status === "failed") {
    return "test-failed";
  }
  return "default";
}

export default function PlaygroundSubmissionDetailPage() {
  const { taskType: rawTaskType = "web", requirementId = "", submissionId = "" } = useParams();
  const taskType = normalizeTaskType(rawTaskType);
  const { user } = useAuth();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [logs, setLogs] = useState<SubmissionLogs | null>(null);
  const [requirement, setRequirement] = useState<RequirementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorStatus, setLoadErrorStatus] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"canvas" | "results" | "stdio">("canvas");
  const [stdioTab, setStdioTab] = useState<"stdout" | "stderr">("stdout");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("ROOT");
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [pulseNodeId, setPulseNodeId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const seenVisualKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLoadError(null);
    setLoadErrorStatus(null);
    Promise.all([
      api.getSubmission(submissionId),
      api.getSubmissionLogs(submissionId),
      api.getRequirement(requirementId),
    ])
      .then(([detail, latestLogs, requirementDetail]) => {
        setSubmission(detail);
        setLogs(latestLogs);
        setRequirement(requirementDetail);
        if (["PENDING", "RUNNING"].includes(detail.status)) {
          pollRef.current = window.setInterval(() => {
            api.getSubmission(submissionId).then(setSubmission).catch(() => undefined);
            api.getSubmissionLogs(submissionId).then(setLogs).catch(() => undefined);
          }, 2000);
        }
      })
      .catch((error: Error) => {
        setSubmission(null);
        setLogs(null);
        setRequirement(null);
        setLoadError(error.message);
        setLoadErrorStatus(error instanceof ApiError ? error.status : null);
      })
      .finally(() => setLoading(false));

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [requirementId, submissionId]);

  useEffect(() => {
    if (!submission || !pollRef.current) {
      return;
    }
    if (!["PENDING", "RUNNING"].includes(submission.status)) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [submission]);

  const tree = useMemo(() => {
    if (!requirement) {
      return null;
    }
    return requirementMarkdownToTree(requirement.requirements_markdown);
  }, [requirement]);

  const nodeStates = useMemo(() => {
    const nextState: Record<string, RequirementVisualState> = {};
    for (const event of logs?.visual_events ?? []) {
      nextState[event.node_id] = toVisualState(event);
    }
    return nextState;
  }, [logs]);

  useEffect(() => {
    const events = logs?.visual_events ?? [];
    if (events.length === 0) {
      return;
    }
    const newest = [...events].reverse().find((event) => {
      const key = `${event.timestamp}:${event.node_id}:${event.phase}:${event.status}:${event.message ?? ""}`;
      if (seenVisualKeysRef.current.has(key)) {
        return false;
      }
      seenVisualKeysRef.current.add(key);
      return true;
    });
    if (!newest) {
      return;
    }
    setActiveTab("canvas");
    setSelectedNodeId(newest.node_id);
    setDetailExpanded(true);
    setFocusNodeId(newest.node_id);
    setPulseNodeId(newest.node_id);
    const timer = window.setTimeout(() => setPulseNodeId((current) => (current === newest.node_id ? null : current)), 1400);
    return () => window.clearTimeout(timer);
  }, [logs]);

  if (loading) {
    return (
      <div className="page centered">
        <div className="loading-state">Loading submission...</div>
      </div>
    );
  }

  if (!submission || !requirement) {
    const loginRequired = loadErrorStatus === 401;
    return (
      <div className="page centered">
        <div className="empty-state">
          {loginRequired
            ? "Login is required to view this submission."
            : loadError || "Submission not found."}
          <div style={{ marginTop: 8 }}>
            {loginRequired || !user ? (
              <Link className="inline-link" to="/login">
                Login
              </Link>
            ) : (
              <Link className="inline-link" to={`/playground/task-bank/${taskType}/${requirementId}`}>
                Back to task
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page submission-page submission-page-locked playground-submission-page">
      <div className="submission-grid submission-grid-locked playground-submission-workspace">
        <section className="action-section submission-status-panel playground-submission-sidebar">
          <div className="playground-submission-heading">
            <h1>{submission.display_name || submission.id}</h1>
            <div className="playground-submission-inline-meta">
              <span>{submission.id}</span>
              <span>Duration: {formatDuration(submission.started_at, submission.finished_at)}</span>
            </div>
          </div>

          <div className="action-section-title">Run Status</div>
          <SubmissionStepList
            steps={submission.steps}
            submissionStatus={submission.status}
            failureReason={submission.failure_reason}
          />
        </section>

        <section className="action-section submission-detail-panel playground-submission-main">
          <div className="doc-tabs detail-tabs">
            {[
              { key: "canvas", label: "Canvas" },
              { key: "results", label: "Test Result" },
              { key: "stdio", label: "Stdout/Stderror" },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`doc-tab${activeTab === tab.key ? " active" : ""}`}
                type="button"
                onClick={() => setActiveTab(tab.key as "canvas" | "results" | "stdio")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="detail-tab-panel playground-submission-tab-panel">
            {activeTab === "canvas" ? (
              tree ? (
                <div className="playground-canvas-panel">
                  <RequirementTreeCanvas
                    tree={tree}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={(nodeId) => {
                      setSelectedNodeId(nodeId);
                      setDetailExpanded(Boolean(nodeId));
                    }}
                    detailExpanded={detailExpanded}
                    onDetailExpandedChange={setDetailExpanded}
                    mode="readonly"
                    detailPlacement="right"
                    nodeStates={nodeStates}
                    focusNodeId={focusNodeId}
                    pulseNodeId={pulseNodeId}
                    showLegend
                  />
                </div>
              ) : (
                <div className="results-empty">
                  <div className="empty-state">Canvas is not available.</div>
                </div>
              )
            ) : activeTab === "results" ? (
              <SubmissionResultCard submission={submission} />
            ) : (
              <div className="stdio-shell">
                <div className="doc-tabs detail-tabs nested-tabs">
                  <button
                    className={`doc-tab${stdioTab === "stdout" ? " active" : ""}`}
                    type="button"
                    onClick={() => setStdioTab("stdout")}
                  >
                    Stdout
                  </button>
                  <button
                    className={`doc-tab${stdioTab === "stderr" ? " active" : ""}`}
                    type="button"
                    onClick={() => setStdioTab("stderr")}
                  >
                    Stderror
                  </button>
                </div>
                <pre className="log-panel">{stdioTab === "stdout" ? (logs?.stdout || "No stdout yet.") : (logs?.stderr || "No stderr yet.")}</pre>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
