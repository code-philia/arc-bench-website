import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import RequirementTreeCanvas from "../components/requirements/RequirementTreeCanvas";
import SubmissionResultCard from "../components/submissions/SubmissionResultCard";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { ApiError, api } from "../lib/api";
import { checkHostDemoPreview } from "../lib/preview";
import { requirementMarkdownToTree } from "../lib/taskTree";
import type { RequirementDetail, RequirementVisualState, SubmissionDetail, SubmissionLogs, SubmissionVisualEvent } from "../lib/types";
import { useQuickStart } from "../quickstart/QuickStartContext";

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
  const [previewMinimized, setPreviewMinimized] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(50);
  const pollRef = useRef<number | null>(null);
  const seenVisualKeysRef = useRef<Set<string>>(new Set());
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const quickStart = useQuickStart();
  const useQuickStartSubmission = quickStart.active && quickStart.isSubmissionRouteMatch(submissionId);
  const previewUrl = "http://127.0.0.1:3000";

  useEffect(() => {
    quickStart.syncStepForRoute();
  }, [quickStart, submissionId]);

  useEffect(() => {
    if (useQuickStartSubmission && quickStart.mode === "mock" && quickStart.mockSubmission) {
      setSubmission(quickStart.mockSubmission.submission);
      setLogs(quickStart.mockSubmission.logs);
      api.getRequirement(requirementId)
        .then(setRequirement)
        .catch((error: Error) => {
          setRequirement(null);
          setLoadError(error.message);
          setLoadErrorStatus(error instanceof ApiError ? error.status : null);
        })
        .finally(() => setLoading(false));
      return () => undefined;
    }

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
  }, [quickStart.mockSubmission, quickStart.mode, requirementId, submissionId, useQuickStartSubmission]);

  useEffect(() => {
    if (!submission || !pollRef.current) {
      return;
    }
    if (!["PENDING", "RUNNING"].includes(submission.status)) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [submission]);

  useEffect(() => {
    if (!submission) {
      setPreviewAvailable(false);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);

    const checkPreview = () => {
      checkHostDemoPreview(previewUrl)
        .then((available) => {
          if (cancelled) {
            return;
          }
          setPreviewAvailable(available);
          setPreviewLoading(false);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setPreviewAvailable(false);
          setPreviewLoading(false);
        });
    };

    checkPreview();

    if (["PENDING", "RUNNING"].includes(submission.status)) {
      const previewPoll = window.setInterval(checkPreview, 3000);
      return () => {
        cancelled = true;
        window.clearInterval(previewPoll);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [previewUrl, submission]);

  const tree = useMemo(() => {
    if (!requirement) {
      return null;
    }
    return requirementMarkdownToTree(requirement.requirements_markdown);
  }, [requirement]);

  const nodeStates = useMemo(() => {
    if (useQuickStartSubmission && quickStart.canvasDemo.active) {
      return quickStart.canvasDemo.nodeStates;
    }
    const nextState: Record<string, RequirementVisualState> = {};
    for (const event of logs?.visual_events ?? []) {
      nextState[event.node_id] = toVisualState(event);
    }
    return nextState;
  }, [logs, quickStart.canvasDemo.active, quickStart.canvasDemo.nodeStates, useQuickStartSubmission]);

  useEffect(() => {
    if (!useQuickStartSubmission || !quickStart.canvasDemo.active) {
      return;
    }
    setActiveTab("canvas");
    setSelectedNodeId(quickStart.canvasDemo.selectedNodeId);
    setDetailExpanded(quickStart.canvasDemo.detailExpanded);
    setFocusNodeId(quickStart.canvasDemo.currentNodeId);
    setPulseNodeId(quickStart.canvasDemo.currentNodeId);
  }, [quickStart.canvasDemo, useQuickStartSubmission]);

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

  const onMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    isDragging.current = true;
    startX.current = event.clientX;
    startWidth.current = previewWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging.current) return;

    const delta = startX.current - event.clientX;
    if (Math.abs(delta) < 3) return;

    const percentDelta = (delta / window.innerWidth) * 100 * 0.6;
    let nextWidth = startWidth.current + percentDelta;
    nextWidth = Math.max(20, Math.min(80, nextWidth));
    setPreviewWidth(nextWidth);
  };

  const onMouseUp = () => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

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
    <div className="page playground-submission-page" style={{
      height: "calc(100vh - 60px)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
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

        <main style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: "1px solid var(--border)",
          background: "white",
        }}>
          <div className="doc-tabs" style={{ borderBottom: "1px solid var(--border)", padding: "0 16px" }}>
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

          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {activeTab === "canvas" ? (
              tree ? (
                <div
                  data-quickstart-id="quickstart-submission-canvas"
                  style={{ flex: 1, position: "relative", overflow: "hidden" }}
                >
                  <RequirementTreeCanvas
                    tree={tree}
                    selectedNodeId={useQuickStartSubmission && quickStart.canvasDemo.selectedNodeId !== null
                      ? quickStart.canvasDemo.selectedNodeId
                      : selectedNodeId}
                    onSelectNode={(nodeId) => {
                      setSelectedNodeId(nodeId);
                      setDetailExpanded(Boolean(nodeId));
                      if (useQuickStartSubmission) {
                        quickStart.setSelectedNode(nodeId);
                        quickStart.setDetailExpanded(Boolean(nodeId));
                      }
                    }}
                    detailExpanded={useQuickStartSubmission ? quickStart.canvasDemo.detailExpanded : detailExpanded}
                    onDetailExpandedChange={(expanded) => {
                      setDetailExpanded(expanded);
                      if (useQuickStartSubmission) {
                        quickStart.setDetailExpanded(expanded);
                      }
                    }}
                    mode="readonly"
                    detailPlacement="bottom"
                    nodeStates={nodeStates}
                    focusNodeId={useQuickStartSubmission ? quickStart.canvasDemo.currentNodeId : focusNodeId}
                    pulseNodeId={useQuickStartSubmission ? quickStart.canvasDemo.currentNodeId : pulseNodeId}
                    showLegend
                    detailTestId="quickstart-submission-node-detail"
                  />
                </div>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
                  Canvas is not available.
                </div>
              )
            ) : activeTab === "results" ? (
              <div style={{ padding: "24px", flex: 1, overflow: "auto" }}>
                <SubmissionResultCard submission={submission} />
              </div>
            ) : (
              <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <div className="doc-tabs" style={{ padding: "0 24px", borderBottom: "1px solid var(--border)" }}>
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
                <pre style={{
                  flex: 1,
                  margin: 0,
                  padding: "24px",
                  background: "#1e1e1e",
                  color: "#d4d4d4",
                  overflow: "auto",
                  fontFamily: "monospace",
                  fontSize: "0.875rem",
                }}>
                  {stdioTab === "stdout" ? (logs?.stdout || "No stdout yet.") : (logs?.stderr || "No stderr yet.")}
                </pre>
              </div>
            )}
          </div>
        </main>

        <div
          onMouseDown={onMouseDown}
          style={{
            width: "16px",
            cursor: "col-resize",
            background: "#f8fafc",
            borderLeft: "1px solid #e2e8f0",
            borderRight: "1px solid #e2e8f0",
            display: previewMinimized ? "none" : "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "6px",
            position: "relative",
          }}
        >
          <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#cbd5e1" }} />
          <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#cbd5e1" }} />
          <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#cbd5e1" }} />
        </div>

        <aside style={{
          width: previewMinimized ? "80px" : `${previewWidth}%`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "white",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.06)",
          transition: "width 0.3s ease",
        }}>
          <div style={{
            padding: "12px 16px",
            background: "#f8fafc",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            minHeight: "48px",
          }}>
            {!previewMinimized ? (
              <>
                <span style={{
                  fontWeight: 700,
                  fontSize: "0.9375rem",
                  color: "#1e293b",
                  letterSpacing: "0.01em",
                }}>
                  Live Website Preview
                </span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {submission && previewAvailable ? (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: "0.8125rem",
                        color: "#64748b",
                        textDecoration: "none",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      onMouseOver={(linkEvent) => {
                        linkEvent.currentTarget.style.color = "#3b82f6";
                        linkEvent.currentTarget.style.background = "#eff6ff";
                      }}
                      onMouseOut={(linkEvent) => {
                        linkEvent.currentTarget.style.color = "#64748b";
                        linkEvent.currentTarget.style.background = "transparent";
                      }}
                    >
                      Open
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setPreviewMinimized(true)}
                    style={{
                      width: "28px",
                      height: "28px",
                      border: "1px solid #e2e8f0",
                      background: "white",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#64748b",
                      transition: "all 0.15s ease",
                    }}
                    onMouseOver={(buttonEvent) => {
                      buttonEvent.currentTarget.style.borderColor = "#cbd5e1";
                      buttonEvent.currentTarget.style.color = "#334155";
                      buttonEvent.currentTarget.style.background = "#f1f5f9";
                    }}
                    onMouseOut={(buttonEvent) => {
                      buttonEvent.currentTarget.style.borderColor = "#e2e8f0";
                      buttonEvent.currentTarget.style.color = "#64748b";
                      buttonEvent.currentTarget.style.background = "white";
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: "scaleX(-1)" }}>
                      <path d="M11 19L3 12L11 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21 19L13 12L21 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setPreviewMinimized(false)}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "6px",
                  color: "#475569",
                }}
                onMouseOver={(buttonEvent) => {
                  buttonEvent.currentTarget.style.color = "#3b82f6";
                }}
                onMouseOut={(buttonEvent) => {
                  buttonEvent.currentTarget.style.color = "#475569";
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M13 5L21 12L13 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 5L11 12L3 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  writingMode: "vertical-rl",
                  textOrientation: "upright",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                }}>
                  Preview
                </span>
              </button>
            )}
          </div>

          {!previewMinimized ? (
            <div style={{ flex: 1, position: "relative", background: "white", overflow: "hidden" }}>
              {previewLoading ? (
                <div style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                }}>
                  Loading preview...
                </div>
              ) : submission && previewAvailable ? (
                <iframe
                  key={submissionId}
                  src={previewUrl}
                  title="Live Website Preview"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    border: "none",
                    background: "white",
                  }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                />
              ) : (
                <div style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: "40px",
                  color: "#64748b",
                  flexDirection: "column",
                  gap: "12px",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#334155" }}>
                      {submission ? "Preview not available yet" : "No submission selected"}
                    </div>
                    <div style={{ fontSize: "0.875rem", marginTop: "4px", color: "#64748b" }}>
                      {submission
                        ? "Waiting for host demo backend to build and start."
                        : "Select a submission to view its preview"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
