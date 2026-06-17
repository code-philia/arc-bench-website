import {
  ApartmentOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  DownOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  MinusOutlined,
  OrderedListOutlined,
  PlusOutlined,
  RadarChartOutlined,
  ShareAltOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import { hierarchy, tree as createTreeLayout } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BaseEdge,
  Connection,
  ConnectionLineType,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useStoreApi,
  useReactFlow,
  type EdgeProps,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import { findNodeById, type RequirementNode } from "../../lib/taskTree";
import type { RequirementVisualState } from "../../lib/types";

type FlowNodeData = {
  label: string;
  title: string;
  type: RequirementNode["type"];
  selected: boolean;
  visualState: RequirementVisualState;
  pulse: boolean;
  dependencySourcesVisible: boolean;
  dependencyTargetsVisible: boolean;
};

type FlowGraph = {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
};

type RequirementTreeCanvasProps = {
  tree: RequirementNode;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  detailExpanded: boolean;
  onDetailExpandedChange: (expanded: boolean) => void;
  mode?: "editable" | "readonly";
  detailPlacement?: "bottom" | "right";
  showDetailToggle?: boolean;
  onAddChild?: () => void;
  onAddSibling?: () => void;
  onDeleteNode?: () => void;
  onReindexIds?: () => void;
  onConnectDependency?: (sourceId: string, targetId: string) => void;
  renderDetailContent?: (node: RequirementNode) => React.ReactNode;
  nodeStates?: Record<string, RequirementVisualState>;
  focusNodeId?: string | null;
  pulseNodeId?: string | null;
  showLegend?: boolean;
  detailTestId?: string;
  autoFitOnTreeChange?: boolean;
};

const NODE_WIDTH = 124;
const NODE_HEIGHT = 48;
const HORIZONTAL_GAP = 72;
const VERTICAL_GAP = 44;
const FLOW_MARGIN_X = 32;
const FLOW_MARGIN_Y = 32;
const DEPENDENCY_EDGE_COLOR = "#d44949";
const DEPENDENCY_EDGE_STROKE_WIDTH = 1.8;
const DEPENDENCY_EDGE_DASHARRAY = "6 5";
const DEPENDENCY_EDGE_CONTROL_OFFSET = 56;
const DEPENDENCY_ARROW_SIZE = 7;

function getEventClientPoint(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ("touches" in event) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: event.clientX, y: event.clientY };
}

function buildDependencyPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  const control1X = sourceX + DEPENDENCY_EDGE_CONTROL_OFFSET;
  const control2X = targetX - DEPENDENCY_EDGE_CONTROL_OFFSET;
  return [
    `M ${sourceX} ${sourceY}`,
    `C ${control1X} ${sourceY}, ${control2X} ${targetY}, ${targetX} ${targetY}`,
  ].join(" ");
}

function buildDependencyArrowPath(targetX: number, targetY: number): string {
  const arrowOffset = DEPENDENCY_ARROW_SIZE * 0.72;
  return [
    `M ${targetX - DEPENDENCY_ARROW_SIZE} ${targetY - arrowOffset}`,
    `L ${targetX} ${targetY}`,
    `L ${targetX - DEPENDENCY_ARROW_SIZE} ${targetY + arrowOffset}`,
  ].join(" ");
}

function buildFlowFromTree(
  tree: RequirementNode,
  selectedNodeId: string | null,
  nodeStates: Record<string, RequirementVisualState>,
  pulseNodeId: string | null,
  editable: boolean,
  dependencySourcesVisible: boolean,
  dependencyTargetsVisible: boolean,
  showDependencies: boolean,
): FlowGraph {
  const root = hierarchy(tree, (node) => node.children);
  const layout = createTreeLayout<RequirementNode>()
    .nodeSize([NODE_HEIGHT + VERTICAL_GAP, NODE_WIDTH + HORIZONTAL_GAP]);
  const positionedRoot = layout(root);
  const positionedNodes = positionedRoot.descendants();

  const minX = Math.min(...positionedNodes.map((node) => node.x));
  const minY = Math.min(...positionedNodes.map((node) => node.y));

  const structureEdges: Edge[] = positionedRoot.links().map((link) => ({
    id: `${link.source.data.id}-${link.target.data.id}`,
    source: link.source.data.id,
    target: link.target.data.id,
    type: "straight",
    animated: false,
    zIndex: 1,
  }));

  const validNodeIds = new Set(positionedNodes.map((node) => node.data.id));
  const dependencyEdges: Edge[] = [];

  positionedNodes.forEach((positioned) => {
    const sourceNode = positioned.data;
    sourceNode.dependencies.forEach((dependencyId) => {
      if (!validNodeIds.has(dependencyId) || dependencyId === sourceNode.id) {
        return;
      }
      dependencyEdges.push({
        id: `dependency-${sourceNode.id}-${dependencyId}`,
        source: sourceNode.id,
        target: dependencyId,
        sourceHandle: "dependency-source",
        targetHandle: "dependency-target",
        type: "dependencyEdge",
        animated: false,
        zIndex: 3,
        style: {
          stroke: DEPENDENCY_EDGE_COLOR,
          strokeWidth: DEPENDENCY_EDGE_STROKE_WIDTH,
          strokeDasharray: DEPENDENCY_EDGE_DASHARRAY,
        },
      });
    });
  });

  const nodes: Node<FlowNodeData>[] = positionedNodes.map((positioned) => {
    const node = positioned.data;
    return {
      id: node.id,
      type: "requirementNode",
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: {
        x: FLOW_MARGIN_X + (positioned.y - minY) - NODE_WIDTH / 2,
        y: FLOW_MARGIN_Y + (positioned.x - minX) - NODE_HEIGHT / 2,
      },
      data: {
        label: node.id,
        title: node.name,
        type: node.type,
        selected: selectedNodeId === node.id,
        visualState: nodeStates[node.id] ?? "default",
        pulse: pulseNodeId === node.id,
        dependencySourcesVisible: editable && dependencySourcesVisible,
        dependencyTargetsVisible,
      },
      draggable: false,
    };
  });

  return {
    nodes,
    edges: showDependencies ? [...structureEdges, ...dependencyEdges] : structureEdges,
  };
}

function DependencyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  selected,
}: EdgeProps<Edge>) {
  const path = buildDependencyPath(sourceX, sourceY, targetX, targetY);
  const arrowPath = buildDependencyArrowPath(targetX, targetY);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: DEPENDENCY_EDGE_COLOR,
          strokeWidth: DEPENDENCY_EDGE_STROKE_WIDTH,
          strokeDasharray: DEPENDENCY_EDGE_DASHARRAY,
          ...style,
        }}
        interactionWidth={20}
      />
      <path
        d={arrowPath}
        fill="none"
        stroke={DEPENDENCY_EDGE_COLOR}
        strokeWidth={selected ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
    </>
  );
}

function RequirementFlowNode({ data }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div
      className={`task-flow-node ${data.selected ? "active" : ""} ${data.type === "ATOMIC" ? "atomic" : ""} visual-${data.visualState} ${data.pulse ? "pulse" : ""}`}
    >
      {data.dependencyTargetsVisible ? <span className="task-flow-handle-visual dependency-target" aria-hidden="true" /> : null}
      <Handle
        id="dependency-target"
        type="target"
        position={Position.Left}
        className={`task-flow-handle dependency-target ${data.dependencyTargetsVisible ? "visible" : ""}`}
        isConnectable={data.dependencyTargetsVisible}
      />
      <strong>{data.label}</strong>
      <span>{data.title}</span>
      {data.dependencySourcesVisible ? <span className="task-flow-handle-visual dependency-source" aria-hidden="true" /> : null}
      <Handle
        id="dependency-source"
        type="source"
        position={Position.Right}
        className={`task-flow-handle dependency-source ${data.dependencySourcesVisible ? "visible" : ""}`}
        isConnectable={data.dependencySourcesVisible}
      />
    </div>
  );
}

function RequirementStateLegend() {
  return (
    <div className="task-flow-legend">
      <div className="task-flow-legend-title">Legend</div>
      <div className="task-flow-legend-list">
        <div className="task-flow-legend-item">
          <span className="task-flow-legend-swatch design" />
          <span>Design Done</span>
        </div>
        <div className="task-flow-legend-item">
          <span className="task-flow-legend-swatch implement" />
          <span>Implementation Done</span>
        </div>
        <div className="task-flow-legend-item">
          <span className="task-flow-legend-swatch test-passed" />
          <span>Test Passed</span>
        </div>
        <div className="task-flow-legend-item">
          <span className="task-flow-legend-swatch test-failed" />
          <span>Test Failed</span>
        </div>
      </div>
    </div>
  );
}

function ReadonlyNodeDetail({ node }: { node: RequirementNode }) {
  return (
    <div className="readonly-node-detail">
      <div className="readonly-detail-grid">
        <div className="readonly-detail-card">
          <span>Type</span>
          <strong>{node.type}</strong>
        </div>
        <div className="readonly-detail-card">
          <span>Children</span>
          <strong>{node.children.length}</strong>
        </div>
        <div className="readonly-detail-card">
          <span>Dependencies</span>
          <strong>{node.dependencies.length}</strong>
        </div>
        <div className="readonly-detail-card">
          <span>Scenarios</span>
          <strong>{node.scenarios.length}</strong>
        </div>
      </div>

      <div className="readonly-detail-section">
        <div className="readonly-detail-label">Description</div>
        <div className="readonly-detail-body">
          {node.description || "No description available."}
        </div>
      </div>

      {node.dependencies.length > 0 ? (
        <div className="readonly-detail-section">
          <div className="readonly-detail-label">Dependencies</div>
          <div className="readonly-detail-tags">
            {node.dependencies.map((dependency) => (
              <span key={dependency} className="task-node-chip folder">
                {dependency}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="readonly-detail-section">
        <div className="readonly-detail-label">Scenarios</div>
        {node.scenarios.length === 0 ? (
          <div className="readonly-detail-body empty">No scenarios available.</div>
        ) : (
          <div className="readonly-scenario-list">
            {node.scenarios.map((scenario, index) => (
              <div key={`${node.id}-scenario-${index}`} className="readonly-scenario-card">
                <strong>{scenario.name}</strong>
                {scenario.steps.length === 0 ? (
                  <div className="readonly-detail-body empty">No steps defined.</div>
                ) : (
                  <div className="readonly-scenario-steps">
                    {scenario.steps.map((step, stepIndex) => (
                      <div key={`${node.id}-scenario-${index}-step-${stepIndex}`} className="readonly-scenario-step">
                        <span>{step.keyword}</span>
                        <div>{step.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeCanvasInner({
  tree,
  selectedNodeId,
  onSelectNode,
  detailExpanded,
  onDetailExpandedChange,
  mode = "readonly",
  detailPlacement = "bottom",
  showDetailToggle = true,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onReindexIds,
  onConnectDependency,
  renderDetailContent,
  nodeStates = {},
  focusNodeId = null,
  pulseNodeId = null,
  showLegend = false,
  detailTestId,
  autoFitOnTreeChange = true,
}: RequirementTreeCanvasProps) {
  const reactFlow = useReactFlow();
  const storeApi = useStoreApi();
  const lastFocusKeyRef = useRef<string | null>(null);
  const hasInitializedViewRef = useRef(false);
  const previewFrameRef = useRef<number | null>(null);
  const previewPointRef = useRef<{ x: number; y: number } | null>(null);
  const previewPathRef = useRef<SVGPathElement | null>(null);
  const previewArrowPathRef = useRef<SVGPathElement | null>(null);
  const previewSourcePointRef = useRef<{ x: number; y: number } | null>(null);
  const [dependencyConnectionActive, setDependencyConnectionActive] = useState(false);
  const [clickConnectionSourceId, setClickConnectionSourceId] = useState<string | null>(null);
  const [showDependencies, setShowDependencies] = useState(mode === "editable");
  const baseFlow = useMemo(
    () => buildFlowFromTree(
      tree,
      selectedNodeId,
      nodeStates,
      pulseNodeId,
      mode === "editable",
      !dependencyConnectionActive,
      dependencyConnectionActive,
      showDependencies,
    ),
    [dependencyConnectionActive, mode, nodeStates, pulseNodeId, selectedNodeId, showDependencies, tree],
  );
  const flow = baseFlow;
  const edgeTypes = useMemo(() => ({ dependencyEdge: DependencyEdge }), []);
  const nodeTypes = useMemo(() => ({ requirementNode: RequirementFlowNode }), []);
  const selectedNode = useMemo(() => (selectedNodeId ? findNodeById(tree, selectedNodeId) : null), [selectedNodeId, tree]);

  useEffect(() => {
    return () => {
      if (previewFrameRef.current !== null) {
        window.cancelAnimationFrame(previewFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hasInitializedViewRef.current && !autoFitOnTreeChange) {
      return;
    }
    hasInitializedViewRef.current = true;
    const timer = window.setTimeout(() => {
      reactFlow.fitView({ padding: 0.22, duration: 300, maxZoom: 1.15 });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [autoFitOnTreeChange, reactFlow, tree]);

  useEffect(() => {
    if (!focusNodeId) {
      return;
    }
    const focusKey = `${focusNodeId}:${pulseNodeId ?? ""}`;
    if (lastFocusKeyRef.current === focusKey) {
      return;
    }
    lastFocusKeyRef.current = focusKey;
    const target = baseFlow.nodes.find((node) => node.id === focusNodeId);
    if (!target) {
      return;
    }
    const timer = window.setTimeout(() => {
      reactFlow.setCenter(
        target.position.x + NODE_WIDTH / 2,
        target.position.y + NODE_HEIGHT / 2,
        { zoom: 1.25, duration: 420 },
      );
    }, 80);
    return () => window.clearTimeout(timer);
  }, [baseFlow.nodes, focusNodeId, pulseNodeId, reactFlow]);

  const detailContent = selectedNode
    ? (renderDetailContent ? renderDetailContent(selectedNode) : <ReadonlyNodeDetail node={selectedNode} />)
    : null;

  const handleConnectDependency = (connection: Connection) => {
    if (!onConnectDependency || !connection.source || !connection.target || connection.source === connection.target) {
      return;
    }
    onConnectDependency(connection.source, connection.target);
  };

  const cancelDependencyConnection = () => {
    storeApi.getState().cancelConnection();
    storeApi.setState({ connectionClickStartHandle: null });
    setDependencyConnectionActive(false);
    setClickConnectionSourceId(null);
    previewPointRef.current = null;
    previewSourcePointRef.current = null;
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    if (previewPathRef.current) {
      previewPathRef.current.setAttribute("d", "");
    }
    if (previewArrowPathRef.current) {
      previewArrowPathRef.current.setAttribute("d", "");
    }
  };

  const updateClickPreviewPath = (flowPoint: { x: number; y: number } | null) => {
    if (!previewPathRef.current || !previewArrowPathRef.current) {
      return;
    }
    const sourcePoint = previewSourcePointRef.current;
    if (!sourcePoint || !flowPoint) {
      previewPathRef.current.setAttribute("d", "");
      previewArrowPathRef.current.setAttribute("d", "");
      return;
    }
    const path = buildDependencyPath(sourcePoint.x, sourcePoint.y, flowPoint.x, flowPoint.y);
    const arrowPath = buildDependencyArrowPath(flowPoint.x, flowPoint.y);
    previewPathRef.current.setAttribute("d", path);
    previewArrowPathRef.current.setAttribute("d", arrowPath);
  };

  const scheduleClickPreviewPointerUpdate = (clientPoint: { x: number; y: number }) => {
    previewPointRef.current = clientPoint;
    if (previewFrameRef.current !== null) {
      return;
    }
    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = null;
      if (!previewPointRef.current) {
        return;
      }
      updateClickPreviewPath(reactFlow.screenToFlowPosition(previewPointRef.current));
    });
  };

  return (
    <div className={`requirement-tree-layout detail-${detailPlacement}`}>
      <div className="requirement-tree-canvas-region">
        <div className="task-flow-toolbar">
          {mode === "editable" ? (
            <>
              <Tooltip title="Add child node">
                <button type="button" className="icon-tool-btn" onClick={onAddChild}>
                  <ApartmentOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Add sibling node">
                <button type="button" className="icon-tool-btn" onClick={onAddSibling}>
                  <ShareAltOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Delete selected node">
                <button type="button" className="icon-tool-btn danger" onClick={onDeleteNode}>
                  <DeleteOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Reindex requirement IDs">
                <button type="button" className="icon-tool-btn" onClick={onReindexIds}>
                  <OrderedListOutlined />
                </button>
              </Tooltip>
              <div className="task-flow-toolbar-divider" />
            </>
          ) : null}

          <Tooltip title="Zoom in">
            <button type="button" className="icon-tool-btn" onClick={() => reactFlow.zoomIn({ duration: 180 })}>
              <PlusOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Zoom out">
            <button type="button" className="icon-tool-btn" onClick={() => reactFlow.zoomOut({ duration: 180 })}>
              <MinusOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Center graph">
            <button
              type="button"
              className="icon-tool-btn"
              onClick={() => reactFlow.fitView({ padding: 0.22, duration: 260, maxZoom: 1.15 })}
            >
              <RadarChartOutlined />
            </button>
          </Tooltip>
          <div className="task-flow-toolbar-divider toolbar-divider-right" />
          <Tooltip title={showDependencies ? "Hide dependencies" : "Show dependencies"}>
            <button
              type="button"
              className={`icon-tool-btn ${showDependencies ? "active" : ""}`}
              onClick={() => setShowDependencies((current) => !current)}
            >
              {showDependencies ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            </button>
          </Tooltip>
        </div>

        <div
          className="task-flow-shell"
          onMouseMoveCapture={(event) => {
            if (!clickConnectionSourceId) {
              return;
            }
            scheduleClickPreviewPointerUpdate({ x: event.clientX, y: event.clientY });
          }}
        >
          {showLegend ? <RequirementStateLegend /> : null}
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            onNodeClick={(event, node) => {
              const target = event.target as HTMLElement | null;
              if (target?.closest(".task-flow-handle")) {
                return;
              }
              onSelectNode(node.id);
            }}
            onPaneClick={() => {
              if (clickConnectionSourceId) {
                cancelDependencyConnection();
                return;
              }
              onSelectNode(null);
            }}
            fitView
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick={false}
            selectionOnDrag={false}
            nodesDraggable={false}
            nodesConnectable={mode === "editable"}
            connectOnClick={mode === "editable"}
            minZoom={0.2}
            maxZoom={1.8}
            onConnect={handleConnectDependency}
            onConnectStart={() => {
              if (mode === "editable") {
                setDependencyConnectionActive(true);
              }
            }}
            onConnectEnd={() => {
              setDependencyConnectionActive(false);
              previewPointRef.current = null;
              previewSourcePointRef.current = null;
              if (previewPathRef.current) {
                previewPathRef.current.setAttribute("d", "");
              }
              if (previewArrowPathRef.current) {
                previewArrowPathRef.current.setAttribute("d", "");
              }
            }}
            onClickConnectStart={(event, params) => {
              if (mode === "editable") {
                setDependencyConnectionActive(true);
                setClickConnectionSourceId(params.nodeId);
                const sourceNode = baseFlow.nodes.find((node) => node.id === params.nodeId);
                previewSourcePointRef.current = sourceNode
                  ? {
                      x: sourceNode.position.x + NODE_WIDTH,
                      y: sourceNode.position.y + NODE_HEIGHT / 2,
                    }
                  : null;
                const point = getEventClientPoint(event);
                previewPointRef.current = point;
                updateClickPreviewPath(point ? reactFlow.screenToFlowPosition(point) : null);
              }
            }}
            onClickConnectEnd={() => {
              setDependencyConnectionActive(false);
              setClickConnectionSourceId(null);
              previewPointRef.current = null;
              previewSourcePointRef.current = null;
              if (previewPathRef.current) {
                previewPathRef.current.setAttribute("d", "");
              }
              if (previewArrowPathRef.current) {
                previewArrowPathRef.current.setAttribute("d", "");
              }
            }}
            connectionLineType={ConnectionLineType.SimpleBezier}
            connectionLineStyle={{
              stroke: "#d44949",
              strokeWidth: 1.8,
              strokeDasharray: "6 5",
            }}
            isValidConnection={(connection) =>
              Boolean(
                connection.source &&
                connection.target &&
                connection.source !== connection.target &&
                connection.sourceHandle === "dependency-source" &&
                connection.targetHandle === "dependency-target",
              )}
            edgeTypes={edgeTypes}
            nodeTypes={nodeTypes}
            className="task-flow-canvas"
            defaultEdgeOptions={{
              type: "straight",
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 22,
                height: 22,
                color: "#145c4c",
              },
              style: {
                stroke: "#677784",
                strokeWidth: 1.3,
              },
            }}
          >
            <ViewportPortal>
              <svg className="task-flow-preview-overlay" aria-hidden="true">
                <path
                  ref={previewPathRef}
                  className={`task-flow-preview-path ${clickConnectionSourceId ? "visible" : ""}`}
                  d=""
                />
                <path
                  ref={previewArrowPathRef}
                  className={`task-flow-preview-arrow ${clickConnectionSourceId ? "visible" : ""}`}
                  d=""
                />
              </svg>
            </ViewportPortal>
          </ReactFlow>
        </div>
      </div>

      {selectedNode ? (
        <div
          data-quickstart-id={detailTestId}
          className={`create-task-detail-drawer detail-placement-${detailPlacement} ${detailExpanded ? "expanded" : "collapsed"}`}
        >
          <div className="create-task-detail-top">
            <div>
              <strong>{selectedNode.id}</strong>
              <span>{selectedNode.name}</span>
            </div>
            <div className="create-task-detail-actions">
              <div className={`task-node-chip ${selectedNode.type === "ATOMIC" ? "atomic" : "folder"}`}>
                {selectedNode.type}
              </div>
              {showDetailToggle ? (
                <button
                  type="button"
                  className="icon-only-btn"
                  onClick={() => onDetailExpandedChange(!detailExpanded)}
                >
                  {detailExpanded ? <DownOutlined /> : <UpOutlined />}
                </button>
              ) : null}
            </div>
          </div>

          {detailExpanded ? detailContent : null}
        </div>
      ) : null}
    </div>
  );
}

export default function RequirementTreeCanvas(props: RequirementTreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
