import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import RequirementTreeCanvas from "../components/requirements/RequirementTreeCanvas";
import RequirementNodeDetailContent from "../components/requirements/RequirementNodeDetailContent";
import SubmissionResultCard from "../components/submissions/SubmissionResultCard";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { ApiError, api } from "../lib/api";
import {
  cloneRequirementTree,
  findNodeById,
  parseTaskTreeYaml,
  requirementMarkdownToTree,
  taskTreeToMarkdown,
  taskTreeToYaml,
  updateNodeInTree,
  type RequirementNode,
} from "../lib/taskTree";
import type {
  RequirementDetail,
  RequirementVisualState,
  SubmissionCommitChangedFile,
  SubmissionCommitHistoryEntry,
  SubmissionCommitHistoryPayload,
  SubmissionDetail,
  SubmissionLogs,
  SubmissionPreviewStatus,
  SubmissionSourcePayload,
  SubmissionTraceabilityPayload,
  SubmissionVisualEvent,
  SubmissionEditableTaskPayload,
  SubmissionTaskAssets,
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

function commitPhaseToVisualState(phase: SubmissionCommitHistoryEntry["phase"]): RequirementVisualState {
  if (phase === "design") {
    return "design";
  }
  if (phase === "implement") {
    return "implement";
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

function PanelChevronIcon({
  direction,
  size = 16,
}: {
  direction: "left" | "right";
  size?: number;
}) {
  const transform = direction === "right" ? "translate(24 0) scale(-1 1)" : undefined;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform={transform}>
        <path d="M11 19L3 12L11 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 19L13 12L21 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function isSubmissionLive(status: string | null | undefined) {
  return status ? ["PENDING", "RUNNING", "PAUSE_REQUESTED", "PAUSED"].includes(status) : false;
}

function isCommitHistoryStreaming(status: string | null | undefined) {
  return status ? ["PENDING", "RUNNING", "PAUSE_REQUESTED"].includes(status) : false;
}

function countRequirementNodes(node: RequirementNode): number {
  return 1 + node.children.reduce((count, child) => count + countRequirementNodes(child), 0);
}

function resolveEditableTree(
  payload: SubmissionEditableTaskPayload,
  fallbackTree: RequirementNode | null,
): RequirementNode | null {
  const candidates: RequirementNode[] = [];

  if (payload.requirements_yaml.trim()) {
    try {
      candidates.push(parseTaskTreeYaml(payload.requirements_yaml));
    } catch {
      // Fall back to markdown parsing below.
    }
  }

  if (payload.requirements_md.trim()) {
    try {
      candidates.push(requirementMarkdownToTree(payload.requirements_md));
    } catch {
      // Fall back to the current canvas tree below.
    }
  }

  if (candidates.length === 0) {
    return fallbackTree ? cloneRequirementTree(fallbackTree) : null;
  }

  return candidates.reduce((best, candidate) =>
    countRequirementNodes(candidate) > countRequirementNodes(best) ? candidate : best,
  );
}

function resolveRequirementCatalogTree(requirement: RequirementDetail | null): RequirementNode | null {
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
  selectedItemId,
  selectedItemKind,
  onSelectItem,
  onOpenSource,
}: {
  traceability: SubmissionTraceabilityPayload | null;
  nodeId: string | null;
  nodeName: string | null;
  loading: boolean;
  error: string | null;
  selectedItemId: string | null;
  selectedItemKind: "interface" | "test" | null;
  onSelectItem: (kind: "interface" | "test", id: string) => void;
  onOpenSource: (payload: { filePath: string; firstLine?: number | null }) => void;
}) {
  const selectedCardRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const item = selectedCardRef.current;
    const panel = panelRef.current;
    if (!item || !panel) {
      return;
    }
    const itemRect = item.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    if (itemRect.top < panelRect.top) {
      panel.scrollTop -= panelRect.top - itemRect.top;
    } else if (itemRect.bottom > panelRect.bottom) {
      panel.scrollTop += itemRect.bottom - panelRect.bottom;
    }
  }, [selectedItemId, selectedItemKind, traceability]);

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
    <div className="traceability-panel" ref={panelRef}>
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
          {traceability.interfaces.map((item) => {
            const isCardSelected = selectedItemKind === "interface" && selectedItemId === item.interface_id;
            return (
            <article
              key={item.interface_id}
              ref={isCardSelected ? selectedCardRef : null}
              className={`traceability-card${isCardSelected ? " selected" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelectItem("interface", item.interface_id);
                onOpenSource({ filePath: item.file_path, firstLine: item.first_line });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectItem("interface", item.interface_id);
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
            );
          })}
        </div>
      </section>

      <section className="traceability-section">
        <div className="traceability-section-head">
          <h3>Tests</h3>
          <span>{traceability.tests.length}</span>
        </div>
        <div className="traceability-card-list">
          {traceability.tests.map((item) => {
            const isCardSelected = selectedItemKind === "test" && selectedItemId === item.test_id;
            return (
            <article
              key={item.test_id}
              ref={isCardSelected ? selectedCardRef : null}
              className={`traceability-card${isCardSelected ? " selected" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelectItem("test", item.test_id);
                onOpenSource({ filePath: item.file_path, firstLine: item.first_line });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectItem("test", item.test_id);
                  onOpenSource({ filePath: item.file_path, firstLine: item.first_line });
                }
              }}
            >
              <div className="traceability-card-top">
                <div>
                  <div className="traceability-card-id">{item.test_id}</div>
                  <div className="traceability-card-path">{item.file_path}:{formatLineNumber(item.first_line)}</div>
                </div>
                <div className="traceability-chip-row">
                  <span className={`traceability-chip type-${item.type.toLowerCase()}`}>{item.type}</span>
                  {item.status ? (
                    <span className={`traceability-chip ${item.status === "passed" ? "implemented" : "failed-status"}`}>
                      {item.status === "passed" ? "Passed" : "Failed"}
                    </span>
                  ) : null}
                </div>
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
            );
          })}
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
  emptyMessage,
}: {
  source: SubmissionSourcePayload | null;
  loading: boolean;
  error: string | null;
  diffCommit: SubmissionCommitHistoryEntry | null;
  diffFiles: SubmissionCommitChangedFile[];
  selectedDiffFilePath: string | null;
  onOpenDiffFile: (changedFile: SubmissionCommitChangedFile) => void;
  emptyMessage: string;
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
    return <div className="ide-empty-state">{emptyMessage}</div>;
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
                <PanelChevronIcon direction="left" size={14} />
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
        ) : (
          <button
            type="button"
            className="ide-sidebar-minimized-toggle"
            onClick={() => setWorkspaceCollapsed(false)}
            aria-label="Expand workspace"
            title="Expand workspace"
          >
            <PanelChevronIcon direction="right" size={20} />
          </button>
        )}

        <section className="ide-editor">
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
              <PanelChevronIcon direction="left" size={14} />
            </button>
          </div>
          <div className="ide-file-list">
            <div className="ide-file-item active">
              <span className="ide-file-kind kind-file">{source.language.toUpperCase()}</span>
              <span className="ide-file-path">{source.file_path}</span>
            </div>
          </div>
        </aside>
      ) : (
        <button
          type="button"
          className="ide-sidebar-minimized-toggle"
          onClick={() => setWorkspaceCollapsed(false)}
          aria-label="Expand workspace"
          title="Expand workspace"
        >
          <PanelChevronIcon direction="right" size={20} />
        </button>
      )}

      <section className="ide-editor">
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
  onRewind,
}: {
  commits: SubmissionCommitHistoryPayload | null;
  loading: boolean;
  error: string | null;
  selectedNodeId: string | null;
  selectedCommitOid: string | null;
  onSelectCommit: (commit: SubmissionCommitHistoryEntry) => void;
  onOpenDiff: (commit: SubmissionCommitHistoryEntry) => void;
  onRewind?: (commit: SubmissionCommitHistoryEntry) => void;
}) {
  const [menuState, setMenuState] = useState<{ commit: SubmissionCommitHistoryEntry; x: number; y: number } | null>(null);
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const orderedCommits = useMemo(() => [...(commits?.commits ?? [])].reverse(), [commits]);

  useEffect(() => {
    if (!menuState) {
      return;
    }
    const closeMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return;
      }
      setMenuState(null);
    };
    window.addEventListener("pointerdown", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
    };
  }, [menuState]);

  useEffect(() => {
    if (!selectedItemRef.current) {
      return;
    }
    const parent = selectedItemRef.current.parentElement;
    if (!parent) {
      return;
    }
    const item = selectedItemRef.current;
    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const viewTop = parent.scrollTop;
    const viewBottom = viewTop + parent.clientHeight;
    if (itemTop < viewTop) {
      parent.scrollTop = itemTop;
    } else if (itemBottom > viewBottom) {
      parent.scrollTop = itemBottom - parent.clientHeight;
    }
  }, [selectedCommitOid, orderedCommits]);

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
                event.stopPropagation();
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
          ref={menuRef}
          className="commit-history-context-menu"
          style={{ left: `${menuState.x}px`, top: `${menuState.y}px` }}
          role="menu"
        >
          {onRewind && menuState.commit.node_id && menuState.commit.phase ? (
            <button
              type="button"
              className="commit-history-context-action"
              onClick={() => {
                const confirmed = window.confirm(
                  `Rewind this submission to commit ${menuState.commit.short_oid}? Execution will pause and later commits in the workspace history will be discarded.`,
                );
                if (!confirmed) {
                  setMenuState(null);
                  return;
                }
                onRewind(menuState.commit);
                setMenuState(null);
              }}
            >
              Rewind to This Commit
            </button>
          ) : null}
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
  const commitHistoryPollRef = useRef<number | null>(null);
  const visualEventCountRef = useRef(0);
  const isSidebarDragging = useRef(false);
  const sidebarDragStartX = useRef(0);
  const sidebarDragStartWidth = useRef(0);
  const isPreviewDragging = useRef(false);
  const previewDragStartX = useRef(0);
  const previewDragStartWidth = useRef(0);
  const previewPollRef = useRef<number | null>(null);
  const suppressNodeToCommitSyncRef = useRef(false);
  const editableTreeDirtyRef = useRef(false);
  const [previewStatus, setPreviewStatus] = useState<SubmissionPreviewStatus | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewFrameVersion, setPreviewFrameVersion] = useState(0);
  const [previewTab, setPreviewTab] = useState<"preview" | "history">("preview");
  const [traceability, setTraceability] = useState<SubmissionTraceabilityPayload | null>(null);
  const [allTraceability, setAllTraceability] = useState<SubmissionTraceabilityPayload | null>(null);
  const [traceabilityLoading, setTraceabilityLoading] = useState(false);
  const [traceabilityError, setTraceabilityError] = useState<string | null>(null);
  const [traceabilityNodeId, setTraceabilityNodeId] = useState<string | null>(null);
  const [selectedTraceabilityId, setSelectedTraceabilityId] = useState<string | null>(null);
  const [selectedTraceabilityKind, setSelectedTraceabilityKind] = useState<"interface" | "test" | null>(null);
  const [source, setSource] = useState<SubmissionSourcePayload | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [fileViewMode, setFileViewMode] = useState<"traceability" | "diff" | null>(null);
  const [commitHistory, setCommitHistory] = useState<SubmissionCommitHistoryPayload | null>(null);
  const [commitHistoryLoading, setCommitHistoryLoading] = useState(false);
  const [commitHistoryError, setCommitHistoryError] = useState<string | null>(null);
  const [selectedCommitOid, setSelectedCommitOid] = useState<string | null>(null);
  const [selectedDiffFilePath, setSelectedDiffFilePath] = useState<string | null>(null);
  const [editableTask, setEditableTask] = useState<SubmissionEditableTaskPayload | null>(null);
  const [editableTree, setEditableTree] = useState<RequirementNode | null>(null);
  const [submissionTaskAssets, setSubmissionTaskAssets] = useState<SubmissionTaskAssets | null>(null);
  const [editableNodeId, setEditableNodeId] = useState<string | null>("ROOT");
  const [editableDetailExpanded, setEditableDetailExpanded] = useState(true);
  const [savingEditableTask, setSavingEditableTask] = useState(false);
  const [editableReloadToken, setEditableReloadToken] = useState(0);
  const executionPaused = submission?.status === "PAUSED";
  const executionPausePending = submission?.status === "PAUSE_REQUESTED";
  const quickStart = useQuickStart();
  const useQuickStartSubmission = quickStart.active && quickStart.isSubmissionRouteMatch(submissionId);
  const activeSelectedNodeId = useQuickStartSubmission && quickStart.canvasDemo.selectedNodeId !== null
    ? quickStart.canvasDemo.selectedNodeId
    : selectedNodeId;
  const previewUrl = api.getSubmissionPreviewUrl(submissionId);
  const previewFrameUrl = `${previewUrl}?refresh=${previewFrameVersion}`;
  const previewAvailable = previewStatus?.available ?? false;
  const previewPanelWidth = previewMinimized ? "80px" : `${previewWidth}px`;
  const selectedDiffCommit = useMemo(
    () => commitHistory?.commits.find((commit) => commit.oid === selectedCommitOid) ?? null,
    [commitHistory, selectedCommitOid],
  );
  const selectedNodeCommit = useMemo(
    () => findNewestCommitForNode(commitHistory, activeSelectedNodeId),
    [activeSelectedNodeId, commitHistory],
  );
  const editableSelectedNode = useMemo(() => {
    if (!editableTree || !editableNodeId) {
      return null;
    }
    return findNodeById(editableTree, editableNodeId);
  }, [editableNodeId, editableTree]);
  const filePanelEmptyMessage = fileViewMode === "diff"
    ? "Select a commit history entry to inspect its diff."
    : "Select an interface or test to inspect source.";
  const visibleTraceability = traceabilityNodeId === activeSelectedNodeId ? traceability : null;
  const visibleTraceabilityError = traceabilityNodeId === activeSelectedNodeId ? traceabilityError : null;
  const submissionStatus = submission?.status ?? null;
  const shouldPollSubmission = isSubmissionLive(submissionStatus);

  const toPreviewErrorStatus = (error: Error): SubmissionPreviewStatus => ({
    available: false,
    stale: false,
    workspace_head_oid: null,
    preview_head_oid: null,
    error: error.message,
  });

  const loadPreviewStatus = async (silent = false) => {
    if (!silent) {
      setPreviewLoading(true);
    }
    try {
      const status = await api.getSubmissionPreviewStatus(submissionId);
      setPreviewStatus(status);
    } catch (error) {
      if (!silent) {
        setPreviewStatus(toPreviewErrorStatus(error as Error));
      }
    } finally {
      if (!silent) {
        setPreviewLoading(false);
      }
    }
  };

  const refreshPreview = async () => {
    setPreviewLoading(true);
    try {
      const status = await api.refreshSubmissionPreview(submissionId);
      setPreviewStatus(status);
      if (status.available) {
        setPreviewFrameVersion((current) => current + 1);
      }
    } catch (error) {
      setPreviewStatus(toPreviewErrorStatus(error as Error));
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    quickStart.syncStepForRoute();
  }, [quickStart, submissionId]);

  useEffect(() => {
    setPreviewStatus(null);
    setPreviewLoading(true);
    setPreviewFrameVersion(0);
    setPreviewTab("preview");
    setTraceability(null);
    setTraceabilityError(null);
    setTraceabilityNodeId(null);
    setSelectedTraceabilityId(null);
    setSelectedTraceabilityKind(null);
    setAllTraceability(null);
    setSource(null);
    setSourceError(null);
    setFileViewMode(null);
    setCommitHistory(null);
    setCommitHistoryError(null);
    setSelectedCommitOid(null);
    setSelectedDiffFilePath(null);
    setSubmissionTaskAssets(submissionId ? api.getSubmissionTaskAssets(submissionId) : null);
    visualEventCountRef.current = 0;
    if (commitHistoryPollRef.current) {
      window.clearInterval(commitHistoryPollRef.current);
      commitHistoryPollRef.current = null;
    }
    if (previewPollRef.current) {
      window.clearInterval(previewPollRef.current);
      previewPollRef.current = null;
    }
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
      if (commitHistoryPollRef.current) {
        window.clearInterval(commitHistoryPollRef.current);
        commitHistoryPollRef.current = null;
      }
      if (previewPollRef.current) {
        window.clearInterval(previewPollRef.current);
        previewPollRef.current = null;
      }
    };
  }, [requirementCatalog, requirementId, submissionId]);

  useEffect(() => {
    if (!submissionId || !submission) {
      return;
    }
    if (!shouldPollSubmission) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    const refreshRuntimeState = () => {
      api.getSubmission(submissionId).then((latest) => {
        setSubmission(latest);
        if (!isSubmissionLive(latest.status) && pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }).catch(() => undefined);
      api.getSubmissionLogs(submissionId).then(setLogs).catch(() => undefined);
    };
    refreshRuntimeState();
    if (!pollRef.current) {
      pollRef.current = window.setInterval(refreshRuntimeState, 2000);
    }
    return () => {
      if (pollRef.current && !shouldPollSubmission) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [shouldPollSubmission, submissionId, submissionStatus]);

  useEffect(() => {
    if (!submissionId || !submission) {
      setCommitHistory(null);
      setCommitHistoryError(null);
      return;
    }

    let cancelled = false;
    const isInitial = commitHistory === null;
    if (isInitial) {
      setCommitHistoryLoading(true);
    }
    setCommitHistoryError(null);
    api.getSubmissionCommitHistory(submissionId)
      .then((payload) => {
        if (!cancelled) {
          setCommitHistory(payload);
        }
      })
      .catch((error: Error) => {
        if (!cancelled && isInitial) {
          setCommitHistory(null);
          setCommitHistoryError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled && isInitial) {
          setCommitHistoryLoading(false);
        }
      });

    if (isCommitHistoryStreaming(submission.status) && !commitHistoryPollRef.current) {
      commitHistoryPollRef.current = window.setInterval(() => {
        api.getSubmissionCommitHistory(submissionId)
          .then(setCommitHistory)
          .catch(() => undefined);
      }, 2000);
    }
    if (!isCommitHistoryStreaming(submission.status) && commitHistoryPollRef.current) {
      window.clearInterval(commitHistoryPollRef.current);
      commitHistoryPollRef.current = null;
    }

    return () => {
      cancelled = true;
    };
  }, [submission, submissionId]);

  useEffect(() => {
    if (!submission || !pollRef.current) {
      return;
    }
    if (!isSubmissionLive(submission.status)) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [submission]);

  useEffect(() => {
    if (!submission) {
      setPreviewStatus(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    void loadPreviewStatus(previewStatus !== null);

    if (isSubmissionLive(submission.status) && !previewPollRef.current) {
      previewPollRef.current = window.setInterval(() => {
        if (cancelled) {
          return;
        }
        void loadPreviewStatus(true);
      }, 5000);
    }
    if (!isSubmissionLive(submission.status) && previewPollRef.current) {
      window.clearInterval(previewPollRef.current);
      previewPollRef.current = null;
    }

    return () => {
      cancelled = true;
      if (previewPollRef.current && !isSubmissionLive(submission.status)) {
        window.clearInterval(previewPollRef.current);
        previewPollRef.current = null;
      }
    };
  }, [submissionId, submission?.status]);

  const catalogTree = useMemo(() => resolveRequirementCatalogTree(requirement), [requirement]);

  const tree = useMemo(() => {
    if (editableTask) {
      return resolveEditableTree(editableTask, catalogTree);
    }
    return catalogTree;
  }, [catalogTree, editableTask]);

  const nodeStates = useMemo(() => {
    const nextState: Record<string, RequirementVisualState> = {};
    for (const commit of commitHistory?.commits ?? []) {
      if (!commit.node_id || !commit.phase) {
        continue;
      }
      nextState[commit.node_id] = commitPhaseToVisualState(commit.phase);
    }
    for (const event of logs?.visual_events ?? []) {
      nextState[event.node_id] = toVisualState(event);
    }
    return nextState;
  }, [commitHistory, logs]);

  const selectedNode = useMemo(() => {
    if (!tree || !activeSelectedNodeId) {
      return null;
    }
    return findNodeById(tree, activeSelectedNodeId);
  }, [activeSelectedNodeId, tree]);

  useEffect(() => {
    if (!submissionId || !submission) {
      editableTreeDirtyRef.current = false;
      setEditableTask(null);
      setEditableTree(null);
      return;
    }

    if (submission.status !== "PAUSED") {
      setEditableTree(null);
    }

    let cancelled = false;
    api.getSubmissionEditableTask(submissionId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setEditableTask(payload);
        if (submission.status !== "PAUSED" || editableTreeDirtyRef.current) {
          return;
        }
        const nextEditableTree = resolveEditableTree(payload, catalogTree);
        if (!nextEditableTree) {
          return;
        }
        setEditableTree(nextEditableTree);
        setEditableNodeId((current) => {
          const preferredNodeId = current ?? activeSelectedNodeId ?? "ROOT";
          return findNodeById(nextEditableTree, preferredNodeId) ? preferredNodeId : "ROOT";
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    activeSelectedNodeId,
    catalogTree,
    detailExpanded,
    editableReloadToken,
    quickStart.canvasDemo.detailExpanded,
    submission,
    submission?.status,
    submissionId,
    useQuickStartSubmission,
  ]);

  const editableModeActive = executionPaused;
  const pausedCanvasTree = editableModeActive ? (editableTree ?? tree) : tree;
  const pausedCanvasSelectedNodeId = editableModeActive ? editableNodeId : activeSelectedNodeId;
  const pausedCanvasSelectedNode = editableModeActive ? (editableSelectedNode ?? selectedNode) : selectedNode;

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
    if (events.length < visualEventCountRef.current) {
      visualEventCountRef.current = events.length;
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
    if (!submissionId || !activeSelectedNodeId || !submission) {
      setTraceability(null);
      setTraceabilityError(null);
      setTraceabilityNodeId(null);
      return;
    }

    let cancelled = false;
    const isNodeChange = traceabilityNodeId !== activeSelectedNodeId;
    if (isNodeChange) {
      setTraceability(null);
      setTraceabilityLoading(true);
    }
    setTraceabilityError(null);
    setTraceabilityNodeId(activeSelectedNodeId);
    api.getSubmissionTraceability(submissionId, activeSelectedNodeId)
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
        if (!cancelled && isNodeChange) {
          setTraceabilityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSelectedNodeId, submission, submissionId]);

  useEffect(() => {
    if (!submissionId || !submission) {
      setAllTraceability(null);
      return;
    }
    let cancelled = false;
    api.getSubmissionAllTraceability(submissionId)
      .then((payload) => {
        if (!cancelled) {
          setAllTraceability(payload);
        }
      })
      .catch(() => undefined);
    if (isCommitHistoryStreaming(submission.status)) {
      const interval = window.setInterval(() => {
        api.getSubmissionAllTraceability(submissionId)
          .then((payload) => {
            if (!cancelled) {
              setAllTraceability(payload);
            }
          })
          .catch(() => undefined);
      }, 2000);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [submission, submissionId]);
  const openSource = async ({ filePath, firstLine }: { filePath: string; firstLine?: number | null }) => {
    if (!submissionId) {
      return;
    }
    setSelectedCommitOid(null);
    setFileViewMode("traceability");
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
    setFileViewMode("diff");
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
    setFileViewMode("diff");
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
    if (activeTab === "file") {
      void openCommitDiff(commit);
    }
  };

  const handlePause = async () => {
    if (!submissionId) {
      return;
    }
    editableTreeDirtyRef.current = false;
    setSubmission(await api.pauseSubmission(submissionId));
  };

  const persistEditableTask = async () => {
    if (!submissionId || !editableTree || !editableTask) {
      return null;
    }
    const requirementsYaml = taskTreeToYaml(editableTree);
    const requirementsMd = taskTreeToMarkdown(editableTree);
    const editedNodeId = editableNodeId ?? activeSelectedNodeId ?? "ROOT";
    await api.updateSubmissionEditableTask(submissionId, {
      requirements_md: requirementsMd,
      requirements_yaml: requirementsYaml,
      prerequisites_md: editableTask.prerequisites_md,
      edited_node_id: editedNodeId,
    });
    editableTreeDirtyRef.current = false;
    setEditableTask((current) => current ? {
      ...current,
      requirements_md: requirementsMd,
      requirements_yaml: requirementsYaml,
      edited_node_id: editedNodeId,
    } : current);
    return { requirementsYaml, requirementsMd, editedNodeId };
  };

  const handleResume = async () => {
    if (!submissionId) {
      return;
    }
    if (submission?.status === "PAUSED" && editableTreeDirtyRef.current) {
      setSavingEditableTask(true);
      try {
        await persistEditableTask();
      } finally {
        setSavingEditableTask(false);
      }
    }
    const nextSubmission = await api.resumeSubmission(submissionId);
    setSubmission(nextSubmission);
    if (nextSubmission.status !== "PAUSED") {
      editableTreeDirtyRef.current = false;
      setEditableTree(null);
      setEditableNodeId("ROOT");
      setEditableDetailExpanded(true);
    }
  };

  const handleRewind = async (commit: SubmissionCommitHistoryEntry) => {
    if (!submissionId) {
      return;
    }
    const nextSubmission = await api.rewindSubmission(submissionId, { commit_oid: commit.oid });
    const targetNodeId = commit.node_id ?? "ROOT";
    const [nextLogs, nextCommitHistory, nextTraceability, nextAllTraceability] = await Promise.all([
      api.getSubmissionLogs(submissionId),
      api.getSubmissionCommitHistory(submissionId),
      api.getSubmissionTraceability(submissionId, targetNodeId).catch(() => null),
      api.getSubmissionAllTraceability(submissionId).catch(() => null),
    ]);
    editableTreeDirtyRef.current = false;
    visualEventCountRef.current = 0;
    setSubmission(nextSubmission);
    setLogs(nextLogs);
    setCommitHistory(nextCommitHistory);
    setTraceability(nextTraceability);
    setTraceabilityError(null);
    setTraceabilityNodeId(targetNodeId);
    setAllTraceability(nextAllTraceability);
    setEditableTask(null);
    setEditableTree(null);
    setActiveTab("canvas");
    setSelectedCommitOid(commit.oid);
    setSelectedNodeId(targetNodeId);
    setEditableNodeId(targetNodeId);
    setDetailExpanded(true);
    setEditableDetailExpanded(true);
    setEditableReloadToken((current) => current + 1);
    setFocusNodeId(targetNodeId);
    setPulseNodeId(null);
    if (useQuickStartSubmission) {
      quickStart.setSelectedNode(targetNodeId);
      quickStart.setDetailExpanded(true);
    }
  };

  const handleSaveFix = async () => {
    if (!submissionId || !editableTree || !editableTask) {
      return;
    }
    setSavingEditableTask(true);
    try {
      await persistEditableTask();
      const [nextTraceability, nextAllTraceability] = await Promise.all([
        activeSelectedNodeId ? api.getSubmissionTraceability(submissionId, activeSelectedNodeId).catch(() => null) : Promise.resolve(null),
        api.getSubmissionAllTraceability(submissionId).catch(() => null),
      ]);
      if (nextTraceability) {
        setTraceability(nextTraceability);
        setTraceabilityError(null);
      }
      if (nextAllTraceability) {
        setAllTraceability(nextAllTraceability);
      }
    } finally {
      setSavingEditableTask(false);
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
                    aria-label="Collapse left sidebar"
                    title="Collapse left sidebar"
                  >
                    <PanelChevronIcon direction="left" size={14} />
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

              <div className={`submission-side-actions ${submission.status === "RUNNING" || executionPausePending ? "single" : ""}`}>
                {submission.status === "RUNNING" ? (
                  <button type="button" className="btn-outline" onClick={() => void handlePause()}>
                    Pause
                  </button>
                ) : null}
                {executionPausePending ? (
                  <button type="button" className="btn-outline" disabled>
                    Pausing...
                  </button>
                ) : null}
                {submission.status === "PAUSED" ? (
                  <>
                    <button type="button" className="btn-outline" onClick={() => void handleResume()}>
                      Resume
                    </button>
                    <button type="button" className="btn-primary" onClick={() => void handleSaveFix()} disabled={savingEditableTask}>
                      Save Fix
                    </button>
                  </>
                ) : null}
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
                    traceability={visibleTraceability}
                    nodeId={selectedNode?.id ?? activeSelectedNodeId}
                    nodeName={selectedNode?.name ?? null}
                    loading={traceabilityLoading}
                    error={visibleTraceabilityError}
                    selectedItemId={selectedTraceabilityId}
                    selectedItemKind={selectedTraceabilityKind}
                    onSelectItem={(kind, id) => {
                      setSelectedTraceabilityKind(kind);
                      setSelectedTraceabilityId(id);
                    }}
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
              aria-label="Expand left sidebar"
              title="Expand left sidebar"
            >
              <PanelChevronIcon direction="right" size={20} />
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
            {tree ? (
              <div
                data-quickstart-id="quickstart-submission-canvas"
                style={{
                  flex: 1,
                  position: "relative",
                  overflow: "hidden",
                  display: activeTab === "canvas" ? "block" : "none",
                }}
              >
                <RequirementTreeCanvas
                  tree={pausedCanvasTree ?? tree}
                  selectedNodeId={pausedCanvasSelectedNodeId}
                  onSelectNode={(nodeId) => {
                    if (submission?.status === "PAUSED") {
                      setEditableNodeId(nodeId);
                      setEditableDetailExpanded(Boolean(nodeId));
                    } else {
                      setSelectedNodeId(nodeId);
                      setDetailExpanded(Boolean(nodeId));
                      if (useQuickStartSubmission) {
                        quickStart.setSelectedNode(nodeId);
                        quickStart.setDetailExpanded(Boolean(nodeId));
                      }
                    }
                  }}
                  detailExpanded={submission?.status === "PAUSED"
                    ? editableDetailExpanded
                    : (useQuickStartSubmission ? quickStart.canvasDemo.detailExpanded : detailExpanded)}
                  onDetailExpandedChange={(expanded) => {
                    if (submission?.status === "PAUSED") {
                      setEditableDetailExpanded(expanded);
                    } else {
                      setDetailExpanded(expanded);
                      if (useQuickStartSubmission) {
                        quickStart.setDetailExpanded(expanded);
                      }
                    }
                  }}
                  mode={submission?.status === "PAUSED" ? "editable" : "readonly"}
                  detailPlacement="bottom"
                  nodeStates={nodeStates}
                  focusNodeId={submission?.status === "PAUSED"
                    ? (editableNodeId ?? focusNodeId)
                    : (useQuickStartSubmission ? (quickStart.canvasDemo.currentNodeId ?? focusNodeId) : focusNodeId)}
                  pulseNodeId={submission?.status === "PAUSED"
                    ? (editableNodeId ?? pulseNodeId)
                    : (useQuickStartSubmission ? (quickStart.canvasDemo.currentNodeId ?? pulseNodeId) : pulseNodeId)}
                  showLegend
                  detailTestId="quickstart-submission-node-detail"
                  autoFitOnTreeChange={false}
                  traceabilityNodes={visibleTraceability}
                  allTraceability={allTraceability}
                  selectedTraceabilityId={selectedTraceabilityId}
                  selectedTraceabilityKind={selectedTraceabilityKind}
                  onTraceabilityNodeClick={({ kind, id, requirementNodeId }) => {
                    const targetNodeId = requirementNodeId ?? activeSelectedNodeId;
                    if (targetNodeId) {
                      setSelectedNodeId(targetNodeId);
                      setDetailExpanded(true);
                      setFocusNodeId(targetNodeId);
                      if (submission?.status === "PAUSED") {
                        setEditableNodeId(targetNodeId);
                        setEditableDetailExpanded(true);
                      }
                      if (useQuickStartSubmission) {
                        quickStart.setSelectedNode(targetNodeId);
                        quickStart.setDetailExpanded(true);
                      }
                    }
                    setSelectedTraceabilityKind(kind);
                    setSelectedTraceabilityId(id);
                    setSidebarTab("traceability");
                  }}
                  renderDetailContent={submission?.status === "PAUSED" ? (node) => (
                    <RequirementNodeDetailContent
                      node={node}
                      mode="editable"
                      taskAssets={submissionTaskAssets}
                      onNodeChange={(updater) => {
                        editableTreeDirtyRef.current = true;
                        setEditableTree((current) => {
                          if (!current) {
                            return current;
                          }
                          return updateNodeInTree(current, node.id, updater);
                        });
                      }}
                      onNodeIdChange={(nextNodeId) => {
                        editableTreeDirtyRef.current = true;
                        setEditableNodeId(nextNodeId);
                      }}
                    />
                  ) : selectedNode ? (node) => (
                    <RequirementNodeDetailContent
                      node={node}
                      mode="readonly"
                      taskAssets={submissionTaskAssets}
                    />
                  ) : undefined}
                />
              </div>
            ) : null}
            {activeTab === "canvas" && !tree ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
                Canvas is not available.
              </div>
            ) : null}
            {activeTab === "file" ? (
              <SubmissionFilePanel
                source={source}
                loading={sourceLoading}
                error={sourceError}
                diffCommit={selectedDiffCommit}
                diffFiles={selectedDiffCommit?.changed_files ?? []}
                selectedDiffFilePath={selectedDiffFilePath}
                onOpenDiffFile={openCommitDiffFile}
                emptyMessage={filePanelEmptyMessage}
              />
            ) : activeTab === "results" ? (
              <div style={{ padding: "24px", flex: 1, overflow: "auto" }}>
                <SubmissionResultCard submission={submission} />
              </div>
            ) : activeTab === "stdio" ? (
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
            ) : null}
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
                <div className="preview-panel-header-main">
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
                  {previewTab === "preview" && previewStatus?.stale ? (
                    <span className="preview-panel-status-badge" title="Preview is out of date. Refresh to rebuild from current workspace.">
                      Out of date
                    </span>
                  ) : null}
                </div>
                <div className="preview-panel-actions">
                  {previewTab === "preview" ? (
                    <>
                      <button
                        type="button"
                        className="preview-panel-icon-button"
                        onClick={() => {
                          void refreshPreview();
                        }}
                        aria-label="Refresh preview"
                        title="Refresh preview"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M20 11A8 8 0 1 0 18.2 16.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M20 4V11H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {submission ? (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="preview-panel-icon-button"
                          aria-label="Open preview in new tab"
                          title="Open preview in new tab"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M4 7.8A2.8 2.8 0 0 1 6.8 5H17.2A2.8 2.8 0 0 1 20 7.8V16.2A2.8 2.8 0 0 1 17.2 19H6.8A2.8 2.8 0 0 1 4 16.2V7.8Z" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M8 9.5H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M8 14.5H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </a>
                      ) : null}
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="preview-panel-collapse"
                    onClick={() => setPreviewMinimized(true)}
                    aria-label="Collapse preview panel"
                    title="Collapse preview panel"
                  >
                    <PanelChevronIcon direction="right" size={14} />
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setPreviewMinimized(false)}
                className="submission-panel-minimized-toggle"
                aria-label="Expand preview panel"
                title="Expand preview panel"
              >
                <PanelChevronIcon direction="left" size={20} />
              </button>
            )}
          </div>

          {!previewMinimized ? (
            <div className="preview-panel-body">
              {previewTab === "preview" ? (
                <>
                  {previewLoading ? (
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
                            ? (previewStatus?.error
                              ?? (["PENDING", "RUNNING"].includes(submission.status)
                                ? "Preview has not been built yet. Refresh after the workspace is ready."
                                : "Preview is not available for the current workspace."))
                            : "Select a submission to view its preview"}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <CommitHistoryPanel
                  commits={commitHistory}
                  loading={commitHistoryLoading}
                  error={commitHistoryError}
                  selectedNodeId={selectedNodeId}
                  selectedCommitOid={selectedCommitOid}
                  onSelectCommit={selectCommitHistoryEntry}
                  onOpenDiff={openCommitDiff}
                  onRewind={submission && (submission.status === "PAUSED" || submission.status === "PASSED" || submission.status === "FAILED")
                    ? (commit) => {
                        void handleRewind(commit);
                      }
                    : undefined}
                />
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
