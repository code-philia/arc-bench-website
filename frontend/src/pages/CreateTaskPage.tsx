import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { message, Modal } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import MarkdownTocDocument from "../components/requirements/MarkdownTocDocument";
import RequirementNodeDetailContent from "../components/requirements/RequirementNodeDetailContent";
import RequirementTreeCanvas from "../components/requirements/RequirementTreeCanvas";
import { api } from "../lib/api";
import {
  appendSiblingNode,
  appendChildNode,
  buildNewChildNode,
  createDefaultTaskTree,
  findNodeById,
  findParentNode,
  parseTaskTreeYaml,
  removeNodeFromTree,
  reindexRequirementTree,
  RequirementNode,
  summarizeTaskTree,
  taskTreeToMarkdown,
  taskTreeToYaml,
  updateNodeInTree,
} from "../lib/taskTree";
import type { SubmissionTaskAssets, UserTaskDraft } from "../lib/types";

type CreateTaskFormState = {
  title: string;
  taskType: "web" | "mobile" | "kernel" | "mixed";
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

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
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

  const markdown = useMemo(() => taskTreeToMarkdown(tree), [tree]);
  const yamlContent = useMemo(() => taskTreeToYaml(tree), [tree]);
  const stats = useMemo(() => summarizeTaskTree(tree), [tree]);
  const selectedNode = useMemo(() => (selectedNodeId ? findNodeById(tree, selectedNodeId) : null), [selectedNodeId, tree]);
  const dependencyOptions = useMemo(() => {
    const bucket: Array<{ id: string; name: string }> = [];
    collectDependencyOptions(tree, bucket);
    return bucket;
  }, [tree]);
  const draftTaskAssets = useMemo<SubmissionTaskAssets>(() => ({
    assets_base_url: "",
    references_base_url: taskDraft?.references_base_url ?? "",
  }), [taskDraft]);
  const autosaveLabel = useMemo(() => {
    if (!user) {
      return "Sign in to enable autosave";
    }
    if (!taskDraft) {
      return "Preparing autosave...";
    }
    if (autosaveState === "saving") {
      return "Saving draft...";
    }
    if (autosaveState === "saved") {
      return "Draft saved";
    }
    if (autosaveState === "error") {
      return "Autosave failed";
    }
    return "Autosave ready";
  }, [autosaveState, taskDraft, user]);

  useEffect(() => {
    if (!user) {
      autosaveHydratedRef.current = false;
      setTaskDraft(null);
      setAutosaveState("idle");
      return;
    }
    let cancelled = false;
    autosaveHydratedRef.current = false;
    api.createMyTaskDraft()
      .then((draft) => {
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
      })
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
  }, [user]);

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
    if (!user || !taskDraft || !autosaveHydratedRef.current) {
      return;
    }
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      setAutosaveState("saving");
      void api.saveMyTaskDraft(taskDraft.draft_id, {
        title: createForm.title,
        task_type: createForm.taskType,
        yaml_content: yamlContent,
        markdown_content: markdown,
      }).then((savedDraft) => {
        setTaskDraft((current) => current ? { ...current, ...savedDraft } : savedDraft);
        setAutosaveState("saved");
      }).catch(() => {
        setAutosaveState("error");
      });
    }, 900);
    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [createForm.taskType, createForm.title, markdown, taskDraft?.draft_id, user, yamlContent]);

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

  const handleSave = async () => {
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

  const handleUploadDescriptionImage = async (file: File) => {
    let draft = taskDraft;
    if (!draft) {
      draft = await api.createMyTaskDraft();
      setTaskDraft(draft);
    }
    const uploaded = await api.uploadMyTaskDraftReference(draft.draft_id, file);
    return uploaded.relative_path;
  };

  const handleCreateTask = async () => {
    if (!user) {
      navigate("/login", { state: { from: "/playground/create-task" } });
      return;
    }
    if (!createForm.title.trim()) {
      message.error("Task name is required.");
      return;
    }

    try {
      setCreating(true);
      const created = await api.createMyTask({
        title: createForm.title.trim(),
        task_type: createForm.taskType,
        summary: tree.description,
        root_requirement_id: tree.id,
        node_count: stats.nodeCount,
        atomic_count: stats.atomicCount,
        yaml_content: yamlContent,
        markdown_content: markdown,
        draft_id: taskDraft?.draft_id ?? null,
      });
      message.success("Task created.");
      setIsCreateModalOpen(false);
      navigate(`/playground/my-tasks/${created.id}`);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page create-task-page create-task-page-locked">
      <div className="create-task-shell create-task-shell-locked">
        <div className="create-task-topbar">
          <div className="create-task-topbar-copy">
            <div className="breadcrumb">
              <span>Playground</span>
              <span className="sep">/</span>
              <span>Create Task</span>
              <span className="sep">/</span>
              <span className="current">{createForm.title || tree.name}</span>
            </div>
            <div className="create-task-topbar-meta">
              <span className="task-node-chip folder">{createForm.taskType.toUpperCase()}</span>
              <span className="task-node-chip">{stats.nodeCount} Nodes</span>
              <span className="task-node-chip atomic">{stats.atomicCount} Atomic</span>
            </div>
          </div>
          <div className="create-task-topbar-actions">
            <span className="task-node-chip">{autosaveLabel}</span>
            <button
              type="button"
              className="btn-outline create-task-toolbar-btn"
              onClick={() => setPreviewCollapsed((current) => !current)}
            >
              {previewCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              {previewCollapsed ? "Show Preview" : "Hide Preview"}
            </button>
            <button type="button" className="btn-outline create-task-toolbar-btn" onClick={() => uploadRef.current?.click()}>
              <UploadOutlined /> Import YAML
            </button>
            <button type="button" className="btn-outline create-task-toolbar-btn" onClick={handleSave}>
              <SaveOutlined /> Export Docs
            </button>
            <button type="button" className="btn-primary create-task-toolbar-primary" onClick={() => setIsCreateModalOpen(true)}>
              Create Task
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
          className={`create-task-layout create-task-layout-locked${previewCollapsed ? " preview-collapsed" : ""}`}
          style={{ gridTemplateColumns: previewCollapsed ? "0 12px minmax(420px, 1fr)" : `${previewWidth}px 12px minmax(420px, 1fr)` }}
        >
          <section className={`readme-panel create-task-preview-panel create-task-preview-panel-locked${previewCollapsed ? " collapsed" : ""}`}>
            <MarkdownTocDocument
              markdown={markdown}
              assetsBaseUrl=""
              referencesBaseUrl={taskDraft?.references_base_url ?? ""}
              tocTitle="Contents"
              bodyClassName="playground-readme-body"
              tocClassName="playground-readme-toc create-task-preview-toc"
              scrollClassName="playground-readme-scroll create-task-preview-scroll"
            />
          </section>

          <div
            className={`create-task-resizer${previewCollapsed ? " collapsed" : ""}`}
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

          <section className="create-task-editor-panel create-task-editor-panel-locked">
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
              taskAssets={draftTaskAssets}
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
                  taskAssets={draftTaskAssets}
                  onDescriptionImageUpload={handleUploadDescriptionImage}
                  dependencyOptions={dependencyOptions}
                  showTypeField={false}
                />
              )}
            />
          </section>
        </div>
      </div>

      <Modal
        open={isCreateModalOpen}
        title="Create Task"
        okText="Create"
        onOk={() => void handleCreateTask()}
        onCancel={() => setIsCreateModalOpen(false)}
        confirmLoading={creating}
      >
        <div className="modal-form-stack">
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
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
