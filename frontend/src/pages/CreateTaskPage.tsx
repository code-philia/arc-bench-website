import {
  ApartmentOutlined,
  CaretRightOutlined,
  DownOutlined,
  DeleteOutlined,
  MinusOutlined,
  PlusOutlined,
  RadarChartOutlined,
  SaveOutlined,
  ShareAltOutlined,
  UploadOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { message, Modal, Tooltip } from "antd";
import dagre from "@dagrejs/dagre";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
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

type FlowNodeData = {
  label: string;
  title: string;
  type: RequirementNode["type"];
  selected: boolean;
};

type ChapterItem = {
  id: string;
  title: string;
  children: ChapterItem[];
};

const NODE_WIDTH = 124;
const NODE_HEIGHT = 48;

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

function collectTreeNodes(root: RequirementNode, parentId: string | null = null): Array<{ node: RequirementNode; parentId: string | null }> {
  return [
    { node: root, parentId },
    ...root.children.flatMap((child) => collectTreeNodes(child, root.id)),
  ];
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

function buildFlowFromTree(tree: RequirementNode, selectedNodeId: string | null): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const items = collectTreeNodes(tree);
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    nodesep: 34,
    ranksep: 66,
    marginx: 32,
    marginy: 32,
  });

  items.forEach(({ node }) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  const edges: Edge[] = items
    .filter((item) => item.parentId)
    .map((item) => {
      const parentId = item.parentId as string;
      graph.setEdge(parentId, item.node.id);
      return {
        id: `${parentId}-${item.node.id}`,
        source: parentId,
        target: item.node.id,
        type: "straight",
        animated: false,
        zIndex: 1,
      };
    });

  dagre.layout(graph);

  const nodes: Node<FlowNodeData>[] = items.map(({ node }) => {
    const positioned = graph.node(node.id);
    return {
      id: node.id,
      type: "requirementNode",
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: {
        x: positioned.x - NODE_WIDTH / 2,
        y: positioned.y - NODE_HEIGHT / 2,
      },
      data: {
        label: node.id,
        title: node.name,
        type: node.type,
        selected: selectedNodeId === node.id,
      },
      draggable: false,
    };
  });

  return { nodes, edges };
}

function RequirementFlowNode({ data }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div className={`task-flow-node ${data.selected ? "active" : ""} ${data.type === "ATOMIC" ? "atomic" : ""}`}>
      <Handle type="target" position={Position.Left} className="task-flow-handle" isConnectable={false} />
      <strong>{data.label}</strong>
      <span>{data.title}</span>
      <Handle type="source" position={Position.Right} className="task-flow-handle" isConnectable={false} />
    </div>
  );
}

function FlowCanvas({
  tree,
  selectedNodeId,
  onSelectNode,
  onReady,
}: {
  tree: RequirementNode;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onReady: (instance: ReturnType<typeof useReactFlow>) => void;
}) {
  const reactFlow = useReactFlow();
  const flow = useMemo(() => buildFlowFromTree(tree, selectedNodeId), [selectedNodeId, tree]);

  useEffect(() => {
    onReady(reactFlow);
  }, [onReady, reactFlow]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      reactFlow.fitView({ padding: 0.22, duration: 300, maxZoom: 1.15 });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [reactFlow, tree]);

  return (
    <ReactFlow
      nodes={flow.nodes}
      edges={flow.edges}
      onNodeClick={(_, node) => onSelectNode(node.id)}
      onPaneClick={() => onSelectNode(null)}
      fitView
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      selectionOnDrag={false}
      nodesDraggable={false}
      nodesConnectable={false}
      minZoom={0.2}
      maxZoom={1.8}
      nodeTypes={{ requirementNode: RequirementFlowNode }}
      className="task-flow-canvas"
      defaultEdgeOptions={{
        type: "straight",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 22,
          height: 22,
          color: "#145c4c",
        },
      }}
    />
  );
}

function CreateTaskCanvas({
  tree,
  selectedNodeId,
  onSelectNode,
  onReady,
}: {
  tree: RequirementNode;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onReady: (instance: ReturnType<typeof useReactFlow>) => void;
}) {
  return (
    <ReactFlowProvider>
      <FlowCanvas
        tree={tree}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        onReady={onReady}
      />
    </ReactFlowProvider>
  );
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
  const flowRef = useRef<ReturnType<typeof useReactFlow> | null>(null);
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

  const handleFitView = () => {
    flowRef.current?.fitView({ padding: 0.22, duration: 260, maxZoom: 1.15 });
  };

  const handleZoomIn = () => {
    flowRef.current?.zoomIn({ duration: 180 });
  };

  const handleZoomOut = () => {
    flowRef.current?.zoomOut({ duration: 180 });
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
        <div className="breadcrumb create-task-breadcrumb">
          <span>Playground</span>
          <span className="sep">/</span>
          <span className="current">Design Requirement</span>
        </div>

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
            <div className="task-flow-toolbar">
              <Tooltip title="Add child node">
                <button type="button" className="icon-tool-btn" onClick={handleAddChild}>
                  <ApartmentOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Add sibling node">
                <button type="button" className="icon-tool-btn" onClick={handleAddSibling}>
                  <ShareAltOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Delete selected node">
                <button type="button" className="icon-tool-btn danger" onClick={handleDeleteNode}>
                  <DeleteOutlined />
                </button>
              </Tooltip>
              <div className="task-flow-toolbar-divider" />
              <Tooltip title="Zoom in">
                <button type="button" className="icon-tool-btn" onClick={handleZoomIn}>
                  <PlusOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Zoom out">
                <button type="button" className="icon-tool-btn" onClick={handleZoomOut}>
                  <MinusOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Center graph">
                <button type="button" className="icon-tool-btn" onClick={handleFitView}>
                  <RadarChartOutlined />
                </button>
              </Tooltip>
            </div>

            <div className="task-flow-shell">
              <CreateTaskCanvas
                tree={tree}
                selectedNodeId={selectedNodeId}
                onSelectNode={(nodeId) => {
                  setSelectedNodeId(nodeId);
                  setDetailExpanded(Boolean(nodeId));
                }}
                onReady={(instance) => {
                  flowRef.current = instance;
                }}
              />
            </div>

            {selectedNode ? (
              <div className={`create-task-detail-drawer ${detailExpanded ? "expanded" : "collapsed"}`}>
                <div className="create-task-detail-top">
                  <div>
                    <strong>{selectedNode.id}</strong>
                    <span>{selectedNode.name}</span>
                  </div>
                  <div className="create-task-detail-actions">
                    <div className={`task-node-chip ${selectedNode.type === "ATOMIC" ? "atomic" : "folder"}`}>
                      {selectedNode.type}
                    </div>
                    <button
                      type="button"
                      className="icon-only-btn"
                      onClick={() => setDetailExpanded((current) => !current)}
                    >
                      {detailExpanded ? <DownOutlined /> : <UpOutlined />}
                    </button>
                  </div>
                </div>

                {detailExpanded ? (
                  <>
                    <div className="create-task-detail-grid">
                      <label className="field-stack">
                        <span>Requirement ID</span>
                        <input
                          className="text-input"
                          value={selectedNode.id}
                          onChange={(event) => {
                            const nextId = event.target.value;
                            updateSelectedNode((node) => ({ ...node, id: nextId }));
                            setSelectedNodeId(nextId);
                          }}
                        />
                      </label>

                      <label className="field-stack">
                        <span>Title</span>
                        <input
                          className="text-input"
                          value={selectedNode.name}
                          onChange={(event) => updateSelectedNode((node) => ({ ...node, name: event.target.value }))}
                        />
                      </label>

                      <label className="field-stack">
                        <span>Type</span>
                        <select
                          className="text-input"
                          value={selectedNode.type}
                          onChange={(event) =>
                            updateSelectedNode((node) => ({
                              ...node,
                              type: event.target.value as RequirementNode["type"],
                              children: event.target.value === "ATOMIC" ? [] : node.children,
                              scenarios:
                                node.scenarios.length > 0 ? node.scenarios : [{ name: "New scenario", steps: [] }],
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
                          value={selectedNode.dependencies.join(", ")}
                          onChange={(event) =>
                            updateSelectedNode((node) => ({
                              ...node,
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
                        value={selectedNode.description}
                        onChange={(event) => updateSelectedNode((node) => ({ ...node, description: event.target.value }))}
                      />
                    </label>

                    <div className="scenario-editor compact">
                      <div className="scenario-editor-head">
                        <strong>{selectedNode.scenarios.length} scenarios</strong>
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() =>
                            updateSelectedNode((node) => ({
                              ...node,
                              scenarios: [...node.scenarios, { name: `Scenario ${node.scenarios.length + 1}`, steps: [] }],
                            }))
                          }
                        >
                          <PlusOutlined /> Add Scenario
                        </button>
                      </div>

                      {selectedNode.scenarios.map((scenario, scenarioIndex) => (
                        <div key={`${selectedNode.id}-scenario-${scenarioIndex}`} className="scenario-card">
                          <div className="scenario-card-top">
                            <input
                              className="text-input"
                              value={scenario.name}
                              onChange={(event) =>
                                updateSelectedNode((node) => ({
                                  ...node,
                                  scenarios: node.scenarios.map((item, index) =>
                                    index === scenarioIndex ? { ...item, name: event.target.value } : item,
                                  ),
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="icon-only-btn"
                              onClick={() =>
                                updateSelectedNode((node) => ({
                                  ...node,
                                  scenarios: node.scenarios.filter((_, index) => index !== scenarioIndex),
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
                                    updateSelectedNode((node) => ({
                                      ...node,
                                      scenarios: node.scenarios.map((item, index) =>
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
                                    updateSelectedNode((node) => ({
                                      ...node,
                                      scenarios: node.scenarios.map((item, index) =>
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
                                    updateSelectedNode((node) => ({
                                      ...node,
                                      scenarios: node.scenarios.map((item, index) =>
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
                              updateSelectedNode((node) => ({
                                ...node,
                                scenarios: node.scenarios.map((item, index) =>
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
                ) : null}
              </div>
            ) : null}
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
