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
  parseTaskTreeYaml,
  removeNodeFromTree,
  reindexRequirementTree,
  RequirementNode,
  summarizeTaskTree,
  taskTreeToMarkdown,
  taskTreeToYaml,
  updateNodeInTree,
} from "../lib/taskTree";

type CreateTaskFormState = {
  title: string;
  taskType: "web" | "mobile" | "kernel" | "mixed";
};

function slugifyFileName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "task";
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uploadRef = useRef<HTMLInputElement | null>(null);
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
  const [createForm, setCreateForm] = useState<CreateTaskFormState>({
    title: "My Custom Task",
    taskType: "web",
  });

  const markdown = useMemo(() => taskTreeToMarkdown(tree), [tree]);
  const yamlContent = useMemo(() => taskTreeToYaml(tree), [tree]);
  const stats = useMemo(() => summarizeTaskTree(tree), [tree]);
  const selectedNode = useMemo(() => (selectedNodeId ? findNodeById(tree, selectedNodeId) : null), [selectedNodeId, tree]);

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

  const updateSelectedNode = (updater: (node: RequirementNode) => RequirementNode) => {
    if (!selectedNode) {
      return;
    }
    setTree((current) => updateNodeInTree(current, selectedNode.id, updater));
  };

  const handleUploadFile = async (file: File) => {
    try {
      const content = await file.text();
      const nextTree = parseTaskTreeYaml(content);
      setTree(nextTree);
      setSelectedNodeId(null);
      setDetailExpanded(false);
      message.success("YAML imported.");
    } catch (error) {
      message.error(`YAML import failed: ${(error as Error).message}`);
    }
  };

  const handleSave = () => {
    const baseName = slugifyFileName(tree.name);
    downloadText(`${baseName}.yaml`, `${yamlContent}\n`);
    window.setTimeout(() => {
      downloadText(`${baseName}.md`, `${markdown}\n`);
    }, 120);
    message.success("YAML and Markdown exported.");
  };

  const handleAddChild = () => {
    const parent = selectedNode ?? tree;
    const child: RequirementNode = {
      ...buildNewChildNode(parent),
      type: "ATOMIC",
      scenarios: [{ name: "New scenario", steps: [] }],
    };
    setTree((current) => appendChildNode(current, parent.id, child));
    setSelectedNodeId(child.id);
    setDetailExpanded(true);
  };

  const handleAddSibling = () => {
    if (!selectedNode || selectedNode.id === "ROOT") {
      message.warning("Select a non-root node to add a sibling.");
      return;
    }
    const sibling: RequirementNode = {
      ...buildNewChildNode(selectedNode),
      id: `${selectedNode.id}-S${Date.now().toString().slice(-3)}`,
      name: "New sibling node",
      type: "ATOMIC",
      scenarios: [{ name: "New scenario", steps: [] }],
    };
    setTree((current) => appendSiblingNode(current, selectedNode.id, sibling));
    setSelectedNodeId(sibling.id);
    setDetailExpanded(true);
  };

  const handleDeleteNode = () => {
    if (!selectedNode || selectedNode.id === "ROOT") {
      message.warning("Root chapter cannot be deleted.");
      return;
    }
    setTree((current) => removeNodeFromTree(current, selectedNode.id));
    setSelectedNodeId(null);
    setDetailExpanded(false);
  };

  const handleReindexIds = () => {
    const { tree: reindexedTree, idMap } = reindexRequirementTree(tree);
    setTree(reindexedTree);
    setSelectedNodeId((current) => (current ? (idMap[current] ?? current) : current));
    message.success("Requirement IDs reindexed.");
  };

  const handleConnectDependency = (sourceId: string, targetId: string) => {
    setTree((current) => updateNodeInTree(current, sourceId, (node) => ({
      ...node,
      dependencies: Array.from(new Set([...node.dependencies, targetId])).filter((dependency) => dependency !== sourceId),
    })));
    setSelectedNodeId(sourceId);
    setDetailExpanded(true);
    message.success(`Dependency added: ${sourceId} -> ${targetId}`);
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
              referencesBaseUrl=""
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
              onAddChild={handleAddChild}
              onAddSibling={handleAddSibling}
              onDeleteNode={handleDeleteNode}
              onReindexIds={handleReindexIds}
              onConnectDependency={handleConnectDependency}
              autoFitOnTreeChange={false}
              renderDetailContent={(node) => (
                <RequirementNodeDetailContent
                  node={node}
                  mode="editable"
                  onNodeChange={updateSelectedNode}
                  onNodeIdChange={setSelectedNodeId}
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
