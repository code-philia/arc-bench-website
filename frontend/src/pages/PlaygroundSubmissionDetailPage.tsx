import { useEffect, useMemo, useRef, useState } from "react";
import { DownOutlined, DownloadOutlined, MinusOutlined, PlusOutlined, RadarChartOutlined, UpOutlined } from "@ant-design/icons";
import type { FocusEvent as ReactFocusEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import SubmissionFactoryCanvas, { type SubmissionFactoryCanvasHandle } from "../components/graph/SubmissionFactoryCanvas";
import RequirementNodeDetailContent from "../components/requirements/RequirementNodeDetailContent";
import SubmissionResultCard from "../components/submissions/SubmissionResultCard";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { ApiError, api } from "../lib/api";
import {
  cloneRequirementTree,
  findNodeById,
  parseTaskTreeYaml,
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
  SubmissionSseEvent,
  SubmissionSourcePayload,
  SubmissionTraceabilityPayload,
  SubmissionEditableTaskPayload,
  SubmissionTaskAssets,
  UserTaskDetail,
  WorkspaceFileEntry,
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

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeTaskType(value: string) {
  if (value === "web" || value === "mobile" || value === "kernel" || value === "mixed" || value === "cli") {
    return value;
  }
  return "web";
}

function formatLineNumber(value: number | null) {
  return value && value > 0 ? value : 1;
}

function parsePositiveLineNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return parsed > 0 ? parsed : null;
}

function formatTraceabilitySourceLocation(filePath: string, firstLine: string | null) {
  const lineNumber = parsePositiveLineNumber(firstLine);
  return lineNumber ? `${filePath}:${lineNumber}` : filePath;
}

function traceabilityFileName(filePath: string) {
  const segments = filePath.split(/[\\/]/);
  return segments[segments.length - 1] || filePath;
}

function TraceabilityDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="traceability-hover-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function codeLines(content: string) {
  return content.replace(/\r\n/g, "\n").split("\n");
}

type CodeGrammar = "nodejs" | "java";
type CodeTokenKind = "plain" | "comment" | "string" | "keyword" | "type" | "number" | "operator" | "annotation";
type CodeToken = {
  value: string;
  kind: CodeTokenKind;
};

const NODEJS_HIGHLIGHT_PATTERN =
  /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:import|from|export|default|const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|async|await|new|class|extends|super|typeof|instanceof|in|of|null|undefined|true|false)\b|\b(?:process|require|module|exports|console|Promise|Array|Object|String|Number|Boolean|Map|Set|Date|RegExp|Error)\b|\b\d+(?:\.\d+)?\b|[{}()[\].,;:+\-*/%=&|!<>?]+)/g;
const JAVA_HIGHLIGHT_PATTERN =
  /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|@\w+|\b(?:package|import|public|private|protected|static|final|class|interface|enum|extends|implements|void|new|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|throws|this|super|null|true|false)\b|\b(?:String|Integer|Long|Double|Float|Boolean|List|ArrayList|Map|HashMap|Set|HashSet|Optional|Exception|RuntimeException|Activity|Fragment|Bundle|Intent|View|TextView|RecyclerView)\b|\b\d+(?:\.\d+)?\b|[{}()[\].,;:+\-*/%=&|!<>?]+)/g;

function resolveCodeGrammar(taskType: "web" | "mobile" | "kernel" | "mixed" | "cli"): CodeGrammar | null {
  if (taskType === "web") {
    return "nodejs";
  }
  if (taskType === "mobile") {
    return "java";
  }
  return null;
}

function classifyCodeToken(token: string, grammar: CodeGrammar): CodeTokenKind {
  if (!token) {
    return "plain";
  }
  if (token.startsWith("//") || token.startsWith("/*")) {
    return "comment";
  }
  if (token.startsWith("\"") || token.startsWith("'") || token.startsWith("`")) {
    return "string";
  }
  if (grammar === "java" && token.startsWith("@")) {
    return "annotation";
  }
  if (/^\d+(?:\.\d+)?$/.test(token)) {
    return "number";
  }
  if (/^[{}()[\].,;:+\-*/%=&|!<>?]+$/.test(token)) {
    return "operator";
  }

  if (grammar === "nodejs") {
    if (/^(import|from|export|default|const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|async|await|new|class|extends|super|typeof|instanceof|in|of|null|undefined|true|false)$/.test(token)) {
      return "keyword";
    }
    if (/^(process|require|module|exports|console|Promise|Array|Object|String|Number|Boolean|Map|Set|Date|RegExp|Error)$/.test(token)) {
      return "type";
    }
    return "plain";
  }

  if (/^(package|import|public|private|protected|static|final|class|interface|enum|extends|implements|void|new|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|throws|this|super|null|true|false)$/.test(token)) {
    return "keyword";
  }
  if (/^(String|Integer|Long|Double|Float|Boolean|List|ArrayList|Map|HashMap|Set|HashSet|Optional|Exception|RuntimeException|Activity|Fragment|Bundle|Intent|View|TextView|RecyclerView)$/.test(token)) {
    return "type";
  }
  return "plain";
}

function tokenizeCodeLine(line: string, grammar: CodeGrammar | null): CodeToken[] {
  if (!grammar || !line) {
    return [{ value: line, kind: "plain" }];
  }
  const pattern = grammar === "nodejs" ? NODEJS_HIGHLIGHT_PATTERN : JAVA_HIGHLIGHT_PATTERN;
  pattern.lastIndex = 0;
  const tokens: CodeToken[] = [];
  let cursor = 0;

  for (const match of line.matchAll(pattern)) {
    const matchValue = match[0] ?? "";
    const matchIndex = match.index ?? 0;
    if (matchIndex > cursor) {
      tokens.push({ value: line.slice(cursor, matchIndex), kind: "plain" });
    }
    tokens.push({ value: matchValue, kind: classifyCodeToken(matchValue, grammar) });
    cursor = matchIndex + matchValue.length;
  }

  if (cursor < line.length) {
    tokens.push({ value: line.slice(cursor), kind: "plain" });
  }

  return tokens.length > 0 ? tokens : [{ value: line, kind: "plain" }];
}

function formatCommitDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function buildExpandedDirectoryChain(filePath: string): string[] {
  const segments = filePath.split("/").filter(Boolean);
  const expanded: string[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    expanded.push(segments.slice(0, index).join("/"));
  }
  return expanded;
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

function resolveEditableTree(
  payload: SubmissionEditableTaskPayload,
  fallbackTree: RequirementNode | null,
): RequirementNode | null {
  if (payload.requirements_yaml.trim()) {
    try {
      return parseTaskTreeYaml(payload.requirements_yaml);
    } catch {
      return fallbackTree ? cloneRequirementTree(fallbackTree) : null;
    }
  }

  return fallbackTree ? cloneRequirementTree(fallbackTree) : null;
}

function resolveRequirementCatalogTree(requirement: RequirementDetail | null): RequirementNode | null {
  if (!requirement) {
    return null;
  }
  if (requirement.requirements_yaml?.trim()) {
    try {
      return parseTaskTreeYaml(requirement.requirements_yaml);
    } catch {
      return null;
    }
  }
  return null;
}

function adaptUserTaskToRequirementDetail(task: UserTaskDetail): RequirementDetail {
  return {
    id: task.id,
    display_id: task.id,
    title: task.title,
    category: task.task_type,
    summary: task.summary,
    test_runner: "playwright",
    total_tests: 0,
    module_count: task.atomic_count,
    requirements_markdown: task.markdown_content,
    requirements_yaml: task.yaml_content,
    prerequisites_markdown: "",
    assets_base_url: "",
    references_base_url: `/api/my-tasks/${task.id}/reference/`,
  };
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

function changedFileMarker(changeType: string): "U" | "M" | "D" | "R" {
  const normalized = changeType.toUpperCase();
  if (normalized === "A") {
    return "U";
  }
  if (normalized === "D") {
    return "D";
  }
  if (normalized === "R") {
    return "R";
  }
  return "M";
}

function changedFileMarkerClass(changeType: string): string {
  return `kind-change-${changedFileMarker(changeType).toLowerCase()}`;
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

function parseInterfaceDisplayContent(content: string) {
  const fallback = {
    title: "",
    description: content.trim(),
  };
  const normalized = content.trim();
  if (!normalized) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(normalized) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    const title = String(
      parsed.name
      ?? parsed.title
      ?? parsed.interface_name
      ?? parsed.interfaceId
      ?? "",
    ).trim();
    const description = String(
      parsed.description
      ?? parsed.summary
      ?? parsed.content
      ?? "",
    ).trim();
    return {
      title,
      description,
    };
  } catch {
    return fallback;
  }
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
  onOpenSource: (payload: { filePath: string; firstLine?: string | null }) => void;
}) {
  const selectedCardRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);

  const showTraceabilityTooltip = (event: ReactFocusEvent<HTMLElement> | ReactMouseEvent<HTMLElement>, content: ReactNode) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = 360;
    const gap = 10;
    const margin = 12;
    const placeLeft = rect.right + gap + tooltipWidth > window.innerWidth - margin;
    const x = placeLeft
      ? Math.max(margin, rect.left - tooltipWidth - gap)
      : rect.right + gap;
    const y = Math.min(
      Math.max(rect.top + (rect.height / 2), 170),
      Math.max(170, window.innerHeight - 170),
    );
    setHoverTooltip({ x, y, content });
  };

  const hideTraceabilityTooltip = () => setHoverTooltip(null);

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
    <div className="traceability-panel" ref={panelRef} onScroll={hideTraceabilityTooltip}>
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
            const displayContent = parseInterfaceDisplayContent(item.content);
            const interfaceName = displayContent.title || item.interface_id;
            const tooltipContent = (
              <>
                <TraceabilityDetailRow label="Source" value={formatTraceabilitySourceLocation(item.file_path, item.first_line)} />
                <TraceabilityDetailRow label="Req IDs" value={item.req_ids.length ? item.req_ids.join(", ") : "None"} />
                <TraceabilityDetailRow label="Callers" value={item.callers.length ? item.callers.join(", ") : "None"} />
                <TraceabilityDetailRow label="Callees" value={item.callees.length ? item.callees.join(", ") : "None"} />
                {displayContent.description ? (
                  <div className="traceability-hover-description">{displayContent.description}</div>
                ) : null}
              </>
            );
            return (
            <article
              key={item.interface_id}
              ref={isCardSelected ? selectedCardRef : null}
              className={`traceability-card${isCardSelected ? " selected" : ""}`}
              role="button"
              tabIndex={0}
              onMouseEnter={(event) => showTraceabilityTooltip(event, tooltipContent)}
              onMouseLeave={hideTraceabilityTooltip}
              onFocus={(event) => showTraceabilityTooltip(event, tooltipContent)}
              onBlur={hideTraceabilityTooltip}
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
                <div className="traceability-card-summary">
                  <div className="traceability-card-id">{item.interface_id}</div>
                  <div className="traceability-card-title">{interfaceName}</div>
                </div>
                <div className="traceability-chip-row">
                  <span className={`traceability-chip type-${item.type.toLowerCase()}`}>{item.type}</span>
                  <span className={`traceability-chip ${item.implemented ? "implemented" : "planned"}`}>
                    {item.implemented ? "Implemented" : "Planned"}
                  </span>
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
            const testName = item.scenario_id || traceabilityFileName(item.file_path) || item.test_id;
            const tooltipContent = (
              <>
                <TraceabilityDetailRow label="Source" value={formatTraceabilitySourceLocation(item.file_path, item.first_line)} />
                <TraceabilityDetailRow label="Requirement" value={item.req_id} />
                <TraceabilityDetailRow label="Scenario" value={item.scenario_id ?? "Not linked"} />
                <TraceabilityDetailRow label="Status" value={item.status ?? "Not executed"} />
              </>
            );
            return (
            <article
              key={item.test_id}
              ref={isCardSelected ? selectedCardRef : null}
              className={`traceability-card${isCardSelected ? " selected" : ""}`}
              role="button"
              tabIndex={0}
              onMouseEnter={(event) => showTraceabilityTooltip(event, tooltipContent)}
              onMouseLeave={hideTraceabilityTooltip}
              onFocus={(event) => showTraceabilityTooltip(event, tooltipContent)}
              onBlur={hideTraceabilityTooltip}
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
                <div className="traceability-card-summary">
                  <div className="traceability-card-id">{item.test_id}</div>
                  <div className="traceability-card-title">{testName}</div>
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
            </article>
            );
          })}
        </div>
      </section>
      {hoverTooltip ? createPortal(
        <div
          className="traceability-floating-tooltip"
          role="tooltip"
          style={{ left: hoverTooltip.x, top: hoverTooltip.y }}
        >
          {hoverTooltip.content}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function WorkspaceFileTreeItem({
  file,
  selectedPath,
  onSelect,
  expandedDirs,
  onToggleDir,
  depth = 0,
}: {
  file: WorkspaceFileEntry;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  depth?: number;
}) {
  const isDir = file.is_directory;
  const isExpanded = expandedDirs.has(file.path);
  const isSelected = selectedPath === file.path;

  if (isDir) {
    return (
      <div className="ide-tree-group">
        <button
          type="button"
          className={`ide-tree-item ide-tree-dir${isSelected ? " active" : ""}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => onToggleDir(file.path)}
        >
          <span className="ide-tree-chevron" aria-hidden="true">
            <TreeChevronIcon expanded={isExpanded} />
          </span>
          <span className="ide-tree-label">{file.name}</span>
        </button>
        {isExpanded && file.children && (
          <div>
            {file.children.map((child) => (
              <WorkspaceFileTreeItem
                key={child.path}
                file={child}
                selectedPath={selectedPath}
                onSelect={onSelect}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`ide-tree-item ide-tree-file${isSelected ? " active" : ""}`}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      onClick={() => onSelect(file.path)}
    >
      <span className="ide-tree-spacer" aria-hidden="true" />
      <span className="ide-tree-label">{file.name}</span>
    </button>
  );
}

function TreeChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`ide-tree-chevron-icon${expanded ? " expanded" : ""}`}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4.25 2.5L7.75 6L4.25 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SubmissionFilePanel({
  panelMode,
  source,
  loading,
  error,
  diffCommit,
  diffFiles,
  selectedDiffFilePath,
  onOpenDiffFile,
  emptyMessage,
  submissionId,
  submission,
  taskType,
  setSource,
  refreshCommitHistory,
  refreshTraceabilityForCurrentView,
  selectedNodeId,
  workspaceRefreshToken,
}: {
  panelMode: "workspace" | "diff";
  source: SubmissionSourcePayload | null;
  loading: boolean;
  error: string | null;
  diffCommit: SubmissionCommitHistoryEntry | null;
  diffFiles: SubmissionCommitChangedFile[];
  selectedDiffFilePath: string | null;
  onOpenDiffFile: (changedFile: SubmissionCommitChangedFile) => void;
  emptyMessage: string;
  submissionId: string;
  submission: SubmissionDetail | null;
  taskType: "web" | "mobile" | "kernel" | "mixed" | "cli";
  setSource: (source: SubmissionSourcePayload | null) => void;
  refreshCommitHistory: (silent?: boolean) => Promise<SubmissionCommitHistoryPayload>;
  refreshTraceabilityForCurrentView: () => void;
  selectedNodeId: string | null;
  workspaceRefreshToken: number;
}) {
  const codeViewRef = useRef<HTMLPreElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileEntry[]>([]);
  const [workspaceFilesLoading, setWorkspaceFilesLoading] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  const [newTestId, setNewTestId] = useState("");
  const [newTestType, setNewTestType] = useState("Unit");
  const [selectedNodeIdForTest, setSelectedNodeIdForTest] = useState<string | null>(null);
  const [templateBundleDownloading, setTemplateBundleDownloading] = useState(false);
  const [templateBundleError, setTemplateBundleError] = useState<string | null>(null);
  const canManualEdit = submission?.status === "PAUSED" && submission?.can_manual_edit;
  const codeGrammar = resolveCodeGrammar(taskType);
  const isDiffPanel = panelMode === "diff";
  const [cachedFileSource, setCachedFileSource] = useState<SubmissionSourcePayload | null>(null);
  const [cachedDiffSource, setCachedDiffSource] = useState<SubmissionSourcePayload | null>(null);
  const latestDiffSource = source?.kind === "diff" ? source : null;
  const latestFileSource = source?.kind === "file" ? source : null;
  const diffSource = isDiffPanel ? (latestDiffSource ?? cachedDiffSource) : null;
  const fileSource = !isDiffPanel ? (latestFileSource ?? cachedFileSource) : null;
  const relevantSource = isDiffPanel ? diffSource : fileSource;
  const showInlineLoading = loading && Boolean(relevantSource);
  const effectiveFileContent = isEditing ? fileContent : (fileSource?.content ?? "");
  const lines = useMemo(() => codeLines(effectiveFileContent), [effectiveFileContent]);
  const highlightedLine = formatLineNumber(fileSource?.first_line ?? 1);
  const highlightedTokens = useMemo(
    () => lines.map((line) => tokenizeCodeLine(line, codeGrammar)),
    [codeGrammar, lines],
  );

  useEffect(() => {
    setWorkspaceFiles([]);
    setWorkspaceFilesLoading(false);
    setSelectedFilePath(null);
    setFileContent("");
    setIsEditing(false);
    setUnsavedChanges(false);
    setExpandedDirs(new Set());
    setCachedFileSource(null);
    setCachedDiffSource(null);
  }, [submissionId]);

  const loadWorkspaceFiles = async () => {
    if (!submissionId) {
      return;
    }
    setWorkspaceFilesLoading(true);
    try {
      const result = await api.getWorkspaceFiles(submissionId);
      setWorkspaceFiles(result.files);
      setExpandedDirs((current) => {
        const next = new Set(current);
        if (result.files.length > 0 && result.files[0].children) {
          next.add(result.files[0].path);
        }
        return next;
      });
    } catch (e) {
      console.error("Failed to load workspace files", e);
    } finally {
      setWorkspaceFilesLoading(false);
    }
  };

  useEffect(() => {
    if (source?.kind === "file") {
      setCachedFileSource(source);
      return;
    }
    if (source?.kind === "diff") {
      setCachedDiffSource(source);
    }
  }, [source]);

  useEffect(() => {
    if (isDiffPanel) {
      return;
    }
    loadWorkspaceFiles();
  }, [isDiffPanel, submissionId, workspaceRefreshToken]);

  useEffect(() => {
    if (!fileSource?.file_path) {
      return;
    }
    setSelectedFilePath(fileSource.file_path);
    const expandedParents = buildExpandedDirectoryChain(fileSource.file_path);
    if (expandedParents.length === 0) {
      return;
    }
    setExpandedDirs((current) => {
      const next = new Set(current);
      expandedParents.forEach((path) => next.add(path));
      return next;
    });
  }, [fileSource?.file_path]);

  const openWorkspaceFile = async (path: string) => {
    if (!submissionId) return;
    setSelectedFilePath(path);
    setIsEditing(false);
    setUnsavedChanges(false);
    try {
      const result = await api.getSubmissionSource(submissionId, { filePath: path, kind: "file" });
      setSource(result);
      setFileContent(result.content);
    } catch (e) {
      console.error("Failed to load file", e);
    }
  };

  const toggleDirectory = (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  const saveFile = async () => {
    if (!submissionId || !selectedFilePath) return;
    try {
      await api.updateWorkspaceFile(submissionId, {
        path: selectedFilePath,
        content: fileContent,
      });
      setUnsavedChanges(false);
      setIsEditing(false);
      await loadWorkspaceFiles();
      setSource({
        kind: "file",
        file_path: selectedFilePath,
        language: fileSource?.language ?? "text",
        content: fileContent,
        first_line: fileSource?.first_line ?? 1,
      });
    } catch (e) {
      console.error("Failed to save file", e);
    }
  };

  const cancelEdit = () => {
    if (fileSource && selectedFilePath === fileSource.file_path) {
      setFileContent(fileSource.content);
    }
    setIsEditing(false);
    setUnsavedChanges(false);
  };

  const createTest = async () => {
    if (!submissionId || !selectedNodeIdForTest || !newTestId) return;
    try {
      const result = await api.createTest(submissionId, {
        test_id: newTestId,
        req_id: selectedNodeIdForTest,
        test_type: newTestType,
      });
      setShowCreateTestModal(false);
      setNewTestId("");
      await loadWorkspaceFiles();
      refreshTraceabilityForCurrentView();
      await openWorkspaceFile(result.file_path);
    } catch (e) {
      console.error("Failed to create test", e);
    }
  };

  const downloadTemplateBundle = async () => {
    if (!submissionId || templateBundleDownloading) {
      return;
    }
    try {
      setTemplateBundleDownloading(true);
      setTemplateBundleError(null);
      const bundle = await api.downloadSubmissionTemplateBundle(submissionId);
      downloadFile(bundle);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to download template bundle.";
      setTemplateBundleError(errorMessage);
      console.error("Failed to download template bundle", e);
    } finally {
      setTemplateBundleDownloading(false);
    }
  };

  useEffect(() => {
    if (!source || !codeViewRef.current) {
      return;
    }
    const lineHeight = 1.65 * 0.84 * 16;
    const scrollTop = Math.max(0, (formatLineNumber(source.first_line) - 3) * lineHeight);
    codeViewRef.current.scrollTop = scrollTop;
  }, [source]);

  if (loading && !relevantSource) {
    return <div className="ide-empty-state">Loading source...</div>;
  }

  if (error && ((isDiffPanel && !diffSource) || (!isDiffPanel && !fileSource))) {
    return <div className="ide-empty-state">{error}</div>;
  }

  if (isDiffPanel) {
    const diffLines = codeLines(diffSource?.content ?? "");
    const diffDisplayPath = diffSource ? readDiffHeaderPath(diffSource.content, diffSource.file_path) : (selectedDiffFilePath ?? "Diff");
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
                    <span className={`ide-file-status ${changedFileMarkerClass(changedFile.change_type)}`}>
                      {changedFileMarker(changedFile.change_type)}
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
            <div className="ide-editor-tabbar">
              <div className="ide-editor-tab active">{editorTitle}</div>
            </div>
            <div className="ide-editor-badge">DIFF</div>
          </div>
          {diffSource ? (
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
                        gap: "12px",
                        borderRadius: 0,
                        padding: "0 6px",
                        margin: "0 -6px",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)", userSelect: "none" }}>{lineNumber}</span>
                      <span>{line || " "}</span>
                    </div>
                  );
                })}
              </code>
            </pre>
          ) : (
            <div className="ide-empty-state">
              {diffCommit ? "Select a changed file to inspect its diff." : emptyMessage}
            </div>
          )}
          {showInlineLoading ? <div className="ide-loading-overlay">Loading diff...</div> : null}
        </section>
      </div>
    );
  }

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
            {canManualEdit ? (
              <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ marginBottom: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
                  Paused editing session
                </div>
                <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      padding: "3px 6px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    onClick={loadWorkspaceFiles}
                    disabled={workspaceFilesLoading}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      padding: "3px 6px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    onClick={() => {
                      setSelectedNodeIdForTest(selectedNodeId ?? "ROOT");
                      setShowCreateTestModal(true);
                    }}
                  >
                    + Add Test
                  </button>
                </div>
              </div>
            ) : null}
            {workspaceFiles.length > 0 ? (
              workspaceFiles.map((file) => (
                <WorkspaceFileTreeItem
                  key={file.path}
                  file={file}
                  selectedPath={selectedFilePath}
                  onSelect={openWorkspaceFile}
                  expandedDirs={expandedDirs}
                  onToggleDir={toggleDirectory}
                />
              ))
            ) : (
              <div className="ide-file-list-empty">
                {workspaceFilesLoading ? "Loading workspace..." : "Workspace files are not available."}
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
            <div className="ide-editor-tabbar">
              <div className="ide-editor-tab active">{fileSource?.file_path ?? "workspace/template"}</div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="ide-template-download-btn"
              onClick={() => void downloadTemplateBundle()}
              disabled={templateBundleDownloading}
              title={templateBundleError ?? "Download workspace/template as a zip file"}
            >
              <DownloadOutlined />
              <span>{templateBundleDownloading ? "Packaging..." : "project.zip"}</span>
            </button>
            {canManualEdit && fileSource ? (
              <>
                {!isEditing ? (
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() => {
                      setFileContent(fileSource.content);
                      setIsEditing(true);
                    }}
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="inline-link"
                      onClick={saveFile}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="inline-link"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </>
            ) : null}
            {fileSource ? <div className="ide-editor-badge">{fileSource.language.toUpperCase()}</div> : null}
          </div>
        </div>
        {isEditing && fileSource ? (
          <textarea
            ref={textareaRef}
            className="ide-code-view ide-code-editor"
            value={fileContent}
            onChange={(e) => {
              setFileContent(e.target.value);
              setUnsavedChanges(true);
            }}
            spellCheck={false}
          />
        ) : fileSource ? (
          <pre ref={codeViewRef} className="ide-code-view">
            <code>
              {lines.map((line, index) => {
                const lineNumber = index + 1;
                const isHighlighted = lineNumber === highlightedLine;
                const tokens = highlightedTokens[index] ?? [{ value: line, kind: "plain" as const }];
                return (
                  <div
                    key={`${lineNumber}:${line}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "56px minmax(0, 1fr)",
                      gap: "12px",
                      background: isHighlighted ? "rgba(250, 204, 21, 0.18)" : "transparent",
                      borderRadius: 0,
                      padding: "0 6px",
                      margin: "0 -6px",
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
                    <span>
                      {tokens.length === 0 ? " " : tokens.map((token, tokenIndex) => (
                        <span
                          key={`${lineNumber}:${tokenIndex}:${token.value}`}
                          className={token.kind === "plain" ? undefined : `code-token ${token.kind}`}
                        >
                          {token.value}
                        </span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </code>
          </pre>
        ) : (
          <div className="ide-empty-state">{emptyMessage}</div>
        )}
        {showInlineLoading ? <div className="ide-loading-overlay">Loading source...</div> : null}
      </section>

      {showCreateTestModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateTestModal(false)}
        >
          <div
            style={{
              background: "white",
              padding: "24px",
              borderRadius: 0,
              minWidth: "400px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "16px" }}>Add Test</h3>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px" }}>For Requirement:</label>
              <div style={{ padding: "8px", background: "#f5f5f5", borderRadius: "4px" }}>
                {selectedNodeIdForTest}
              </div>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px" }}>Test ID:</label>
              <input
                type="text"
                value={newTestId}
                onChange={(e) => setNewTestId(e.target.value)}
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                placeholder="e.g., REQ-1-test-login"
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px" }}>Test Type:</label>
              <select
                value={newTestType}
                onChange={(e) => setNewTestType(e.target.value)}
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
              >
                <option value="Unit">Unit</option>
                <option value="Integration">Integration</option>
                <option value="E2E">E2E</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowCreateTestModal(false)}
                style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createTest}
                disabled={!newTestId}
                style={{
                  padding: "8px 16px",
                  background: "#0078d4",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  opacity: newTestId ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
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
              ].filter(Boolean).join(" ")}</span>
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
  const params = useParams();
  const rawTaskType = params.taskType ?? "web";
  const requirementId = params.requirementId ?? params.taskId ?? "";
  const submissionId = params.submissionId ?? "";
  const location = useLocation();
  const requirementCatalog: "playground" | "competition" | "benchmark" | "my_tasks" = location.pathname.startsWith("/submissions/")
    ? "competition"
    : location.pathname.startsWith("/playground/my-tasks/")
      ? "my_tasks"
    : location.pathname.startsWith("/playground/arc-bench/")
      ? "benchmark"
      : "playground";
  const { user } = useAuth();
  const factoryCanvasRef = useRef<SubmissionFactoryCanvasHandle | null>(null);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [logs, setLogs] = useState<SubmissionLogs | null>(null);
  const [requirement, setRequirement] = useState<RequirementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorStatus, setLoadErrorStatus] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"canvas" | "file" | "diff" | "results" | "stdio">("canvas");
  const [stdioTab, setStdioTab] = useState<"stdout" | "stderr">("stdout");
  const [sidebarTab, setSidebarTab] = useState<"status" | "traceability">("status");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("ROOT");
  const [factorySelectionActive, setFactorySelectionActive] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
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
  const eventSourceRef = useRef<EventSource | null>(null);
  const sseReconnectRef = useRef<number | null>(null);
  const lastSseVersionRef = useRef(0);
  const activeTabRef = useRef<"canvas" | "file" | "diff" | "results" | "stdio">("canvas");
  const submissionStatusRef = useRef<string | null>(null);
  const activeSelectedNodeIdRef = useRef<string | null>("ROOT");
  const traceabilityOverlayVisibleRef = useRef(false);
  const visualEventCountRef = useRef(0);
  const isSidebarDragging = useRef(false);
  const sidebarDragStartX = useRef(0);
  const sidebarDragStartWidth = useRef(0);
  const isPreviewDragging = useRef(false);
  const previewDragStartX = useRef(0);
  const previewDragStartWidth = useRef(0);
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
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = useState(0);
  const [commitHistory, setCommitHistory] = useState<SubmissionCommitHistoryPayload | null>(null);
  const [commitHistoryLoading, setCommitHistoryLoading] = useState(false);
  const [commitHistoryError, setCommitHistoryError] = useState<string | null>(null);
  const [selectedCommitOid, setSelectedCommitOid] = useState<string | null>(null);
  const [selectedDiffFilePath, setSelectedDiffFilePath] = useState<string | null>(null);
  const [editableTask, setEditableTask] = useState<SubmissionEditableTaskPayload | null>(null);
  const [editableTree, setEditableTree] = useState<RequirementNode | null>(null);
  const [submissionTaskAssets, setSubmissionTaskAssets] = useState<SubmissionTaskAssets | null>(null);
  const [traceabilityOverlayVisible, setTraceabilityOverlayVisible] = useState(false);
  const [showInterfaces, setShowInterfaces] = useState(true);
  const [showTests, setShowTests] = useState(true);
  const [editableNodeId, setEditableNodeId] = useState<string | null>("ROOT");
  const [editableDetailExpanded, setEditableDetailExpanded] = useState(false);
  const [savingEditableTask, setSavingEditableTask] = useState(false);
  const [editableReloadToken, setEditableReloadToken] = useState(0);
  const taskType = normalizeTaskType(requirement?.category ?? rawTaskType);
  const executionPaused = submission?.status === "PAUSED";
  const executionPausePending = submission?.status === "PAUSE_REQUESTED";
  const hasSubmission = submission !== null;
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
  const filePanelEmptyMessage = "Select a file from workspace to inspect source.";
  const diffPanelEmptyMessage = "Select a commit history entry to inspect its diff.";
  const visibleTraceability = traceabilityNodeId === activeSelectedNodeId ? traceability : null;
  const visibleTraceabilityError = traceabilityNodeId === activeSelectedNodeId ? traceabilityError : null;
  const canvasNeedsAllTraceability = activeTab === "canvas" && submission?.status !== "PAUSED";

  useEffect(() => {
    activeSelectedNodeIdRef.current = activeSelectedNodeId;
  }, [activeSelectedNodeId]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    submissionStatusRef.current = submission?.status ?? null;
  }, [submission?.status]);

  useEffect(() => {
    traceabilityOverlayVisibleRef.current = traceabilityOverlayVisible;
  }, [traceabilityOverlayVisible]);

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

  const refreshSubmissionDetail = async () => {
    const latest = await api.getSubmission(submissionId);
    setSubmission(latest);
    return latest;
  };

  const refreshSubmissionLogs = async () => {
    const latestLogs = await api.getSubmissionLogs(submissionId);
    setLogs(latestLogs);
    return latestLogs;
  };

  const refreshCommitHistory = async (silent = false) => {
    if (!silent) {
      setCommitHistoryLoading(true);
    }
    setCommitHistoryError(null);
    try {
      const payload = await api.getSubmissionCommitHistory(submissionId);
      setCommitHistory(payload);
      return payload;
    } catch (error) {
      if (!silent) {
        setCommitHistory(null);
        setCommitHistoryError((error as Error).message);
      }
      throw error;
    } finally {
      if (!silent) {
        setCommitHistoryLoading(false);
      }
    }
  };

  const refreshSelectedTraceability = async (nodeId: string, showLoading: boolean) => {
    if (showLoading) {
      setTraceability(null);
      setTraceabilityLoading(true);
    }
    setTraceabilityError(null);
    setTraceabilityNodeId(nodeId);
    try {
      const payload = await api.getSubmissionTraceability(submissionId, nodeId);
      setTraceability(payload);
      return payload;
    } catch (error) {
      setTraceability(null);
      setTraceabilityError((error as Error).message);
      throw error;
    } finally {
      if (showLoading) {
        setTraceabilityLoading(false);
      }
    }
  };

  const refreshAllTraceability = async () => {
    const payload = await api.getSubmissionAllTraceability(submissionId);
    setAllTraceability(payload);
    return payload;
  };

  const refreshEditableTask = async () => {
    const payload = await api.getSubmissionEditableTask(submissionId);
    setEditableTask(payload);
    return payload;
  };

  const refreshTraceabilityForCurrentView = () => {
    if (traceabilityOverlayVisible) {
      void refreshAllTraceability().catch(() => undefined);
      return;
    }
    if (activeSelectedNodeId) {
      void refreshSelectedTraceability(activeSelectedNodeId, false).catch(() => undefined);
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
    setFactorySelectionActive(false);
    setAllTraceability(null);
    setTraceabilityOverlayVisible(false);
    setShowInterfaces(true);
    setShowTests(true);
    setSource(null);
    setSourceError(null);
    setWorkspaceRefreshToken(0);
    setCommitHistory(null);
    setCommitHistoryError(null);
    setSelectedCommitOid(null);
    setSelectedDiffFilePath(null);
    setSubmissionTaskAssets(submissionId ? api.getSubmissionTaskAssets(submissionId) : null);
    visualEventCountRef.current = 0;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (sseReconnectRef.current) {
      window.clearTimeout(sseReconnectRef.current);
      sseReconnectRef.current = null;
    }
  }, [submissionId]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    setLoadErrorStatus(null);
    Promise.all([
      refreshSubmissionDetail(),
      refreshSubmissionLogs(),
      requirementCatalog === "my_tasks"
        ? api.getMyTask(requirementId).then(adaptUserTaskToRequirementDetail)
        : api.getRequirement(requirementId, requirementCatalog),
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
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (sseReconnectRef.current) {
        window.clearTimeout(sseReconnectRef.current);
        sseReconnectRef.current = null;
      }
    };
  }, [requirementCatalog, requirementId, submissionId]);

  useEffect(() => {
    if (!submission) {
      setPreviewStatus(null);
      setPreviewLoading(false);
      return;
    }
    void loadPreviewStatus(previewStatus !== null);
  }, [submissionId, hasSubmission]);

  useEffect(() => {
    if (!previewStatus?.available) {
      return;
    }
    setPreviewFrameVersion((current) => current + 1);
  }, [previewStatus?.available, previewStatus?.preview_head_oid, previewStatus?.workspace_head_oid]);

  useEffect(() => {
    if (!submissionId || !submission) {
      setCommitHistory(null);
      setCommitHistoryError(null);
      return;
    }
    void refreshCommitHistory(commitHistory !== null).catch(() => undefined);
  }, [submissionId, hasSubmission]);

  useEffect(() => {
    if (!submissionId || !submission) {
      setAllTraceability(null);
      return;
    }
    if (!traceabilityOverlayVisible && !canvasNeedsAllTraceability) {
      return;
    }
    void refreshAllTraceability().catch(() => undefined);
  }, [canvasNeedsAllTraceability, submissionId, submission?.status, traceabilityOverlayVisible]);

  useEffect(() => {
    if (!submissionId || !user) {
      return;
    }

    const refreshTraceabilityForLiveView = () => {
      if (traceabilityOverlayVisibleRef.current || (activeTabRef.current === "canvas" && submissionStatusRef.current !== "PAUSED")) {
        void refreshAllTraceability().catch(() => undefined);
        return;
      }
      if (activeSelectedNodeIdRef.current) {
        void refreshSelectedTraceability(activeSelectedNodeIdRef.current, false).catch(() => undefined);
      }
    };

    const handleSseEvent = (event: SubmissionSseEvent) => {
      if (event.version <= lastSseVersionRef.current) {
        return;
      }
      lastSseVersionRef.current = event.version;
      if (event.refresh.submission) {
        void refreshSubmissionDetail().catch(() => undefined);
      }
      if (event.refresh.logs) {
        void refreshSubmissionLogs().catch(() => undefined);
      }
      if (event.refresh.commit_history) {
        setWorkspaceRefreshToken((current) => current + 1);
        void refreshCommitHistory(true).catch(() => undefined);
      }
      if (event.refresh.preview) {
        void loadPreviewStatus(true);
      }
      if (event.refresh.traceability_all || event.refresh.traceability_selected) {
        refreshTraceabilityForLiveView();
      }
    };

    const connect = () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = api.connectSubmissionEvents(submissionId, {
        onEvent: handleSseEvent,
        onError: () => {
          eventSourceRef.current?.close();
          eventSourceRef.current = null;
          if (sseReconnectRef.current) {
            window.clearTimeout(sseReconnectRef.current);
          }
          sseReconnectRef.current = window.setTimeout(() => {
            connect();
          }, 2000);
        },
      }, { sinceVersion: lastSseVersionRef.current });
    };

    lastSseVersionRef.current = 0;
    connect();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (sseReconnectRef.current) {
        window.clearTimeout(sseReconnectRef.current);
        sseReconnectRef.current = null;
      }
    };
  }, [submissionId, user]);

  const catalogTree = useMemo(() => resolveRequirementCatalogTree(requirement), [requirement]);

  const tree = useMemo(() => {
    if (editableTask) {
      return resolveEditableTree(editableTask, catalogTree);
    }
    return catalogTree;
  }, [catalogTree, editableTask]);

  const nodeStates = useMemo(() => {
    return submission?.node_states ?? {};
  }, [submission?.node_states]);

  const selectedNode = useMemo(() => {
    if (!tree || !activeSelectedNodeId) {
      return null;
    }
    return findNodeById(tree, activeSelectedNodeId);
  }, [activeSelectedNodeId, tree]);
  const factoryDetailNode = submission?.status !== "PAUSED" && factorySelectionActive ? selectedNode : null;
  const factoryDetailExpanded = useQuickStartSubmission ? quickStart.canvasDemo.detailExpanded : detailExpanded;

  useEffect(() => {
    if (!submissionId || !submission) {
      editableTreeDirtyRef.current = false;
      setEditableTask(null);
      setEditableTree(null);
      return;
    }

    if (submission.status !== "PAUSED") {
      setEditableTask(null);
      setEditableTree(null);
    }

    let cancelled = false;
    refreshEditableTask()
      .then((payload) => {
        if (cancelled) {
          return;
        }
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
    catalogTree,
    editableReloadToken,
    submission,
    submission?.status,
    submissionId,
  ]);

  const editableModeActive = executionPaused;
  const pausedCanvasTree = editableModeActive ? (editableTree ?? tree) : tree;
  const pausedCanvasSelectedNodeId = editableModeActive ? editableNodeId : activeSelectedNodeId;
  const pausedCanvasSelectedNode = editableModeActive ? (editableSelectedNode ?? selectedNode) : selectedNode;
  const factoryCanvasSelectedNodeId = executionPaused
    ? pausedCanvasSelectedNodeId
    : (factorySelectionActive ? activeSelectedNodeId : null);
  const factoryCanvasSelectionActive = executionPaused ? Boolean(pausedCanvasSelectedNodeId) : factorySelectionActive;
  const canvasDetailNode = executionPaused ? pausedCanvasSelectedNode : factoryDetailNode;
  const canvasDetailExpanded = executionPaused ? editableDetailExpanded : factoryDetailExpanded;

  useEffect(() => {
    if (submission?.status !== "PAUSED") {
      return;
    }
    const preferredNodeId = activeSelectedNodeId ?? "ROOT";
    setEditableNodeId((current) => (current && current !== "ROOT" ? current : preferredNodeId));
    setEditableDetailExpanded((current) => current || (useQuickStartSubmission ? quickStart.canvasDemo.detailExpanded : detailExpanded));
    setFactorySelectionActive(Boolean(preferredNodeId));
  }, [activeSelectedNodeId, detailExpanded, quickStart.canvasDemo.detailExpanded, submission?.status, useQuickStartSubmission]);

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
      setSelectedNodeId(newest.node_id);
      setFocusNodeId(newest.node_id);
      setPulseNodeId(newest.node_id);
    } else {
      setSelectedNodeId(newest.node_id);
      setFocusNodeId(newest.node_id);
      setPulseNodeId(newest.node_id);
    }
    setFactorySelectionActive(true);
    setSelectedTraceabilityKind(null);
    setSelectedTraceabilityId(null);
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
    refreshSelectedTraceability(activeSelectedNodeId, isNodeChange)
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

  const openSource = async ({ filePath, firstLine }: { filePath: string; firstLine?: string | null }) => {
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
    setActiveTab("diff");
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
    setActiveTab("diff");
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
      if (useQuickStartSubmission) {
        quickStart.setSelectedNode(commit.node_id);
      }
    }
    if (activeTab === "diff") {
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
    if (submission?.can_manual_edit) {
      try {
        const preview = await api.getManualEditCommitPreview(submissionId);
        if (preview.dirty) {
          const scope = preview.node_id && preview.phase
            ? `${preview.node_id} (${preview.phase})`
            : "the current paused step";
          const confirmed = window.confirm(
            `Resume will create one manual commit for ${scope} before continuing.`,
          );
          if (!confirmed) {
            return;
          }
        }
      } catch (error) {
        const fallbackMessage = error instanceof Error ? error.message : "Failed to prepare resume preview.";
        console.error("Failed to load manual edit commit preview", error);
        const confirmed = window.confirm(
          `${fallbackMessage}\n\nResume will still try to continue from the paused workspace. Continue?`,
        );
        if (!confirmed) {
          return;
        }
      }
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
      setEditableTask(null);
      setEditableTree(null);
      setEditableNodeId("ROOT");
      setEditableDetailExpanded(false);
    }
  };

  const handleRewind = async (commit: SubmissionCommitHistoryEntry) => {
    if (!submissionId) {
      return;
    }
    const nextSubmission = await api.rewindSubmission(submissionId, { commit_oid: commit.oid });
    const targetNodeId = commit.node_id ?? "ROOT";
    editableTreeDirtyRef.current = false;
    visualEventCountRef.current = 0;
    setSubmission(nextSubmission);
    setTraceabilityNodeId(targetNodeId);
    setEditableTask(null);
    setEditableTree(null);
    setActiveTab("canvas");
    setSelectedCommitOid(commit.oid);
    setSelectedNodeId(targetNodeId);
    setEditableNodeId(targetNodeId);
    setEditableReloadToken((current) => current + 1);
    setFocusNodeId(targetNodeId);
    setPulseNodeId(null);
    if (useQuickStartSubmission) {
      quickStart.setSelectedNode(targetNodeId);
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
    if (activeTab !== "diff" || source?.kind === "diff" || sourceLoading || !selectedDiffCommit) {
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
                <Link
                  className="inline-link"
                  to={
                    requirementCatalog === "my_tasks"
                      ? `/playground/my-tasks/${requirementId}`
                      : requirementCatalog === "benchmark"
                      ? `/playground/arc-bench/${taskType}/${requirementId}`
                      : `/playground/task-bank/${taskType}/${requirementId}`
                  }
                >
                  Back to task
                </Link>
              )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page playground-submission-page bg-[var(--bg-deep)] text-[var(--text)]" style={{
      height: "calc(100vh - 60px)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      <div className="gap-1.5 p-2" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <section
          className="action-section submission-status-panel playground-submission-sidebar rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-[0_10px_28px_rgba(15,23,42,0.05)]"
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
                <div className="flex items-start justify-between gap-3">
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
                    className="rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text-dim)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
                    style={{
                      width: "28px",
                      height: "28px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                    aria-label="Collapse left sidebar"
                    title="Collapse left sidebar"
                  >
                    <PanelChevronIcon direction="left" size={14} />
                  </button>
                </div>
              </div>

              <div className="submission-side-toolbar">
                <div className="submission-side-tabs rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
                  <button
                    type="button"
                    className={`submission-side-tab rounded px-3 py-1.5 ${sidebarTab === "status" ? "active" : ""}`}
                    onClick={() => setSidebarTab("status")}
                  >
                    Status
                  </button>
                <button
                  type="button"
                  className={`submission-side-tab rounded px-3 py-1.5 ${sidebarTab === "traceability" ? "active" : ""}`}
                  onClick={() => setSidebarTab("traceability")}
                >
                  Traceability
                </button>
              </div>
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
                      runnerEventLines={logs?.runner_event_lines}
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
            className="submission-sidebar-resizer"
            onMouseDown={onSidebarResizeMouseDown}
          >
            <div className="submission-sidebar-resizer-dot" />
            <div className="submission-sidebar-resizer-dot" />
            <div className="submission-sidebar-resizer-dot" />
          </div>
        ) : null}

        <main className="playground-submission-main-shell rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-[0_10px_28px_rgba(15,23,42,0.05)]" style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: "1px solid var(--border)",
          background: "var(--bg)",
          minWidth: 0,
        }}>
          <div className="doc-tabs bg-[var(--bg)]" style={{ borderBottom: "1px solid var(--border)", padding: "0 16px" }}>
              {[
                { key: "canvas", label: "Canvas" },
                { key: "file", label: "File" },
                { key: "diff", label: "Diff" },
                { key: "results", label: "Test Result" },
                { key: "stdio", label: "Stdout/Stderror" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`doc-tab rounded-t-md ${activeTab === tab.key ? " active" : ""}`}
                  type="button"
                  onClick={() => setActiveTab(tab.key as "canvas" | "file" | "diff" | "results" | "stdio")}
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
                  display: activeTab === "canvas" ? "flex" : "none",
                  flexDirection: "column",
                }}
              >
                <div className="task-flow-toolbar submission-canvas-floating-toolbar">
                  <button
                    type="button"
                    className="icon-tool-btn"
                    title="Zoom out"
                    onClick={() => factoryCanvasRef.current?.zoomOut()}
                  >
                    <MinusOutlined />
                  </button>
                  <button
                    type="button"
                    className="icon-tool-btn"
                    title="Zoom in"
                    onClick={() => factoryCanvasRef.current?.zoomIn()}
                  >
                    <PlusOutlined />
                  </button>
                  <button
                    type="button"
                    className="icon-tool-btn"
                    title="Center graph"
                    onClick={() => factoryCanvasRef.current?.fitView()}
                  >
                    <RadarChartOutlined />
                  </button>
                  <div className="task-flow-toolbar-divider toolbar-divider-right" />
                  <button
                    type="button"
                    className={`icon-tool-btn ${showInterfaces ? "active" : ""}`}
                    title={showInterfaces ? "Hide interfaces" : "Show interfaces"}
                    onClick={() => setShowInterfaces((current) => !current)}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600 }}>IF</span>
                  </button>
                  <button
                    type="button"
                    className={`icon-tool-btn ${showTests ? "active" : ""}`}
                    title={showTests ? "Hide tests" : "Show tests"}
                    onClick={() => setShowTests((current) => !current)}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600 }}>T</span>
                  </button>
                </div>
                <>
                  <div style={{ flex: "1 1 auto", minHeight: 0 }}>
                    <SubmissionFactoryCanvas
                      ref={factoryCanvasRef}
                      key={`factory-canvas:${submissionId}`}
                      tree={pausedCanvasTree ?? tree}
                      taskAssets={submissionTaskAssets}
                      selectedNodeId={factoryCanvasSelectedNodeId}
                      selectionActive={factoryCanvasSelectionActive}
                      onSelectNode={(nodeId) => {
                        setSelectedNodeId(nodeId);
                        setFactorySelectionActive(Boolean(nodeId));
                        setSelectedTraceabilityKind(null);
                        setSelectedTraceabilityId(null);
                        setFocusNodeId(nodeId);
                        setPulseNodeId(null);
                        if (executionPaused) {
                          setEditableNodeId(nodeId);
                        }
                        if (useQuickStartSubmission) {
                          quickStart.setSelectedNode(nodeId);
                        }
                      }}
                      nodeStates={nodeStates}
                      allTraceability={allTraceability}
                      onRequestAllTraceability={() => {
                        void refreshAllTraceability().catch(() => undefined);
                      }}
                      showInterfaces={showInterfaces}
                      showTests={showTests}
                      selectedTraceabilityId={selectedTraceabilityId}
                      selectedTraceabilityKind={selectedTraceabilityKind}
                      onSelectInterface={({ id, requirementNodeId }) => {
                        setFactorySelectionActive(true);
                        const targetNodeId = requirementNodeId ?? pausedCanvasSelectedNodeId ?? activeSelectedNodeId;
                        if (targetNodeId) {
                          setSelectedNodeId(targetNodeId);
                          setFocusNodeId(targetNodeId);
                          if (executionPaused) {
                            setEditableNodeId(targetNodeId);
                          }
                          if (useQuickStartSubmission) {
                            quickStart.setSelectedNode(targetNodeId);
                          }
                        }
                        setSelectedTraceabilityKind("interface");
                        setSelectedTraceabilityId(id);
                        setSidebarTab("traceability");
                      }}
                      onSelectTest={({ id, requirementNodeId }) => {
                        setFactorySelectionActive(true);
                        const targetNodeId = requirementNodeId ?? pausedCanvasSelectedNodeId ?? activeSelectedNodeId;
                        if (targetNodeId) {
                          setSelectedNodeId(targetNodeId);
                          setFocusNodeId(targetNodeId);
                          if (executionPaused) {
                            setEditableNodeId(targetNodeId);
                          }
                          if (useQuickStartSubmission) {
                            quickStart.setSelectedNode(targetNodeId);
                          }
                        }
                        setSelectedTraceabilityKind("test");
                        setSelectedTraceabilityId(id);
                        setSidebarTab("traceability");
                      }}
                    />
                  </div>
                  <div
                    data-quickstart-id="quickstart-submission-node-detail"
                    className={`create-task-detail-drawer detail-placement-bottom ${canvasDetailExpanded ? "expanded" : "collapsed"} ${canvasDetailNode ? "" : "empty"}`}
                  >
                    <div className="create-task-detail-top">
                      <div>
                        {canvasDetailNode ? (
                          <>
                            <strong>{canvasDetailNode.id}</strong>
                            <span>{canvasDetailNode.name}</span>
                          </>
                        ) : (
                          <>
                            <strong>&nbsp;</strong>
                            <span>&nbsp;</span>
                          </>
                        )}
                      </div>
                      <div className="create-task-detail-actions">
                        {canvasDetailNode ? (
                          <div className={`task-node-chip ${canvasDetailNode.type === "ATOMIC" ? "atomic" : "folder"}`}>
                            {canvasDetailNode.type}
                          </div>
                        ) : (
                          <div className="task-node-chip empty">&nbsp;</div>
                        )}
                        <button
                          type="button"
                          className="icon-only-btn"
                          onClick={() => {
                            const nextExpanded = !canvasDetailExpanded;
                            if (executionPaused) {
                              setEditableDetailExpanded(nextExpanded);
                            } else {
                              setDetailExpanded(nextExpanded);
                              if (useQuickStartSubmission) {
                                quickStart.setDetailExpanded(nextExpanded);
                              }
                            }
                          }}
                        >
                          {canvasDetailExpanded ? <DownOutlined /> : <UpOutlined />}
                        </button>
                      </div>
                    </div>
                    {canvasDetailExpanded ? (
                      canvasDetailNode ? (
                        executionPaused ? (
                          <RequirementNodeDetailContent
                            node={canvasDetailNode}
                            mode="editable"
                            taskAssets={submissionTaskAssets}
                            onNodeChange={(updater) => {
                              editableTreeDirtyRef.current = true;
                              setEditableTree((current) => {
                                if (!current) {
                                  return current;
                                }
                                return updateNodeInTree(current, canvasDetailNode.id, updater);
                              });
                            }}
                            onNodeIdChange={(nextNodeId) => {
                              editableTreeDirtyRef.current = true;
                              setEditableNodeId(nextNodeId);
                            }}
                          />
                        ) : (
                          <RequirementNodeDetailContent
                            node={canvasDetailNode}
                            mode="readonly"
                            taskAssets={submissionTaskAssets}
                          />
                        )
                      ) : (
                        <div className="create-task-detail-empty-body" />
                      )
                    ) : null}
                  </div>
                </>
              </div>
            ) : null}
            {activeTab === "canvas" && !tree ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
                Canvas is not available.
              </div>
            ) : null}
            <div style={{ flex: 1, minHeight: 0, display: activeTab === "file" ? "block" : "none" }}>
              <SubmissionFilePanel
                panelMode="workspace"
                source={source}
                loading={sourceLoading}
                error={sourceError}
                diffCommit={selectedDiffCommit}
                diffFiles={selectedDiffCommit?.changed_files ?? []}
                selectedDiffFilePath={selectedDiffFilePath}
                onOpenDiffFile={openCommitDiffFile}
                emptyMessage={filePanelEmptyMessage}
                submissionId={submissionId}
                submission={submission}
                taskType={taskType}
                setSource={setSource}
                refreshCommitHistory={refreshCommitHistory}
                refreshTraceabilityForCurrentView={refreshTraceabilityForCurrentView}
                selectedNodeId={activeSelectedNodeId}
                workspaceRefreshToken={workspaceRefreshToken}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0, display: activeTab === "diff" ? "block" : "none" }}>
              <SubmissionFilePanel
                panelMode="diff"
                source={source}
                loading={sourceLoading}
                error={sourceError}
                diffCommit={selectedDiffCommit}
                diffFiles={selectedDiffCommit?.changed_files ?? []}
                selectedDiffFilePath={selectedDiffFilePath}
                onOpenDiffFile={openCommitDiffFile}
                emptyMessage={diffPanelEmptyMessage}
                submissionId={submissionId}
                submission={submission}
                taskType={taskType}
                setSource={setSource}
                refreshCommitHistory={refreshCommitHistory}
                refreshTraceabilityForCurrentView={refreshTraceabilityForCurrentView}
                selectedNodeId={activeSelectedNodeId}
                workspaceRefreshToken={workspaceRefreshToken}
              />
            </div>
            {activeTab === "results" ? (
              <div className="submission-results-workspace bg-[var(--bg-elevated)]" style={{ padding: "24px", flex: 1, overflow: "auto" }}>
                <SubmissionResultCard submission={submission} />
              </div>
            ) : activeTab === "stdio" ? (
              <div className="stdio-view">
                <div className="doc-tabs bg-[var(--bg)]" style={{ padding: "0 24px", borderBottom: "1px solid var(--border)" }}>
                  <button
                    className={`doc-tab rounded-t-md${stdioTab === "stdout" ? " active" : ""}`}
                    type="button"
                    onClick={() => setStdioTab("stdout")}
                  >
                    Stdout
                  </button>
                  <button
                    className={`doc-tab rounded-t-md${stdioTab === "stderr" ? " active" : ""}`}
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

        <aside className="preview-panel-shell rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-[0_10px_28px_rgba(15,23,42,0.05)]" style={{
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
                  <div className="preview-panel-tabs rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
                    <button
                      type="button"
                      className={`preview-panel-tab rounded px-3 py-1.5 ${previewTab === "preview" ? "active" : ""}`}
                      onClick={() => setPreviewTab("preview")}
                    >
                      Live Preview
                    </button>
                    <button
                      type="button"
                      className={`preview-panel-tab rounded px-3 py-1.5 ${previewTab === "history" ? "active" : ""}`}
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
                  onRewind={submission?.can_rewind
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

