import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import RequirementTreeCanvas from "../components/requirements/RequirementTreeCanvas";
import SubmissionResultCard from "../components/submissions/SubmissionResultCard";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { ApiError, api } from "../lib/api";
import { checkHostDemoPreview, getHostDemoPreviewBase } from "../lib/preview";
import { findNodeById, parseTaskTreeYaml, requirementMarkdownToTree } from "../lib/taskTree";
import type { RequirementDetail, RequirementVisualState, SubmissionDetail, SubmissionLogs, SubmissionVisualEvent } from "../lib/types";
import { useQuickStart } from "../quickstart/QuickStartContext";

type TraceabilityInterfaceType = "UI" | "API" | "FUNC" | "DB";
type TraceabilityTestType = "Unit" | "Integration" | "E2E";

type MockTraceabilityInterface = {
  interface_id: string;
  req_ids: string[];
  type: TraceabilityInterfaceType;
  content: string;
  file_path: string;
  first_line: string;
  implemented: boolean;
  callers: string[];
  callees: string[];
};

type MockTraceabilityTest = {
  test_id: string;
  req_id: string;
  scenario_id: string | null;
  type: TraceabilityTestType;
  file_path: string;
  first_line: string;
};

type MockFileTabItem = {
  id: string;
  path: string;
  kind: "file" | "diff";
  language: string;
  content: string;
};

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

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33 + input.charCodeAt(index)) % 2147483647;
  }
  return Math.abs(hash);
}

function slugTraceabilityKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "root";
}

function buildMockTraceabilityInterfaces(
  requirementId: string,
  nodeId: string,
  nodeName: string,
): MockTraceabilityInterface[] {
  const seed = hashString(`${requirementId}:${nodeId}:${nodeName}`);
  const key = slugTraceabilityKey(nodeName || nodeId);
  const interfaceTypes: TraceabilityInterfaceType[] = ["UI", "API", "FUNC", "DB"];
  const count = nodeId === "ROOT" ? 3 : (seed % 3) + 1;

  return Array.from({ length: count }, (_, index) => {
    const type = interfaceTypes[(seed + index) % interfaceTypes.length];
    const itemKey = `${key}-${index + 1}`;
    const interfaceId = `${nodeId}-IF-${index + 1}`;
    const filePathByType: Record<TraceabilityInterfaceType, string> = {
      UI: `frontend/src/pages/${key}/view-${index + 1}.tsx`,
      API: `frontend/src/api/${key}.ts`,
      FUNC: `backend/src/services/${key}_service.ts`,
      DB: `backend/src/database/${key}_repo.ts`,
    };
    const contentByType: Record<TraceabilityInterfaceType, string> = {
      UI: `${nodeName} panel renders the primary interaction surface and input controls.`,
      API: `${index % 2 === 0 ? "GET" : "POST"} /api/${slugTraceabilityKey(requirementId)}/${itemKey}`,
      FUNC: `${key.replace(/-/g, "_")}_${index + 1}(payload)`,
      DB: `${key}_${index + 1} table access for ${nodeId} persistence and query flow.`,
    };

    return {
      interface_id: interfaceId,
      req_ids: [nodeId],
      type,
      content: contentByType[type],
      file_path: filePathByType[type],
      first_line: `${20 + ((seed + index * 17) % 120)}`,
      implemented: ((seed + index) % 5) !== 0,
      callers: index === 0 ? [] : [`${nodeId}-IF-${index}`],
      callees: index === count - 1 ? [] : [`${nodeId}-IF-${index + 2}`],
    };
  });
}

function buildMockTraceabilityTests(
  requirementId: string,
  nodeId: string,
  nodeName: string,
): MockTraceabilityTest[] {
  const seed = hashString(`test:${requirementId}:${nodeId}:${nodeName}`);
  const count = nodeId === "ROOT" ? 2 : ((seed % 2) + 1);
  const key = slugTraceabilityKey(nodeName || nodeId);
  const testTypes: TraceabilityTestType[] = ["Integration", "E2E", "Unit"];

  return Array.from({ length: count }, (_, index) => {
    const type = testTypes[(seed + index) % testTypes.length];
    return {
      test_id: `${nodeId}-TEST-${index + 1}`,
      req_id: nodeId,
      scenario_id: nodeId === "ROOT" ? null : `${nodeId}-SCN-${index + 1}`,
      type,
      file_path: `arc-bench/webapp/tests/${requirementId}/${nodeId.toLowerCase()}-${index + 1}.spec.ts`,
      first_line: `${12 + ((seed + index * 13) % 90)}`,
    };
  });
}

function TraceabilityPanel({
  requirementId,
  nodeId,
  nodeName,
}: {
  requirementId: string;
  nodeId: string | null;
  nodeName: string | null;
}) {
  const traceabilityData = useMemo(() => {
    if (!nodeId || !nodeName) {
      return null;
    }
    return {
      interfaces: buildMockTraceabilityInterfaces(requirementId, nodeId, nodeName),
      tests: buildMockTraceabilityTests(requirementId, nodeId, nodeName),
    };
  }, [nodeId, nodeName, requirementId]);

  if (!traceabilityData || !nodeId || !nodeName) {
    return (
      <div className="traceability-empty-state">
        Select a requirement node on the canvas to inspect its linked interfaces and tests.
      </div>
    );
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
          <span>{traceabilityData.interfaces.length}</span>
        </div>
        <div className="traceability-card-list">
          {traceabilityData.interfaces.map((item) => (
            <article key={item.interface_id} className="traceability-card">
              <div className="traceability-card-top">
                <div>
                  <div className="traceability-card-id">{item.interface_id}</div>
                  <div className="traceability-card-path">{item.file_path}:{item.first_line}</div>
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
          <span>{traceabilityData.tests.length}</span>
        </div>
        <div className="traceability-card-list">
          {traceabilityData.tests.map((item) => (
            <article key={item.test_id} className="traceability-card">
              <div className="traceability-card-top">
                <div>
                  <div className="traceability-card-id">{item.test_id}</div>
                  <div className="traceability-card-path">{item.file_path}:{item.first_line}</div>
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

function buildMockFileItems(
  requirementTitle: string,
  submissionName: string,
  selectedNodeId: string | null,
): MockFileTabItem[] {
  const focusLabel = selectedNodeId ?? "ROOT";
  return [
    {
      id: "frontend-page",
      path: "frontend/src/pages/HomePage.tsx",
      kind: "file",
      language: "tsx",
      content: `export default function HomePage() {
  return (
    <main className="workspace-home">
      <section data-focus-node="${focusLabel}">
        <h1>${requirementTitle}</h1>
        <p>Submission: ${submissionName}</p>
      </section>
    </main>
  );
}
`,
    },
    {
      id: "backend-route",
      path: "backend/src/routes/search.ts",
      kind: "file",
      language: "ts",
      content: `import { Router } from "express";

const router = Router();

router.get("/api/search", async (_request, response) => {
  response.json({
    requirementNode: "${focusLabel}",
    status: "mocked",
  });
});

export default router;
`,
    },
    {
      id: "git-diff",
      path: "git diff -- frontend/src/pages/HomePage.tsx",
      kind: "diff",
      language: "diff",
      content: `diff --git a/frontend/src/pages/HomePage.tsx b/frontend/src/pages/HomePage.tsx
index 8f2a1c1..af321f0 100644
--- a/frontend/src/pages/HomePage.tsx
+++ b/frontend/src/pages/HomePage.tsx
@@ -12,7 +12,11 @@ export default function HomePage() {
   return (
     <main className="workspace-home">
-      <section>
+      <section data-focus-node="${focusLabel}">
+        <header className="workspace-banner">
+          <span>Tracing ${focusLabel}</span>
+        </header>
         <h1>${requirementTitle}</h1>
+        <p>Submission: ${submissionName}</p>
       </section>
     </main>
   );
`,
    },
  ];
}

function SubmissionFilePanel({
  requirementTitle,
  submissionName,
  selectedNodeId,
}: {
  requirementTitle: string;
  submissionName: string;
  selectedNodeId: string | null;
}) {
  const fileItems = useMemo(
    () => buildMockFileItems(requirementTitle, submissionName, selectedNodeId),
    [requirementTitle, selectedNodeId, submissionName],
  );
  const [activeFileId, setActiveFileId] = useState(fileItems[0]?.id ?? "");

  useEffect(() => {
    if (!fileItems.some((item) => item.id === activeFileId)) {
      setActiveFileId(fileItems[0]?.id ?? "");
    }
  }, [activeFileId, fileItems]);

  const activeFile = fileItems.find((item) => item.id === activeFileId) ?? fileItems[0] ?? null;

  if (!activeFile) {
    return <div className="ide-empty-state">No files available.</div>;
  }

  return (
    <div className="ide-shell">
      <aside className="ide-sidebar">
        <div className="ide-sidebar-title">Workspace</div>
        <div className="ide-file-list">
          {fileItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ide-file-item ${item.id === activeFile.id ? "active" : ""}`}
              onClick={() => setActiveFileId(item.id)}
            >
              <span className={`ide-file-kind kind-${item.kind}`}>{item.kind === "diff" ? "DIFF" : item.language.toUpperCase()}</span>
              <span className="ide-file-path">{item.path}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="ide-editor">
        <div className="ide-editor-topbar">
          <div className="ide-window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="ide-editor-title">{activeFile.path}</div>
          <div className="ide-editor-badge">{activeFile.kind === "diff" ? "Git Diff" : activeFile.language.toUpperCase()}</div>
        </div>
        <pre className={`ide-code-view ${activeFile.kind === "diff" ? "is-diff" : ""}`}>
          <code>{activeFile.content}</code>
        </pre>
      </section>
    </div>
  );
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
  const pollRef = useRef<number | null>(null);
  const seenVisualKeysRef = useRef<Set<string>>(new Set());
  const isSidebarDragging = useRef(false);
  const sidebarDragStartX = useRef(0);
  const sidebarDragStartWidth = useRef(0);
  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewFrameVersion, setPreviewFrameVersion] = useState(0);
  const quickStart = useQuickStart();
  const useQuickStartSubmission = quickStart.active && quickStart.isSubmissionRouteMatch(submissionId);
  const previewUrl = getHostDemoPreviewBase();
  const previewFrameUrl = `${previewUrl}?refresh=${previewFrameVersion}`;
  const previewPanelWidth = previewMinimized ? "80px" : "33.333vw";

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
  }, [submissionId]);

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
    if (useQuickStartSubmission && quickStart.canvasDemo.active) {
      return quickStart.canvasDemo.nodeStates;
    }
    const nextState: Record<string, RequirementVisualState> = {};
    for (const event of logs?.visual_events ?? []) {
      nextState[event.node_id] = toVisualState(event);
    }
    return nextState;
  }, [logs, quickStart.canvasDemo.active, quickStart.canvasDemo.nodeStates, useQuickStartSubmission]);

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

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onSidebarResizeMouseMove);
      document.removeEventListener("mouseup", onSidebarResizeMouseUp);
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
                    requirementId={requirementId}
                    nodeId={selectedNode?.id ?? selectedNodeId}
                    nodeName={selectedNode?.name ?? null}
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
          background: "white",
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
            ) : activeTab === "file" ? (
              <SubmissionFilePanel
                requirementTitle={requirement.title}
                submissionName={submission.display_name || submission.id}
                selectedNodeId={selectedNode?.id ?? selectedNodeId}
              />
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

        <aside style={{
          width: previewPanelWidth,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "white",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.06)",
          transition: "width 0.24s ease",
          flexShrink: 0,
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
                  <button
                    type="button"
                    onClick={() => {
                      void refreshPreview();
                    }}
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
                      border: "1px solid #e2e8f0",
                      background: "white",
                      cursor: "pointer",
                    }}
                    onMouseOver={(buttonEvent) => {
                      buttonEvent.currentTarget.style.color = "#3b82f6";
                      buttonEvent.currentTarget.style.background = "#eff6ff";
                      buttonEvent.currentTarget.style.borderColor = "#bfdbfe";
                    }}
                    onMouseOut={(buttonEvent) => {
                      buttonEvent.currentTarget.style.color = "#64748b";
                      buttonEvent.currentTarget.style.background = "white";
                      buttonEvent.currentTarget.style.borderColor = "#e2e8f0";
                    }}
                  >
                    {previewAvailable ? "Refresh" : "Retry"}
                  </button>
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
