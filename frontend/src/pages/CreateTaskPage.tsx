import {
  CaretRightOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { message, Modal } from "antd";
import { useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import RequirementTreeCanvas from "../components/requirements/RequirementTreeCanvas";
import MarkdownDocument from "../components/requirements/MarkdownDocument";
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

type ChapterItem = {
  id: string;
  title: string;
  children: ChapterItem[];
};

function slugifyFileName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "task";
}

function slugifyHeading(value: string) {
  return `${value}`
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function buildChapterTree(node: RequirementNode): ChapterItem {
  return {
    id: slugifyHeading(`${node.id} ${node.name}`),
    title: `${node.id} ${node.name}`,
    children: node.children.map(buildChapterTree),
  };
}

function collectExpandedIds(node: RequirementNode): Record<string, boolean> {
  return {
    [slugifyHeading(`${node.id} ${node.name}`)]: true,
    ...Object.assign({}, ...node.children.map(collectExpandedIds)),
  };
}

function ChapterTree({
  item,
  depth,
  expanded,
  onToggle,
}: {
  item: ChapterItem;
  depth: number;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = item.children.length > 0;
  const isExpanded = expanded[item.id] ?? true;

  return (
    <div className="chapter-tree-node">
      <div className="chapter-tree-row" style={{ paddingLeft: `${depth * 14}px` }}>
        {hasChildren ? (
          <button type="button" className={`chapter-tree-toggle ${isExpanded ? "expanded" : ""}`} onClick={() => onToggle(item.id)}>
            <CaretRightOutlined />
          </button>
        ) : (
          <span className="chapter-tree-toggle spacer" />
        )}
        <a className="toc-item chapter-tree-link" href={`#${item.id}`}>
          {item.title}
        </a>
      </div>
      {hasChildren && isExpanded
        ? item.children.map((child) => (
            <ChapterTree key={child.id} item={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
          ))
        : null}
    </div>
  );
}

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [tree, setTree] = useState<RequirementNode>(createDefaultTaskTree);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("ROOT");
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>(() => collectExpandedIds(createDefaultTaskTree()));
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTaskFormState>({
    title: "My Custom Task",
    taskType: "web",
  });

  const markdown = useMemo(() => taskTreeToMarkdown(tree), [tree]);
  const yamlContent = useMemo(() => taskTreeToYaml(tree), [tree]);
  const chapterTree = useMemo(() => buildChapterTree(tree), [tree]);
  const stats = useMemo(() => summarizeTaskTree(tree), [tree]);
  const selectedNode = useMemo(() => (selectedNodeId ? findNodeById(tree, selectedNodeId) : null), [selectedNodeId, tree]);

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
      setExpandedChapters(collectExpandedIds(nextTree));
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
    setExpandedChapters((current) => ({
      ...current,
      [slugifyHeading(`${parent.id} ${parent.name}`)]: true,
      [slugifyHeading(`${child.id} ${child.name}`)]: true,
    }));
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
    setExpandedChapters((current) => ({
      ...current,
      [slugifyHeading(`${sibling.id} ${sibling.name}`)]: true,
    }));
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
    setExpandedChapters(collectExpandedIds(reindexedTree));
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
        <div className="create-task-layout create-task-layout-locked">
          <section className="create-task-preview-panel create-task-preview-panel-locked">
            <div className="create-task-preview-inner create-task-preview-inner-locked">
              <aside className="create-task-chapters">
                <ChapterTree
                  item={chapterTree}
                  depth={0}
                  expanded={expandedChapters}
                  onToggle={(id) =>
                    setExpandedChapters((current) => ({
                      ...current,
                      [id]: !(current[id] ?? true),
                    }))
                  }
                />
              </aside>

              <div className="create-task-markdown-wrap create-task-markdown-body-only">
                <MarkdownDocument markdown={markdown} assetsBaseUrl="" referencesBaseUrl="" />
              </div>
            </div>

            <div className="create-task-toolbar">
              <button type="button" className="btn-soft success" onClick={handleSave}>
                <SaveOutlined /> Save
              </button>
              <button type="button" className="btn-soft warn" onClick={() => uploadRef.current?.click()}>
                <UploadOutlined /> Upload
              </button>
              <button type="button" className="create-task-submit-link" onClick={() => setIsCreateModalOpen(true)}>
                Create Task &gt;
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
          </section>

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
                <>
                    <div className="create-task-detail-grid">
                      <label className="field-stack">
                        <span>Requirement ID</span>
                        <input
                          className="text-input"
                          value={node.id}
                          onChange={(event) => {
                            const nextId = event.target.value;
                            updateSelectedNode((currentNode) => ({ ...currentNode, id: nextId }));
                            setSelectedNodeId(nextId);
                          }}
                        />
                      </label>

                      <label className="field-stack">
                        <span>Title</span>
                        <input
                          className="text-input"
                          value={node.name}
                          onChange={(event) => updateSelectedNode((currentNode) => ({ ...currentNode, name: event.target.value }))}
                        />
                      </label>

                      <label className="field-stack">
                        <span>Type</span>
                        <select
                          className="text-input"
                          value={node.type}
                          onChange={(event) =>
                            updateSelectedNode((currentNode) => ({
                              ...currentNode,
                              type: event.target.value as RequirementNode["type"],
                              children: event.target.value === "ATOMIC" ? [] : currentNode.children,
                              scenarios:
                                currentNode.scenarios.length > 0 ? currentNode.scenarios : [{ name: "New scenario", steps: [] }],
                            }))
                          }
                        >
                          <option value="FOLDER">FOLDER</option>
                          <option value="ATOMIC">ATOMIC</option>
                        </select>
                      </label>

                      <label className="field-stack">
                        <span>Dependencies</span>
                        <input
                          className="text-input"
                          placeholder="REQ-1, REQ-2"
                          value={node.dependencies.join(", ")}
                          onChange={(event) =>
                            updateSelectedNode((currentNode) => ({
                              ...currentNode,
                              dependencies: event.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean),
                            }))
                          }
                        />
                      </label>
                    </div>

                    <label className="field-stack">
                      <span>Description</span>
                      <textarea
                        className="text-area"
                        rows={4}
                        value={node.description}
                        onChange={(event) => updateSelectedNode((currentNode) => ({ ...currentNode, description: event.target.value }))}
                      />
                    </label>

                    <div className="scenario-editor compact">
                      <div className="scenario-editor-head">
                        <strong>{node.scenarios.length} scenarios</strong>
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() =>
                            updateSelectedNode((currentNode) => ({
                              ...currentNode,
                              scenarios: [...currentNode.scenarios, { name: `Scenario ${currentNode.scenarios.length + 1}`, steps: [] }],
                            }))
                          }
                        >
                          <PlusOutlined /> Add Scenario
                        </button>
                      </div>

                      {node.scenarios.map((scenario, scenarioIndex) => (
                        <div key={`${node.id}-scenario-${scenarioIndex}`} className="scenario-card">
                          <div className="scenario-card-top">
                            <input
                              className="text-input"
                              value={scenario.name}
                              onChange={(event) =>
                                updateSelectedNode((currentNode) => ({
                                  ...currentNode,
                                  scenarios: currentNode.scenarios.map((item, index) =>
                                    index === scenarioIndex ? { ...item, name: event.target.value } : item,
                                  ),
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="icon-only-btn"
                              onClick={() =>
                                updateSelectedNode((currentNode) => ({
                                  ...currentNode,
                                  scenarios: currentNode.scenarios.filter((_, index) => index !== scenarioIndex),
                                }))
                              }
                            >
                              <DeleteOutlined />
                            </button>
                          </div>

                          <div className="scenario-steps">
                            {scenario.steps.map((step, stepIndex) => (
                              <div key={`${scenarioIndex}-${stepIndex}`} className="scenario-step-row">
                                <select
                                  className="text-input scenario-keyword"
                                  value={step.keyword}
                                  onChange={(event) =>
                                    updateSelectedNode((currentNode) => ({
                                      ...currentNode,
                                      scenarios: currentNode.scenarios.map((item, index) =>
                                        index === scenarioIndex
                                          ? {
                                              ...item,
                                              steps: item.steps.map((scenarioStep, nestedIndex) =>
                                                nestedIndex === stepIndex
                                                  ? { ...scenarioStep, keyword: event.target.value }
                                                  : scenarioStep,
                                              ),
                                            }
                                          : item,
                                      ),
                                    }))
                                  }
                                >
                                  <option value="GIVEN">GIVEN</option>
                                  <option value="WHEN">WHEN</option>
                                  <option value="THEN">THEN</option>
                                  <option value="AND">AND</option>
                                </select>
                                <input
                                  className="text-input"
                                  value={step.content}
                                  onChange={(event) =>
                                    updateSelectedNode((currentNode) => ({
                                      ...currentNode,
                                      scenarios: currentNode.scenarios.map((item, index) =>
                                        index === scenarioIndex
                                          ? {
                                              ...item,
                                              steps: item.steps.map((scenarioStep, nestedIndex) =>
                                                nestedIndex === stepIndex
                                                  ? { ...scenarioStep, content: event.target.value }
                                                  : scenarioStep,
                                              ),
                                            }
                                          : item,
                                      ),
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="icon-only-btn"
                                  onClick={() =>
                                    updateSelectedNode((currentNode) => ({
                                      ...currentNode,
                                      scenarios: currentNode.scenarios.map((item, index) =>
                                        index === scenarioIndex
                                          ? {
                                              ...item,
                                              steps: item.steps.filter((_, nestedIndex) => nestedIndex !== stepIndex),
                                            }
                                          : item,
                                      ),
                                    }))
                                  }
                                >
                                  <DeleteOutlined />
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            className="mini-btn"
                            onClick={() =>
                              updateSelectedNode((currentNode) => ({
                                ...currentNode,
                                scenarios: currentNode.scenarios.map((item, index) =>
                                  index === scenarioIndex
                                    ? {
                                        ...item,
                                        steps: [...item.steps, { keyword: "GIVEN", content: "" }],
                                      }
                                    : item,
                                ),
                              }))
                            }
                          >
                            <PlusOutlined /> Add Step
                          </button>
                        </div>
                      ))}
                    </div>
                </>
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
