import {
  ArrowLeftOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { message, Modal } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import MarkdownTocDocument from "../components/requirements/MarkdownTocDocument";
import RequirementNodeDetailContent from "../components/requirements/RequirementNodeDetailContent";
import RequirementTreeCanvas from "../components/requirements/RequirementTreeCanvas";
import { api } from "../lib/api";
import {
  appendChildNode,
  appendSiblingNode,
  buildNewChildNode,
  createDefaultTaskTree,
  findNodeById,
  findParentNode,
  parseTaskTreeYaml,
  reindexRequirementTree,
  removeNodeFromTree,
  RequirementNode,
  summarizeTaskTree,
  taskTreeToMarkdown,
  taskTreeToYaml,
  updateNodeInTree,
} from "../lib/taskTree";
import type { SubmissionTaskAssets, UserTaskDraft } from "../lib/types";

type CreateTaskFormState = {
  title: string;
  taskType: "web" | "mobile" | "kernel" | "mixed" | "cli";
};

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeRequirementNodeTypes(node: RequirementNode): RequirementNode {
  const children = node.children.map((child) => normalizeRequirementNodeTypes(child));
  return {
    ...node,
    type: children.length > 0 ? "FOLDER" : "ATOMIC",
    children,
  };
}

function collectDependencyOptions(node: RequirementNode, bucket: Array<{ id: string; name: string }>) {
  bucket.push({ id: node.id, name: node.name });
  node.children.forEach((child) => collectDependencyOptions(child, bucket));
}

function serializeTaskPayload(payload: {
  title: string;
  task_type: "web" | "mobile" | "kernel" | "mixed" | "cli";
  summary: string;
  root_requirement_id: string;
  node_count: number;
  atomic_count: number;
  yaml_content: string;
  markdown_content: string;
}) {
  return JSON.stringify(payload);
}

const toolbarButtonClassName =
  "btn-outline create-task-toolbar-btn h-9 rounded-lg border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-medium text-[var(--text-dim)] shadow-none transition hover:border-[var(--accent)] hover:bg-[var(--accent-glow)] hover:text-[var(--accent)]";

const toolbarPrimaryClassName =
  "btn-primary create-task-toolbar-primary h-9 min-w-[110px] rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--bg-deep)] shadow-none transition hover:border-[var(--accent-grad-end)] hover:bg-[var(--accent-grad-end)] hover:shadow-none";

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const { user } = useAuth();
  const [modal, modalContextHolder] = Modal.useModal();
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveHydratedRef = useRef(false);
  const initialPreviewWidth =
    typeof window === "undefined"
      ? 560
      : Math.max(360, Math.min(Math.round(window.innerWidth * 0.68), Math.round(window.innerWidth * 0.4)));
  const [tree, setTree] = useState<RequirementNode>(createDefaultTaskTree);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("ROOT");
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(initialPreviewWidth);
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  const [taskDraft, setTaskDraft] = useState<UserTaskDraft | null>(null);
  const [showInterfaces, setShowInterfaces] = useState(false);
  const [showTests, setShowTests] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [createForm, setCreateForm] = useState<CreateTaskFormState>({
    title: "My Custom Task",
    taskType: "web",
  });
  const savedTaskSignatureRef = useRef<string | null>(null);

  const isEditingTask = Boolean(taskId);
  const markdown = useMemo(() => taskTreeToMarkdown(tree), [tree]);
  const yamlContent = useMemo(() => taskTreeToYaml(tree), [tree]);
  const stats = useMemo(() => summarizeTaskTree(tree), [tree]);
  const selectedNode = useMemo(() => (selectedNodeId ? findNodeById(tree, selectedNodeId) : null), [selectedNodeId, tree]);
  const dependencyOptions = useMemo(() => {
    const bucket: Array<{ id: string; name: string }> = [];
    collectDependencyOptions(tree, bucket);
    return bucket;
  }, [tree]);
  const taskAssets = useMemo<SubmissionTaskAssets>(() => ({
    assets_base_url: "",
    references_base_url: isEditingTask && taskId
      ? `/api/my-tasks/${taskId}/reference/`
      : (taskDraft?.references_base_url ?? ""),
  }), [isEditingTask, taskDraft, taskId]);
  const autosaveLabel = useMemo(() => {
    if (!user) {
      return "Sign in to enable autosave";
    }
    if (isEditingTask) {
      if (autosaveState === "saving") {
        return "Saving task...";
      }
      if (autosaveState === "saved") {
        return "Manual save mode";
      }
      if (autosaveState === "error") {
        return "Save failed";
      }
      return "Manual save mode";
    }
    if (!isEditingTask && !taskDraft) {
      return "Preparing autosave...";
    }
    if (autosaveState === "saving") {
      return "Saving draft...";
    }
    if (autosaveState === "saved") {
      return "Draft saved";
    }
    if (autosaveState === "error") {
      return "Draft autosave failed";
    }
    return "Autosave ready";
  }, [autosaveState, isEditingTask, taskDraft, user]);

  const buildTaskPayload = () => ({
    title: createForm.title.trim(),
    task_type: createForm.taskType,
    summary: tree.description,
    root_requirement_id: tree.id,
    node_count: stats.nodeCount,
    atomic_count: stats.atomicCount,
    yaml_content: yamlContent,
    markdown_content: markdown,
  });
  const currentTaskSignature = useMemo(() => serializeTaskPayload(buildTaskPayload()), [
    createForm.title,
    createForm.taskType,
    markdown,
    stats.atomicCount,
    stats.nodeCount,
    tree.description,
    tree.id,
    yamlContent,
  ]);
  const hasUnsavedTaskChanges = isEditingTask && savedTaskSignatureRef.current !== null && savedTaskSignatureRef.current !== currentTaskSignature;

  useEffect(() => {
    if (!user) {
      autosaveHydratedRef.current = false;
      setTaskDraft(null);
      savedTaskSignatureRef.current = null;
      setAutosaveState("idle");
      return;
    }

    let cancelled = false;
    autosaveHydratedRef.current = false;
    setTree(createDefaultTaskTree());
    setSelectedNodeId("ROOT");
    setDetailExpanded(true);

    const hydrate = async () => {
      if (taskId) {
        const task = await api.getMyTask(taskId);
        if (cancelled) {
          return;
        }
        const nextTree = task.yaml_content.trim()
          ? normalizeRequirementNodeTypes(parseTaskTreeYaml(task.yaml_content))
          : createDefaultTaskTree();
        const nextStats = summarizeTaskTree(nextTree);
        setTaskDraft(null);
        setCreateForm({
          title: task.title || "My Custom Task",
          taskType: task.task_type,
        });
        setTree(nextTree);
        setSelectedNodeId("ROOT");
        setDetailExpanded(true);
        savedTaskSignatureRef.current = serializeTaskPayload({
          title: (task.title || "My Custom Task").trim(),
          task_type: task.task_type,
          summary: nextTree.description,
          root_requirement_id: nextTree.id,
          node_count: nextStats.nodeCount,
          atomic_count: nextStats.atomicCount,
          yaml_content: taskTreeToYaml(nextTree),
          markdown_content: taskTreeToMarkdown(nextTree),
        });
        setAutosaveState("saved");
        return;
      }

      const draft = await api.createMyTaskDraft();
      if (cancelled) {
        return;
      }
      setTaskDraft(draft);
      setCreateForm({
        title: draft.title || "My Custom Task",
        taskType: draft.task_type,
      });
      if (draft.yaml_content.trim()) {
        try {
          const nextTree = normalizeRequirementNodeTypes(parseTaskTreeYaml(draft.yaml_content));
          setTree(nextTree);
          setSelectedNodeId("ROOT");
          setDetailExpanded(true);
        } catch (error) {
          message.warning(`Draft restore failed: ${(error as Error).message}`);
        }
      }
      setAutosaveState("saved");
    };

    hydrate()
      .catch(() => {
        if (!cancelled) {
          setAutosaveState("error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          autosaveHydratedRef.current = true;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, user]);

  useEffect(() => {
    if (!isResizingPreview) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const viewportWidth = window.innerWidth;
      const nextWidth = Math.max(360, Math.min(Math.round(viewportWidth * 0.68), event.clientX));
      setPreviewCollapsed(false);
      setPreviewWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsResizingPreview(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizingPreview]);

  useEffect(() => {
    if (!user || !autosaveHydratedRef.current) {
      return;
    }
    if (isEditingTask || !taskDraft) {
      return;
    }

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      setAutosaveState("saving");
      const savePromise = api.saveMyTaskDraft(taskDraft.draft_id, {
        title: createForm.title,
        task_type: createForm.taskType,
        yaml_content: yamlContent,
        markdown_content: markdown,
      }).then((savedDraft) => {
        setTaskDraft((current) => (current ? { ...current, ...savedDraft } : savedDraft));
      });

      void savePromise
        .then(() => {
          setAutosaveState("saved");
        })
        .catch(() => {
          setAutosaveState("error");
        });
    }, 900);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    createForm.taskType,
    createForm.title,
    isEditingTask,
    markdown,
    taskDraft?.draft_id,
    user,
    yamlContent,
  ]);

  const updateSelectedNode = (updater: (node: RequirementNode) => RequirementNode) => {
    if (!selectedNode) {
      return;
    }
    setTree((current) => normalizeRequirementNodeTypes(updateNodeInTree(current, selectedNode.id, updater)));
  };

  const handleUploadFile = async (file: File) => {
    try {
      const content = await file.text();
      const nextTree = normalizeRequirementNodeTypes(parseTaskTreeYaml(content));
      setTree(nextTree);
      setSelectedNodeId(null);
      setDetailExpanded(false);
      message.success("YAML imported.");
    } catch (error) {
      message.error(`YAML import failed: ${(error as Error).message}`);
    }
  };

  const handleExport = async () => {
    if (isEditingTask) {
      message.warning("Export bundle is only available from the draft page.");
      return;
    }
    if (!user || !taskDraft) {
      message.warning("Sign in to export the full requirement bundle.");
      return;
    }
    try {
      setAutosaveState("saving");
      await api.saveMyTaskDraft(taskDraft.draft_id, {
        title: createForm.title,
        task_type: createForm.taskType,
        yaml_content: yamlContent,
        markdown_content: markdown,
      });
      const bundle = await api.downloadMyTaskDraftBundle(taskDraft.draft_id);
      downloadFile(bundle);
      setAutosaveState("saved");
      message.success("Requirement bundle exported.");
    } catch (error) {
      setAutosaveState("error");
      message.error((error as Error).message);
    }
  };

  const handleAddChild = () => {
    const parent = selectedNode ?? tree;
    const child: RequirementNode = {
      ...buildNewChildNode(parent),
      type: "ATOMIC",
      scenarios: [{ name: "New scenario", steps: [] }],
    };
    setTree((current) => normalizeRequirementNodeTypes(appendChildNode(current, parent.id, child)));
    setSelectedNodeId(child.id);
    setDetailExpanded(true);
  };

  const handleAddSibling = () => {
    if (!selectedNode || selectedNode.id === "ROOT") {
      message.warning("Select a non-root node to add a sibling.");
      return;
    }
    const parentNode = findParentNode(tree, selectedNode.id);
    if (!parentNode) {
      message.warning("Parent node not found.");
      return;
    }
    const sibling: RequirementNode = {
      ...buildNewChildNode(parentNode),
      name: "New sibling node",
      type: "ATOMIC",
      scenarios: [{ name: "New scenario", steps: [] }],
    };
    setTree((current) => normalizeRequirementNodeTypes(appendSiblingNode(current, selectedNode.id, sibling)));
    setSelectedNodeId(sibling.id);
    setDetailExpanded(true);
  };

  const handleDeleteNode = () => {
    if (!selectedNode || selectedNode.id === "ROOT") {
      message.warning("Root chapter cannot be deleted.");
      return;
    }
    setTree((current) => normalizeRequirementNodeTypes(removeNodeFromTree(current, selectedNode.id)));
    setSelectedNodeId(null);
    setDetailExpanded(false);
  };

  const handleReindexIds = () => {
    const { tree: reindexedTree, idMap } = reindexRequirementTree(tree);
    setTree(normalizeRequirementNodeTypes(reindexedTree));
    setSelectedNodeId((current) => (current ? (idMap[current] ?? current) : current));
    message.success("Requirement IDs reindexed.");
  };

  const handleConnectDependency = (sourceId: string, targetId: string) => {
    setTree((current) => normalizeRequirementNodeTypes(updateNodeInTree(current, sourceId, (node) => ({
      ...node,
      dependencies: Array.from(new Set([...node.dependencies, targetId])).filter((dependency) => dependency !== sourceId),
    }))));
    setSelectedNodeId(sourceId);
    setDetailExpanded(true);
    message.success(`Dependency added: ${sourceId} -> ${targetId}`);
  };

  const handleUploadDescriptionAttachment = async (file: File) => {
    if (taskId) {
      const uploaded = await api.uploadMyTaskReference(taskId, file);
      return uploaded.relative_path;
    }

    let draft = taskDraft;
    if (!draft) {
      draft = await api.createMyTaskDraft();
      setTaskDraft(draft);
    }
    const uploaded = await api.uploadMyTaskDraftReference(draft.draft_id, file);
    return uploaded.relative_path;
  };

  const handleDeleteDescriptionAttachment = async (relativePath: string) => {
    if (taskId) {
      await api.deleteMyTaskReference(taskId, relativePath);
      return;
    }

    let draft = taskDraft;
    if (!draft) {
      draft = await api.createMyTaskDraft();
      setTaskDraft(draft);
    }
    await api.deleteMyTaskDraftReference(draft.draft_id, relativePath);
  };

  const handleSaveTask = async () => {
    if (!user) {
      navigate("/login", { state: { from: taskId ? `/playground/my-tasks/${taskId}/edit` : "/playground/create-task" } });
      return;
    }
    if (!createForm.title.trim()) {
      message.error("Task name is required.");
      return;
    }

    try {
      setSavingTask(true);
      const taskPayload = buildTaskPayload();
      const savedTask = taskId
        ? await api.updateMyTask(taskId, taskPayload)
        : await api.createMyTask({
          ...taskPayload,
          draft_id: taskDraft?.draft_id ?? null,
        });
      savedTaskSignatureRef.current = serializeTaskPayload(taskPayload);
      setAutosaveState("saved");
      message.success(taskId ? "Task updated." : "Task saved.");
      setIsSaveModalOpen(false);
      navigate(`/playground/my-tasks/${savedTask.id}/edit`);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSavingTask(false);
    }
  };

  const handleReturnToTask = () => {
    if (!taskId) {
      return;
    }
    const proceed = () => navigate(`/playground/my-tasks/${taskId}`);
    if (!hasUnsavedTaskChanges) {
      proceed();
      return;
    }
    modal.confirm({
      title: "Unsaved changes",
      content: "This task has unsaved changes. Continue and leave the editor?",
      okText: "Leave Editor",
      cancelText: "Stay",
      onOk: proceed,
    });
  };

  return (
    <div className="page create-task-page create-task-page-locked bg-[var(--bg-deep)] text-[var(--text)]">
      {modalContextHolder}
      <div className="create-task-shell create-task-shell-locked gap-4 overflow-hidden p-4 [background:var(--bg-deep)]">
        <div className="create-task-topbar rounded-xl border border-[var(--border)] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.06)] [background:var(--bg)]">
          <div className="create-task-topbar-actions">
            <span className="task-node-chip border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-dim)]">
              {autosaveLabel}
            </span>
            {isEditingTask ? (
              <button type="button" className={toolbarButtonClassName} onClick={handleReturnToTask}>
                <ArrowLeftOutlined /> Back to Task
              </button>
            ) : null}
            <button
              type="button"
              className={toolbarButtonClassName}
              onClick={() => setPreviewCollapsed((current) => !current)}
            >
              {previewCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              {previewCollapsed ? "Show Preview" : "Hide Preview"}
            </button>
            <button type="button" className={toolbarButtonClassName} onClick={() => uploadRef.current?.click()}>
              <UploadOutlined /> Import YAML
            </button>
            <button type="button" className={toolbarButtonClassName} onClick={handleExport}>
              <SaveOutlined /> Export Docs
            </button>
            <button type="button" className={toolbarPrimaryClassName} onClick={() => setIsSaveModalOpen(true)}>
              {isEditingTask ? "Save" : "Save Task"}
            </button>
            <input
              ref={uploadRef}
              className="visually-hidden"
              type="file"
              accept=".yaml,.yml"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleUploadFile(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        <div
          className={`create-task-layout create-task-layout-locked !h-auto !min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--border)] shadow-[0_8px_24px_rgba(0,0,0,0.06)] [background:var(--bg)]${previewCollapsed ? " preview-collapsed" : ""}`}
          style={{ gridTemplateColumns: previewCollapsed ? "0 16px minmax(420px, 1fr)" : `${previewWidth}px 16px minmax(420px, 1fr)` }}
        >
          <section className={`readme-panel create-task-preview-panel create-task-preview-panel-locked border-r border-[var(--border)] [background:var(--bg)]${previewCollapsed ? " collapsed" : ""}`}>
            <MarkdownTocDocument
              markdown={markdown}
              assetsBaseUrl=""
              referencesBaseUrl={taskAssets.references_base_url}
              tocTree={tree}
              tocTitle="Contents"
              bodyClassName="playground-readme-body"
              tocClassName="playground-readme-toc create-task-preview-toc"
              scrollClassName="playground-readme-scroll create-task-preview-scroll"
            />
          </section>

          <div
            className={`create-task-resizer [background:var(--bg-elevated)]${previewCollapsed ? " collapsed" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview panel"
            onPointerDown={(event) => {
              if (window.innerWidth <= 820) {
                return;
              }
              event.preventDefault();
              setIsResizingPreview(true);
            }}
          >
            <span className="create-task-resizer-handle" />
          </div>

          <section className="create-task-editor-panel create-task-editor-panel-locked [background:var(--bg)]">
            <RequirementTreeCanvas
              tree={tree}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => {
                setSelectedNodeId(nodeId);
                setDetailExpanded(Boolean(nodeId));
              }}
              detailExpanded={detailExpanded}
              onDetailExpandedChange={setDetailExpanded}
              mode="editable"
              detailPlacement="right"
              showDetailToggle={false}
              showTraceabilityToolbarToggles={false}
              onAddChild={handleAddChild}
              onAddSibling={handleAddSibling}
              onDeleteNode={handleDeleteNode}
              onReindexIds={handleReindexIds}
              onConnectDependency={handleConnectDependency}
              taskAssets={taskAssets}
              autoFitOnTreeChange={false}
              showInterfaces={showInterfaces}
              showTests={showTests}
              onShowInterfacesChange={setShowInterfaces}
              onShowTestsChange={setShowTests}
              renderDetailContent={(node) => (
                <RequirementNodeDetailContent
                  node={node}
                  mode="editable"
                  onNodeChange={updateSelectedNode}
                  onNodeIdChange={setSelectedNodeId}
                  taskAssets={taskAssets}
                  onDescriptionAttachmentUpload={handleUploadDescriptionAttachment}
                  onDescriptionAttachmentDelete={handleDeleteDescriptionAttachment}
                  dependencyOptions={dependencyOptions}
                  showTypeField={false}
                />
              )}
            />
          </section>
        </div>
      </div>

      <Modal
        open={isSaveModalOpen}
        title={isEditingTask ? "Update Task" : "Save Task"}
        okText={isEditingTask ? "Update Task" : "Save Task"}
        onOk={() => void handleSaveTask()}
        onCancel={() => setIsSaveModalOpen(false)}
        confirmLoading={savingTask}
      >
        <div className="modal-form-stack">
          {isEditingTask ? (
            <div className="inline-alert">
              Update this task with the current requirement tree and metadata.
            </div>
          ) : null}
          <label className="field-stack">
            <span>Task Name</span>
            <input
              className="text-input"
              value={createForm.title}
              onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label className="field-stack">
            <span>Task Type</span>
            <select
              className="text-input"
              value={createForm.taskType}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, taskType: event.target.value as CreateTaskFormState["taskType"] }))
              }
            >
              <option value="web">Web</option>
              <option value="mobile">Mobile</option>
              <option value="kernel">Kernel</option>
              <option value="mixed">Mixed</option>
              <option value="cli">CLI</option>
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
