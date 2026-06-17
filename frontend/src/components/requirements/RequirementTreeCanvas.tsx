import {
  ApartmentOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  DownOutlined,
  MinusOutlined,
  PlusOutlined,
  RadarChartOutlined,
  ShareAltOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import { hierarchy, tree as createTreeLayout } from "d3-hierarchy";
import { useEffect, useMemo, useRef } from "react";
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

import { findNodeById, type RequirementNode } from "../../lib/taskTree";
import type { RequirementVisualState } from "../../lib/types";

type FlowNodeData = {
  label: string;
  title: string;
  type: RequirementNode["type"];
  selected: boolean;
  visualState: RequirementVisualState;
  pulse: boolean;
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
  renderDetailContent?: (node: RequirementNode) => React.ReactNode;
  nodeStates?: Record<string, RequirementVisualState>;
  focusNodeId?: string | null;
  pulseNodeId?: string | null;
  showLegend?: boolean;
  detailTestId?: string;
};

const NODE_WIDTH = 124;
const NODE_HEIGHT = 48;
const HORIZONTAL_GAP = 72;
const VERTICAL_GAP = 44;
const FLOW_MARGIN_X = 32;
const FLOW_MARGIN_Y = 32;

function buildFlowFromTree(
  tree: RequirementNode,
  selectedNodeId: string | null,
  nodeStates: Record<string, RequirementVisualState>,
  pulseNodeId: string | null,
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const root = hierarchy(tree, (node) => node.children);
  const layout = createTreeLayout<RequirementNode>()
    .nodeSize([NODE_HEIGHT + VERTICAL_GAP, NODE_WIDTH + HORIZONTAL_GAP]);
  const positionedRoot = layout(root);
  const positionedNodes = positionedRoot.descendants();

  const minX = Math.min(...positionedNodes.map((node) => node.x));
  const minY = Math.min(...positionedNodes.map((node) => node.y));

  const edges: Edge[] = positionedRoot.links().map((link) => ({
    id: `${link.source.data.id}-${link.target.data.id}`,
    source: link.source.data.id,
    target: link.target.data.id,
    type: "straight",
    animated: false,
    zIndex: 1,
  }));

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
      },
      draggable: false,
    };
  });

  return { nodes, edges };
}

function RequirementFlowNode({ data }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div
      className={`task-flow-node ${data.selected ? "active" : ""} ${data.type === "ATOMIC" ? "atomic" : ""} visual-${data.visualState} ${data.pulse ? "pulse" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="task-flow-handle" isConnectable={false} />
      <strong>{data.label}</strong>
      <span>{data.title}</span>
      <Handle type="source" position={Position.Right} className="task-flow-handle" isConnectable={false} />
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
  renderDetailContent,
  nodeStates = {},
  focusNodeId = null,
  pulseNodeId = null,
  showLegend = false,
  detailTestId,
}: RequirementTreeCanvasProps) {
  const reactFlow = useReactFlow();
  const lastFocusKeyRef = useRef<string | null>(null);
  const flow = useMemo(
    () => buildFlowFromTree(tree, selectedNodeId, nodeStates, pulseNodeId),
    [nodeStates, pulseNodeId, selectedNodeId, tree],
  );
  const selectedNode = useMemo(() => (selectedNodeId ? findNodeById(tree, selectedNodeId) : null), [selectedNodeId, tree]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      reactFlow.fitView({ padding: 0.22, duration: 300, maxZoom: 1.15 });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [reactFlow, tree]);

  useEffect(() => {
    if (!focusNodeId) {
      return;
    }
    const focusKey = `${focusNodeId}:${pulseNodeId ?? ""}`;
    if (lastFocusKeyRef.current === focusKey) {
      return;
    }
    lastFocusKeyRef.current = focusKey;
    const target = flow.nodes.find((node) => node.id === focusNodeId);
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
  }, [flow.nodes, focusNodeId, pulseNodeId, reactFlow]);

  const detailContent = selectedNode
    ? (renderDetailContent ? renderDetailContent(selectedNode) : <ReadonlyNodeDetail node={selectedNode} />)
    : null;

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
        </div>

        <div className="task-flow-shell">
          {showLegend ? <RequirementStateLegend /> : null}
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
              style: {
                stroke: "#677784",
                strokeWidth: 1.3,
              },
            }}
          />
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
