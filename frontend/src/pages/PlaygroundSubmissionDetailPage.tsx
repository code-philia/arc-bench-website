import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import RequirementTreeCanvas from "../components/requirements/RequirementTreeCanvas";
import SubmissionResultCard from "../components/submissions/SubmissionResultCard";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { ApiError, api } from "../lib/api";
import { checkHostDemoPreview, getHostDemoPreviewBase } from "../lib/preview";
import { findNodeById, parseTaskTreeYaml, requirementMarkdownToTree } from "../lib/taskTree";
import type {
  RequirementDetail,
  RequirementVisualState,
  SubmissionCommitChangedFile,
  SubmissionCommitHistoryEntry,
  SubmissionCommitHistoryPayload,
  SubmissionDetail,
  SubmissionLogs,
  SubmissionSourcePayload,
  SubmissionTraceabilityPayload,
  SubmissionVisualEvent,
} from "../lib/types";
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

function formatLineNumber(value: number | null) {
  return value && value > 0 ? value : 1;
}

function codeLines(content: string) {
  return content.replace(/\r\n/g, "\n").split("\n");
}

function formatCommitDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function diffLineClassName(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++ ")) {
    return "diff-line added";
  }
  if (line.startsWith("-") && !line.startsWith("--- ")) {
    return "diff-line removed";
  }
  if (line.startsWith("@@")) {
    return "diff-line hunk";
  }
  if (
    line.startsWith("diff --git")
    || line.startsWith("index ")
    || line.startsWith("--- ")
    || line.startsWith("+++ ")
    || line.startsWith("rename from ")
    || line.startsWith("rename to ")
    || line.startsWith("new file mode ")
    || line.startsWith("deleted file mode ")
  ) {
    return "diff-line meta";
  }
  return "diff-line";
}

function commitHistoryEmptyState(payload: SubmissionCommitHistoryPayload | null) {
  if (!payload) {
    return "No git history is available for this submission.";
  }
  if (payload.availability === "workspace_unavailable") {
    return "Submission workspace is not available for this run.";
  }
  if (payload.availability === "git_unavailable") {
    return "Git history is not available because workspace/template/.git is missing.";
  }
  return "No git history is available for this submission.";
}

function changedFileLabel(changedFile: SubmissionCommitChangedFile) {
  if (changedFile.change_type === "R" && changedFile.old_file_path) {
    return `${changedFile.old_file_path} -> ${changedFile.file_path}`;
  }
  return changedFile.file_path;
}

function readDiffHeaderPath(diffContent: string, fallback: string) {
  const lines = codeLines(diffContent);
  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      return line.slice(6).trim() || fallback;
    }
    if (line.startsWith("rename to ")) {
      return line.slice("rename to ".length).trim() || fallback;
    }
  }
  return fallback;
}

function findNewestCommitForNode(
  payload: SubmissionCommitHistoryPayload | null,
  nodeId: string | null,
) {
  if (!payload || !nodeId) {
    return null;
  }
  for (let index = payload.commits.length - 1; index >= 0; index -= 1) {
    const commit = payload.commits[index];
    if (commit.node_id === nodeId) {
      return commit;
    }
  }
  return null;
}

function TraceabilityPanel({
  traceability,
  nodeId,
  nodeName,
  loading,
  error,
  onOpenSource,
}: {
  traceability: SubmissionTraceabilityPayload | null;
  nodeId: string | null;
  nodeName: string | null;
  loading: boolean;
  error: string | null;
  onOpenSource: (payload: { filePath: string; firstLine?: number | null }) => void;
}) {
  if (!nodeId || !nodeName) {
    return (
      <div className="traceability-empty-state">
        Select a requirement node on the canvas to inspect its linked interfaces and tests.
      </div>
    );
  }

  if (loading) {
    return <div className="traceability-empty-state">Loading traceability data...</div>;
  }

  if (error) {
    return <div className="traceability-empty-state">{error}</div>;
  }

  if (!traceability || (traceability.interfaces.length === 0 && traceability.tests.length === 0)) {
    return <div className="traceability-empty-state">No interfaces or tests are linked to this requirement yet.</div>;
  }

  return (
    <div className="traceability-panel">
      <div className="traceability-panel-header">
        <div className="traceability-panel-kicker">Selected Requirement</div>
        <div className="traceability-panel-title">{nodeId}</div>
        <div className="traceability-panel-subtitle">{nodeName}</div>
      </div>

      <section className="traceability-section">
        <div className="traceability-section-head">
          <h3>Interfaces</h3>
          <span>{traceability.interfaces.length}</span>
        </div>
        <div className="traceability-card-list">
          {traceability.interfaces.map((item) => (
            <article
              key={item.interface_id}
              className="traceability-card"
              role="button"
              tabIndex={0}
              onClick={() => onOpenSource({ filePath: item.file_path, firstLine: item.first_line })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenSource({ filePath: item.file_path, firstLine: item.first_line });
                }
              }}
            >
              <div className="traceability-card-top">
                <div>
                  <div className="traceability-card-id">{item.interface_id}</div>
                  <div className="traceability-card-path">{item.file_path}:{formatLineNumber(item.first_line)}</div>
                </div>
                <div className="traceability-chip-row">
                  <span className={`traceability-chip type-${item.type.toLowerCase()}`}>{item.type}</span>
                  <span className={`traceability-chip ${item.implemented ? "implemented" : "planned"}`}>
                    {item.implemented ? "Implemented" : "Planned"}
                  </span>
                </div>
              </div>
              <div className="traceability-card-content">{item.content}</div>
              <div className="traceability-meta-grid">
                <div>
                  <span className="traceability-meta-label">Req IDs</span>
                  <span>{item.req_ids.join(", ")}</span>
                </div>
                <div>
                  <span className="traceability-meta-label">Callers</span>
                  <span>{item.callers.length ? item.callers.join(", ") : "None"}</span>
                </div>
                <div>
                  <span className="traceability-meta-label">Callees</span>
                  <span>{item.callees.length ? item.callees.join(", ") : "None"}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="traceability-section">
        <div className="traceability-section-head">
          <h3>Tests</h3>
          <span>{traceability.tests.length}</span>
        </div>
        <div className="traceability-card-list">
          {traceability.tests.map((item) => (
            <article
              key={item.test_id}
              className="traceability-card"
              role="button"
              tabIndex={0}
              onClick={() => onOpenSource({ filePath: item.file_path, firstLine: item.first_line })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenSource({ filePath: item.file_path, firstLine: item.first_line });
                }
              }}
            >
              <div className="traceability-card-top">
                <div>
                  <div className="traceability-card-id">{item.test_id}</div>
                  <div className="traceability-card-path">{item.file_path}:{formatLineNumber(item.first_line)}</div>
                </div>
                <span className={`traceability-chip type-${item.type.toLowerCase()}`}>{item.type}</span>
              </div>
              <div className="traceability-meta-grid">
                <div>
                  <span className="traceability-meta-label">Requirement</span>
                  <span>{item.req_id}</span>
                </div>
                <div>
                  <span className="traceability-meta-label">Scenario</span>
                  <span>{item.scenario_id ?? "Not linked"}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function SubmissionFilePanel({
  source,
  loading,
  error,
  diffCommit,
  diffFiles,
  selectedDiffFilePath,
  onOpenDiffFile,
}: {
  source: SubmissionSourcePayload | null;
  loading: boolean;
  error: string | null;
  diffCommit: SubmissionCommitHistoryEntry | null;
  diffFiles: SubmissionCommitChangedFile[];
  selectedDiffFilePath: string | null;
  onOpenDiffFile: (changedFile: SubmissionCommitChangedFile) => void;
}) {
  const codeViewRef = useRef<HTMLPreElement | null>(null);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const showInlineLoading = loading && Boolean(source);

  useEffect(() => {
    if (!source || !codeViewRef.current) {
      return;
    }
    const lineHeight = 1.65 * 0.84 * 16;
    const scrollTop = Math.max(0, (formatLineNumber(source.first_line) - 3) * lineHeight);
    codeViewRef.current.scrollTop = scrollTop;
  }, [source]);

  if (loading && !source) {
    return <div className="ide-empty-state">Loading source...</div>;
  }

  if (error) {
    return <div className="ide-empty-state">{error}</div>;
  }

  if (!source) {
    return <div className="ide-empty-state">Select an interface or test to inspect source.</div>;
  }

  if (source.kind === "diff") {
    const diffLines = codeLines(source.content);
    const diffDisplayPath = readDiffHeaderPath(source.content, source.file_path);
    const hasWorkspaceFiles = diffFiles.length > 0;
    const editorTitle = selectedDiffFilePath ?? diffDisplayPath;
    return (
      <div className={`ide-shell ${workspaceCollapsed ? "workspace-collapsed" : ""}`}>
        {!workspaceCollapsed ? (
          <aside className="ide-sidebar">
            <div className="ide-sidebar-title">
              <span>Workspace</span>
              <button
                type="button"
                className="ide-sidebar-toggle"
                onClick={() => setWorkspaceCollapsed(true)}
                aria-label="Collapse workspace"
                title="Collapse workspace"
              >
                <span aria-hidden="true">&lt;</span>
              </button>
            </div>
            <div className="ide-file-list">
              {hasWorkspaceFiles ? diffFiles.map((changedFile) => {
                const isActive = selectedDiffFilePath === changedFile.file_path;
                return (
                  <button
                    key={`${changedFile.change_type}:${changedFile.old_file_path ?? ""}:${changedFile.file_path}`}
                    type="button"
                    className={`ide-file-item diff-workspace-item${isActive ? " active" : ""}`}
                    onClick={() => onOpenDiffFile(changedFile)}
                  >
                    <span className={`ide-file-kind kind-diff kind-change-${changedFile.change_type.toLowerCase()}`}>
                      {changedFile.change_type}
                    </span>
                    <span className="ide-file-path">{changedFileLabel(changedFile)}</span>
                  </button>
                );
              }) : (
                <div className="ide-file-list-empty">
                  {diffCommit ? `No changed files found in commit ${diffCommit.short_oid}.` : "No changed files found."}
                </div>
              )}
            </div>
          </aside>
        ) : null}

        <section className="ide-editor">
          {workspaceCollapsed ? (
            <button
              type="button"
              className="ide-sidebar-restore"
              onClick={() => setWorkspaceCollapsed(false)}
              aria-label="Expand workspace"
              title="Expand workspace"
            >
              <span aria-hidden="true">&gt;</span>
            </button>
          ) : null}
          <div className="ide-editor-topbar">
            <div className="ide-window-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="ide-editor-title">{editorTitle}</div>
            <div className="ide-editor-badge">DIFF</div>
          </div>
          <pre ref={codeViewRef} className="ide-code-view is-diff">
            <code>
              {diffLines.map((line, index) => {
                const lineNumber = index + 1;
                return (
                  <div
                    key={`${lineNumber}:${line}`}
                    className={diffLineClassName(line)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "56px minmax(0, 1fr)",
                      gap: "14px",
                      borderRadius: 0,
                      padding: "0 8px",
                      margin: "0 -8px",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)", userSelect: "none" }}>{lineNumber}</span>
                    <span>{line || " "}</span>
                  </div>
                );
              })}
            </code>
          </pre>
          {showInlineLoading ? <div className="ide-loading-overlay">Loading diff...</div> : null}
        </section>
      </div>
    );
  }

  const lines = codeLines(source.content);
  const highlightedLine = formatLineNumber(source.first_line);

  return (
    <div className={`ide-shell ${workspaceCollapsed ? "workspace-collapsed" : ""}`}>
      {!workspaceCollapsed ? (
        <aside className="ide-sidebar">
          <div className="ide-sidebar-title">
            <span>Workspace</span>
            <button
              type="button"
              className="ide-sidebar-toggle"
              onClick={() => setWorkspaceCollapsed(true)}
              aria-label="Collapse workspace"
              title="Collapse workspace"
            >
              <span aria-hidden="true">&lt;</span>
            </button>
          </div>
          <div className="ide-file-list">
            <div className="ide-file-item active">
              <span className="ide-file-kind kind-file">{source.language.toUpperCase()}</span>
              <span className="ide-file-path">{source.file_path}</span>
            </div>
          </div>
        </aside>
      ) : null}

      <section className="ide-editor">
        {workspaceCollapsed ? (
          <button
            type="button"
            className="ide-sidebar-restore"
            onClick={() => setWorkspaceCollapsed(false)}
            aria-label="Expand workspace"
            title="Expand workspace"
          >
            <span aria-hidden="true">&gt;</span>
          </button>
        ) : null}
        <div className="ide-editor-topbar">
          <div className="ide-window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="ide-editor-title">{source.file_path}</div>
          <div className="ide-editor-badge">{source.language.toUpperCase()}</div>
        </div>
        <pre ref={codeViewRef} className="ide-code-view">
          <code>
            {lines.map((line, index) => {
              const lineNumber = index + 1;
              const isHighlighted = lineNumber === highlightedLine;
              return (
                <div
                  key={`${lineNumber}:${line}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px minmax(0, 1fr)",
                    gap: "14px",
                    background: isHighlighted ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                    borderRadius: "8px",
                    padding: "0 8px",
                    margin: "0 -8px",
                  }}
                >
                  <span
                    style={{
                      color: isHighlighted ? "var(--accent)" : "var(--text-muted)",
                      userSelect: "none",
                    }}
                  >
                    {lineNumber}
                  </span>
                  <span>{line || " "}</span>
                </div>
              );
            })}
          </code>
        </pre>
        {showInlineLoading ? <div className="ide-loading-overlay">Loading source...</div> : null}
      </section>
    </div>
  );
}

function CommitHistoryPanel({
  commits,
  loading,
  error,
  selectedNodeId,
  selectedCommitOid,
  onSelectCommit,
  onOpenDiff,
}: {
  commits: SubmissionCommitHistoryPayload | null;
  loading: boolean;
  error: string | null;
  selectedNodeId: string | null;
  selectedCommitOid: string | null;
  onSelectCommit: (commit: SubmissionCommitHistoryEntry) => void;
  onOpenDiff: (commit: SubmissionCommitHistoryEntry) => void;
}) {
  const [menuState, setMenuState] = useState<{ commit: SubmissionCommitHistoryEntry; x: number; y: number } | null>(null);
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);
  const orderedCommits = useMemo(() => [...(commits?.commits ?? [])].reverse(), [commits]);

  useEffect(() => {
    if (!menuState) {
      return;
    }
    const closeMenu = () => setMenuState(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
    };
  }, [menuState]);

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "center" });
  }, [selectedCommitOid]);

  if (loading) {
    return <div className="commit-history-empty">Loading commit history...</div>;
  }

  if (error) {
    return <div className="commit-history-empty">{error}</div>;
  }

  if (!commits || commits.commits.length === 0) {
    return <div className="commit-history-empty">{commitHistoryEmptyState(commits)}</div>;
  }

  return (
    <div className="commit-history-panel">
      <div className="commit-history-list">
        {orderedCommits.map((commit) => {
          const isCommitSelected = selectedCommitOid === commit.oid;
          return (
            <button
              key={commit.oid}
              type="button"
              ref={isCommitSelected ? selectedItemRef : null}
              className={`commit-history-item${isCommitSelected ? " commit-active" : ""}`}
              onClick={() => onSelectCommit(commit)}
              onContextMenu={(event) => {
                event.preventDefault();
                onSelectCommit(commit);
                setMenuState({ commit, x: event.clientX, y: event.clientY });
              }}
            >
              <span className="commit-history-main">{commit.message}</span>
              <span className="commit-history-secondary">{[
                commit.short_oid,
                commit.node_id,
                formatCommitDateTime(commit.committed_at),
              ].filter(Boolean).join(" · ")}</span>
            </button>
          );
        })}
      </div>
      {menuState ? (
        <div
          className="commit-history-context-menu"
          style={{ left: `${menuState.x}px`, top: `${menuState.y}px` }}
          role="menu"
        >
          <button
            type="button"
            className="commit-history-context-action"
            onClick={() => {
              onOpenDiff(menuState.commit);
              setMenuState(null);
            }}
          >
            View Git Diff
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function PlaygroundSubmissionDetailPage() {
  const { taskType: rawTaskType = "web", requirementId = "", submissionId = "" } = useParams();
  const location = useLocation();
  const taskType = normalizeTaskType(rawTaskType);
  const requirementCatalog = location.pathname.startsWith("/submissions/") ? "competition" : "playground";
  const { user } = useAuth();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [logs, setLogs] = useState<SubmissionLogs | null>(null);
  const [requirement, setRequirement] = useState<RequirementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorStatus, setLoadErrorStatus] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"canvas" | "results" | "stdio" | "file">("canvas");
  const [stdioTab, setStdioTab] = useState<"stdout" | "stderr">("stdout");
  const [sidebarTab, setSidebarTab] = useState<"status" | "traceability">("status");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("ROOT");
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [pulseNodeId, setPulseNodeId] = useState<string | null>(null);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [previewMinimized, setPreviewMinimized] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(() => {
    if (typeof window === "undefined") {
      return 480;
    }
    return Math.round(window.innerWidth * 0.333);
  });
  const pollRef = useRef<number | null>(null);
  const visualEventCountRef = useRef(0);
  const isSidebarDragging = useRef(false);
  const sidebarDragStartX = useRef(0);
  const sidebarDragStartWidth = useRef(0);
  const isPreviewDragging = useRef(false);
  const previewDragStartX = useRef(0);
  const previewDragStartWidth = useRef(0);
  const suppressNodeToCommitSyncRef = useRef(false);
  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewFrameVersion, setPreviewFrameVersion] = useState(0);
  const [previewTab, setPreviewTab] = useState<"preview" | "history">("preview");
  const [traceability, setTraceability] = useState<SubmissionTraceabilityPayload | null>(null);
  const [traceabilityLoading, setTraceabilityLoading] = useState(false);
  const [traceabilityError, setTraceabilityError] = useState<string | null>(null);
  const [source, setSource] = useState<SubmissionSourcePayload | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [commitHistory, setCommitHistory] = useState<SubmissionCommitHistoryPayload | null>(null);
  const [commitHistoryLoading, setCommitHistoryLoading] = useState(false);
  const [commitHistoryError, setCommitHistoryError] = useState<string | null>(null);
  const [selectedCommitOid, setSelectedCommitOid] = useState<string | null>(null);
  const [selectedDiffFilePath, setSelectedDiffFilePath] = useState<string | null>(null);
  const quickStart = useQuickStart();
  const useQuickStartSubmission = quickStart.active && quickStart.isSubmissionRouteMatch(submissionId);
  const previewUrl = getHostDemoPreviewBase();
  const previewFrameUrl = `${previewUrl}?refresh=${previewFrameVersion}`;
  const previewPanelWidth = previewMinimized ? "80px" : `${previewWidth}px`;
  const selectedDiffCommit = useMemo(
    () => commitHistory?.commits.find((commit) => commit.oid === selectedCommitOid) ?? null,
    [commitHistory, selectedCommitOid],
  );
  const selectedNodeCommit = useMemo(
    () => findNewestCommitForNode(commitHistory, selectedNodeId),
    [commitHistory, selectedNodeId],
  );

  const refreshPreview = async () => {
    setPreviewLoading(true);
    try {
      const available = await checkHostDemoPreview(previewUrl);
      setPreviewAvailable(available);
      if (available) {
        setPreviewFrameVersion((current) => current + 1);
      }
    } catch {
      setPreviewAvailable(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    quickStart.syncStepForRoute();
  }, [quickStart, submissionId]);

  useEffect(() => {
    setPreviewAvailable(false);
    setPreviewLoading(true);
    setPreviewFrameVersion(0);
    setPreviewTab("preview");
    setTraceability(null);
    setTraceabilityError(null);
    setSource(null);
    setSourceError(null);
    setCommitHistory(null);
    setCommitHistoryError(null);
    setSelectedCommitOid(null);
    setSelectedDiffFilePath(null);
    visualEventCountRef.current = 0;
  }, [submissionId]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    setLoadErrorStatus(null);
    Promise.all([
      api.getSubmission(submissionId),
      api.getSubmissionLogs(submissionId),
      api.getRequirement(requirementId, requirementCatalog),
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
        pollRef.current = null;
      }
    };
  }, [requirementCatalog, requirementId, submissionId]);

  useEffect(() => {
    if (!submissionId || !submission) {
      setCommitHistory(null);
      setCommitHistoryError(null);
      return;
    }

    let cancelled = false;
    setCommitHistoryLoading(true);
    setCommitHistoryError(null);
    api.getSubmissionCommitHistory(submissionId)
      .then((payload) => {
        if (!cancelled) {
          setCommitHistory(payload);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setCommitHistory(null);
          setCommitHistoryError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommitHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [submission, submissionId]);

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
    if (previewAvailable) {
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
  }, [previewAvailable, previewUrl, submission]);

  const tree = useMemo(() => {
    if (!requirement) {
      return null;
    }
    if (requirement.requirements_yaml?.trim()) {
      try {
        return parseTaskTreeYaml(requirement.requirements_yaml);
      } catch {
        return requirementMarkdownToTree(requirement.requirements_markdown);
      }
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

  const selectedNode = useMemo(() => {
    if (!tree || !selectedNodeId) {
      return null;
    }
    return findNodeById(tree, selectedNodeId);
  }, [selectedNodeId, tree]);

  useEffect(() => {
    if (!useQuickStartSubmission || !quickStart.canvasDemo.active) {
      return;
    }
    setSelectedNodeId(quickStart.canvasDemo.selectedNodeId);
    setDetailExpanded(quickStart.canvasDemo.detailExpanded);
  }, [quickStart.canvasDemo, useQuickStartSubmission]);

  useEffect(() => {
    const events = logs?.visual_events ?? [];
    if (events.length === 0) {
      visualEventCountRef.current = 0;
      return;
    }
    if (events.length <= visualEventCountRef.current) {
      return;
    }
    const newest = events[events.length - 1];
    visualEventCountRef.current = events.length;
    if (useQuickStartSubmission) {
      quickStart.setSelectedNode(newest.node_id);
      quickStart.setDetailExpanded(true);
      setSelectedNodeId(newest.node_id);
      setDetailExpanded(true);
      setFocusNodeId(newest.node_id);
      setPulseNodeId(newest.node_id);
    } else {
      setActiveTab("canvas");
      setSelectedNodeId(newest.node_id);
      setDetailExpanded(true);
      setFocusNodeId(newest.node_id);
      setPulseNodeId(newest.node_id);
    }
    const timer = window.setTimeout(
      () => setPulseNodeId((current) => (current === newest.node_id ? null : current)),
      1400,
    );
    return () => window.clearTimeout(timer);
  }, [logs, useQuickStartSubmission]);

  useEffect(() => {
    if (!selectedNodeCommit) {
      return;
    }
    if (suppressNodeToCommitSyncRef.current) {
      suppressNodeToCommitSyncRef.current = false;
      return;
    }
    setSelectedCommitOid((current) => (current === selectedNodeCommit.oid ? current : selectedNodeCommit.oid));
  }, [selectedNodeCommit]);

  useEffect(() => {
    if (!submissionId || !selectedNodeId || !submission) {
      setTraceability(null);
      setTraceabilityError(null);
      return;
    }

    let cancelled = false;
    setTraceabilityLoading(true);
    setTraceabilityError(null);
    api.getSubmissionTraceability(submissionId, selectedNodeId)
      .then((payload) => {
        if (!cancelled) {
          setTraceability(payload);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setTraceability(null);
          setTraceabilityError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTraceabilityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNodeId, submission, submissionId]);

  const openSource = async ({ filePath, firstLine }: { filePath: string; firstLine?: number | null }) => {
    if (!submissionId) {
      return;
    }
    setSelectedCommitOid(null);
    setActiveTab("file");
    setSourceLoading(true);
    setSourceError(null);
    try {
      const payload = await api.getSubmissionSource(submissionId, { filePath, firstLine, kind: "file" });
      setSource(payload);
    } catch (error) {
      setSource(null);
      setSourceError((error as Error).message);
    } finally {
      setSourceLoading(false);
    }
  };

  const openCommitDiff = async (commit: SubmissionCommitHistoryEntry) => {
    if (!submissionId) {
      return;
    }
    setSelectedCommitOid(commit.oid);
    const firstChangedFile = commit.changed_files[0] ?? null;
    setSelectedDiffFilePath(firstChangedFile?.file_path ?? null);
    setActiveTab("file");
    setSourceLoading(true);
    setSourceError(null);
    try {
      const payload = await api.getSubmissionSource(submissionId, {
        filePath: firstChangedFile?.file_path ?? "",
        kind: "diff",
        commitOid: commit.oid,
      });
      setSource(payload);
    } catch (error) {
      setSource(null);
      setSourceError((error as Error).message);
    } finally {
      setSourceLoading(false);
    }
  };

  const openCommitDiffFile = async (changedFile: SubmissionCommitChangedFile) => {
    if (!submissionId || !selectedDiffCommit) {
      return;
    }
    setSelectedDiffFilePath(changedFile.file_path);
    setSourceLoading(true);
    setSourceError(null);
    try {
      const payload = await api.getSubmissionSource(submissionId, {
        filePath: changedFile.file_path,
        kind: "diff",
        commitOid: selectedDiffCommit.oid,
      });
      setSource(payload);
    } catch (error) {
      setSource(null);
      setSourceError((error as Error).message);
    } finally {
      setSourceLoading(false);
    }
  };

  const selectCommitHistoryEntry = (commit: SubmissionCommitHistoryEntry) => {
    suppressNodeToCommitSyncRef.current = true;
    setSelectedCommitOid(commit.oid);
    if (commit.node_id) {
      setSelectedNodeId(commit.node_id);
      setFocusNodeId(commit.node_id);
      setPulseNodeId(commit.node_id);
      setDetailExpanded(true);
      if (useQuickStartSubmission) {
        quickStart.setSelectedNode(commit.node_id);
        quickStart.setDetailExpanded(true);
      }
    }
  };

  const onSidebarResizeMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    isSidebarDragging.current = true;
    sidebarDragStartX.current = event.clientX;
    sidebarDragStartWidth.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    document.addEventListener("mousemove", onSidebarResizeMouseMove);
    document.addEventListener("mouseup", onSidebarResizeMouseUp);
  };

  const onSidebarResizeMouseMove = (event: MouseEvent) => {
    if (!isSidebarDragging.current) {
      return;
    }
    const delta = event.clientX - sidebarDragStartX.current;
    let nextWidth = sidebarDragStartWidth.current + delta;
    nextWidth = Math.max(260, Math.min(520, nextWidth));
    setSidebarWidth(nextWidth);
  };

  const onSidebarResizeMouseUp = () => {
    isSidebarDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onSidebarResizeMouseMove);
    document.removeEventListener("mouseup", onSidebarResizeMouseUp);
  };

  const clampPreviewWidth = (value: number) => {
    const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
    const maxWidth = Math.min(720, Math.floor(viewportWidth * 0.5));
    return Math.max(320, Math.min(maxWidth, value));
  };

  const onPreviewResizeMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    isPreviewDragging.current = true;
    previewDragStartX.current = event.clientX;
    previewDragStartWidth.current = previewWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    document.addEventListener("mousemove", onPreviewResizeMouseMove);
    document.addEventListener("mouseup", onPreviewResizeMouseUp);
  };

  const onPreviewResizeMouseMove = (event: MouseEvent) => {
    if (!isPreviewDragging.current) {
      return;
    }
    const delta = previewDragStartX.current - event.clientX;
    setPreviewWidth(clampPreviewWidth(previewDragStartWidth.current + delta));
  };

  const onPreviewResizeMouseUp = () => {
    isPreviewDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onPreviewResizeMouseMove);
    document.removeEventListener("mouseup", onPreviewResizeMouseUp);
  };

  useEffect(() => {
    if (activeTab !== "file" || source || sourceLoading || !selectedDiffCommit) {
      return;
    }
    void openCommitDiff(selectedDiffCommit);
  }, [activeTab, selectedDiffCommit, source, sourceLoading]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onSidebarResizeMouseMove);
      document.removeEventListener("mouseup", onSidebarResizeMouseUp);
      document.removeEventListener("mousemove", onPreviewResizeMouseMove);
      document.removeEventListener("mouseup", onPreviewResizeMouseUp);
    };
  }, []);

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
        <section
          className="action-section submission-status-panel playground-submission-sidebar"
          style={{
            width: sidebarMinimized ? "76px" : `${sidebarWidth}px`,
            minWidth: sidebarMinimized ? "76px" : `${sidebarWidth}px`,
            maxWidth: sidebarMinimized ? "76px" : `${sidebarWidth}px`,
            overflow: "hidden",
            transition: "width 0.24s ease, min-width 0.24s ease, max-width 0.24s ease",
          }}
        >
          {!sidebarMinimized ? (
            <>
              <div className="playground-submission-heading">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                  <div>
                    <h1>{submission.display_name || submission.id}</h1>
                    <div className="playground-submission-inline-meta">
                      <span>{submission.id}</span>
                      <span>Duration: {formatDuration(submission.started_at, submission.finished_at)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarMinimized(true)}
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
                      flexShrink: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M11 19L3 12L11 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21 19L13 12L21 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="submission-side-tabs">
                <button
                  type="button"
                  className={`submission-side-tab ${sidebarTab === "status" ? "active" : ""}`}
                  onClick={() => setSidebarTab("status")}
                >
                  STATUS
                </button>
                <button
                  type="button"
                  className={`submission-side-tab ${sidebarTab === "traceability" ? "active" : ""}`}
                  onClick={() => setSidebarTab("traceability")}
                >
                  TRACEABILITY
                </button>
              </div>

              <div className="playground-submission-side-panel-body">
                {sidebarTab === "status" ? (
                  <>
                    <div className="action-section-title">Run Status</div>
                    <SubmissionStepList
                      steps={submission.steps}
                      submissionStatus={submission.status}
                      failureReason={submission.failure_reason}
                    />
                  </>
                ) : (
                  <TraceabilityPanel
                    traceability={traceability}
                    nodeId={selectedNode?.id ?? selectedNodeId}
                    nodeName={selectedNode?.name ?? null}
                    loading={traceabilityLoading}
                    error={traceabilityError}
                    onOpenSource={openSource}
                  />
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarMinimized(false)}
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                color: "var(--text-dim)",
                cursor: "pointer",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M13 5L21 12L13 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 5L11 12L3 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  writingMode: "vertical-rl",
                  textOrientation: "upright",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {sidebarTab === "status" ? "Status" : "Trace"}
              </span>
            </button>
          )}
        </section>

        {!sidebarMinimized ? (
          <div
            onMouseDown={onSidebarResizeMouseDown}
            style={{
              width: "14px",
              cursor: "col-resize",
              background: "#f8fafc",
              borderLeft: "1px solid #e2e8f0",
              borderRight: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "6px",
              flexShrink: 0,
            }}
          >
            <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#cbd5e1" }} />
            <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#cbd5e1" }} />
            <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#cbd5e1" }} />
          </div>
        ) : null}

        <main style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: "1px solid var(--border)",
          background: "var(--bg)",
          minWidth: 0,
        }}>
          <div className="doc-tabs" style={{ borderBottom: "1px solid var(--border)", padding: "0 16px" }}>
            {[
              { key: "canvas", label: "Canvas" },
              { key: "file", label: "File" },
              { key: "results", label: "Test Result" },
              { key: "stdio", label: "Stdout/Stderror" },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`doc-tab${activeTab === tab.key ? " active" : ""}`}
                type="button"
                onClick={() => setActiveTab(tab.key as "canvas" | "results" | "stdio" | "file")}
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
                    focusNodeId={useQuickStartSubmission ? (quickStart.canvasDemo.currentNodeId ?? focusNodeId) : focusNodeId}
                    pulseNodeId={useQuickStartSubmission ? (quickStart.canvasDemo.currentNodeId ?? pulseNodeId) : pulseNodeId}
                    showLegend
                    detailTestId="quickstart-submission-node-detail"
                  />
                </div>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
                  Canvas is not available.
                </div>
              )
            ) : activeTab === "file" ? (
              <SubmissionFilePanel
                source={source}
                loading={sourceLoading}
                error={sourceError}
                diffCommit={selectedDiffCommit}
                diffFiles={selectedDiffCommit?.changed_files ?? []}
                selectedDiffFilePath={selectedDiffFilePath}
                onOpenDiffFile={openCommitDiffFile}
              />
            ) : activeTab === "results" ? (
              <div style={{ padding: "24px", flex: 1, overflow: "auto" }}>
                <SubmissionResultCard submission={submission} />
              </div>
            ) : (
              <div className="stdio-view">
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
                <pre className="stdio-code-view">
                  {stdioTab === "stdout" ? (logs?.stdout || "No stdout yet.") : (logs?.stderr || "No stderr yet.")}
                </pre>
              </div>
            )}
          </div>
        </main>

        {!previewMinimized ? (
          <div
            className="preview-panel-resizer"
            onMouseDown={onPreviewResizeMouseDown}
            aria-label="Resize right sidebar"
          >
            <div className="preview-panel-resizer-handle" />
          </div>
        ) : null}

        <aside className="preview-panel-shell" style={{
          width: previewPanelWidth,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-4px 0 24px color-mix(in srgb, var(--bg-deep) 16%, transparent)",
          transition: "width 0.24s ease",
          flexShrink: 0,
        }}>
          <div className="preview-panel-header">
            {!previewMinimized ? (
              <>
                <div className="preview-panel-tabs">
                  <button
                    type="button"
                    className={`preview-panel-tab ${previewTab === "preview" ? "active" : ""}`}
                    onClick={() => setPreviewTab("preview")}
                  >
                    Live Preview
                  </button>
                  <button
                    type="button"
                    className={`preview-panel-tab ${previewTab === "history" ? "active" : ""}`}
                    onClick={() => setPreviewTab("history")}
                  >
                    Commit History
                  </button>
                </div>
                <div className="preview-panel-actions">
                  {previewTab === "preview" ? (
                    <>
                      <button
                        type="button"
                        className="preview-panel-action"
                        onClick={() => {
                          void refreshPreview();
                        }}
                      >
                        {previewAvailable ? "Refresh" : "Retry"}
                      </button>
                      {submission && previewAvailable ? (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="preview-panel-link"
                        >
                          Open
                        </a>
                      ) : null}
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="preview-panel-collapse"
                    onClick={() => setPreviewMinimized(true)}
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
                className="preview-panel-minimized-toggle"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M13 5L21 12L13 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 5L11 12L3 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="preview-panel-minimized-label">{previewTab === "history" ? "History" : "Preview"}</span>
              </button>
            )}
          </div>

          {!previewMinimized ? (
            <div className="preview-panel-body">
              {previewTab === "preview" ? (
                previewLoading ? (
                  <div className="preview-panel-empty">Loading preview...</div>
                ) : submission && previewAvailable ? (
                  <iframe
                    key={`${submissionId}-${previewFrameVersion}`}
                    src={previewFrameUrl}
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
                  <div className="preview-panel-empty">
                    <div>
                      <div className="preview-panel-empty-title">
                        {submission ? "Preview not available yet" : "No submission selected"}
                      </div>
                      <div className="preview-panel-empty-copy">
                        {submission
                          ? "Waiting for host demo backend to build and start."
                          : "Select a submission to view its preview"}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <CommitHistoryPanel
                  commits={commitHistory}
                  loading={commitHistoryLoading}
                  error={commitHistoryError}
                  selectedNodeId={selectedNodeId}
                  selectedCommitOid={selectedCommitOid}
                  onSelectCommit={selectCommitHistoryEntry}
                  onOpenDiff={openCommitDiff}
                />
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
