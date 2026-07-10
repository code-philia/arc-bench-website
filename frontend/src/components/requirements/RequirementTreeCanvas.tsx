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

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ForwardedRef } from "react";

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
  getBezierPath,
  useEdgesState,
  useNodesState,
  useStoreApi,
  useReactFlow,
  useUpdateNodeInternals,
  type EdgeProps,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import { getFirstDescriptionImage } from "../../lib/descriptionMedia";
import { findNodeById, type RequirementNode } from "../../lib/taskTree";

import type {
  RequirementVisualState,
  SubmissionTaskAssets,
  SubmissionTraceabilityInterface,
  SubmissionTraceabilityPayload,
  SubmissionTraceabilityTest,
} from "../../lib/types";

import RequirementNodeDetailContent from "./RequirementNodeDetailContent";

type FlowNodeKind = "requirement" | "interface" | "test";

type FlowNodeData = {
  kind: FlowNodeKind;
  label: string;
  title: string;
  subtitle?: string;
  requirementNodeId?: string;
  traceabilityId?: string;
  filePath?: string;
  firstLine?: string | null;
  thumbnailSrc?: string | null;
  onMeasuredHeightChange?: (nodeId: string, height: number) => void;
  type?: RequirementNode["type"];
  itemType?: string;
  testStatus?: "passed" | "failed" | null;
  dimmed?: boolean;
  selected: boolean;
  visualState: RequirementVisualState;
  pulse: boolean;
  dependencySourcesVisible: boolean;
  dependencyTargetsVisible: boolean;
};

type TraceabilityCanvasPayload = {
  interfaces: SubmissionTraceabilityInterface[];
  tests: SubmissionTraceabilityTest[];
};

type FlowGraph = {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
};

type TraceabilityLayoutResult = {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  relationEdges: Edge[];
  desiredRequirementCenters: Map<string, number>;
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
  taskAssets?: SubmissionTaskAssets | null;
  nodeStates?: Record<string, RequirementVisualState>;
  focusNodeId?: string | null;
  pulseNodeId?: string | null;
  showLegend?: boolean;
  showCanvasToolbar?: boolean;
  detailTestId?: string;
  autoFitOnTreeChange?: boolean;
  traceabilityNodes?: TraceabilityCanvasPayload | null;
  showInterfaces?: boolean;
  showTests?: boolean;
  onShowInterfacesChange?: (show: boolean) => void;
  onShowTestsChange?: (show: boolean) => void;
  allTraceability?: SubmissionTraceabilityPayload | null;
  onRequestAllTraceability?: () => void;
  onTraceabilityOverlayChange?: (payload: { showInterfaces: boolean; showTests: boolean }) => void;
  selectedTraceabilityId?: string | null;
  selectedTraceabilityKind?: "interface" | "test" | null;
  onTraceabilityNodeClick?: (payload: {
    kind: "interface" | "test";
    id: string;
    requirementNodeId: string | null;
    filePath: string;
    firstLine: string | null;
  }) => void;
};

export type RequirementTreeCanvasHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
};

type TreeCanvasInnerProps = RequirementTreeCanvasProps & {
  canvasRef: ForwardedRef<RequirementTreeCanvasHandle>;
};

const NODE_WIDTH = 244;
const NODE_HEIGHT = 112;
const HORIZONTAL_GAP = 68;
const VERTICAL_GAP = 45;
const TRACEABILITY_NODE_WIDTH = 188;
const TRACEABILITY_COLUMN_GAP = 56;
const TRACEABILITY_ROW_GAP = 12;
const TRACEABILITY_OFFSET_X = 84;
const FLOW_MARGIN_X = 32;
const TRACEABILITY_TYPE_COLORS: Record<string, string> = {
  ui: "#3b82f6",
  api: "#10b981",
  func: "#f59e0b",
  db: "#ec4899",
  unit: "#8b5cf6",
  integration: "#06b6d4",
  e2e: "#ef4444",
};

const FLOW_MARGIN_Y = 32;
const DEPENDENCY_EDGE_COLOR = "#d44949";
const DEPENDENCY_EDGE_STROKE_WIDTH = 1.8;
const DEPENDENCY_EDGE_DASHARRAY = "6 5";
const INTERFACE_RELATION_EDGE_COLOR = "#8b5cf6";
const INTERFACE_RELATION_EDGE_STROKE_WIDTH = 1.5;
const INTERFACE_RELATION_EDGE_DASHARRAY = "6 5";
const TRACEABILITY_EDGE_COLOR = "#7c8ca2";
const TRACEABILITY_EDGE_STROKE_WIDTH = 1.35;
const TRACEABILITY_EDGE_DASHARRAY = "7 5";
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
  const sourceBendX = sourceX + DEPENDENCY_EDGE_CONTROL_OFFSET;
  const targetBendX = targetX - DEPENDENCY_EDGE_CONTROL_OFFSET;
  const midY = sourceY + (targetY - sourceY) / 2;
  return [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceBendX} ${sourceY}`,
    `L ${sourceBendX} ${midY}`,
    `L ${targetBendX} ${midY}`,
    `L ${targetBendX} ${targetY}`,
    `L ${targetX} ${targetY}`,
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

function fileBasename(filePath: string): string {
  const segments = filePath.split(/[\\/]/);
  return segments[segments.length - 1] || filePath;
}

function parsePositiveLineNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatTraceabilitySubtitle(filePath: string, lineNumber: string | null, badge: string): string {
  const safeLine = parsePositiveLineNumber(lineNumber) ?? 1;
  return `${badge} · ${fileBasename(filePath)}:${safeLine}`;
}

function formatInterfaceMeta(item: SubmissionTraceabilityInterface): string {
  return `${item.type} · ${item.implemented ? "Implemented" : "Planned"}`;
}

function formatTestMeta(item: SubmissionTraceabilityTest): string {
  return item.status ? `${item.type} · ${item.status === "passed" ? "Passed" : "Failed"}` : item.type;
}

function estimateWrappedLineCount(text: string, approxCharsPerLine: number): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }
  return normalized
    .split("\n")
    .reduce((count, line) => count + Math.max(1, Math.ceil(Math.max(line.length, 1) / approxCharsPerLine)), 0);
}

function estimateTraceabilityNodeHeight(label: string, title: string, subtitle?: string): number {
  const labelLines = estimateWrappedLineCount(label, 14);
  const titleLines = estimateWrappedLineCount(title, 24);
  const subtitleLines = estimateWrappedLineCount(subtitle ?? "", 26);
  const contentHeight = (labelLines * 19) + (titleLines * 16) + (subtitleLines * 15);
  const spacingHeight = 20 + 8 + (subtitleLines > 0 ? 6 : 0);
  return Math.max(70, contentHeight + spacingHeight);
}

function measureTraceabilityNodeHeight(element: HTMLDivElement): number | null {
  const layoutHeight = element.offsetHeight;
  if (Number.isFinite(layoutHeight) && layoutHeight > 0) {
    return layoutHeight;
  }
  const boxHeight = element.getBoundingClientRect().height;
  if (Number.isFinite(boxHeight) && boxHeight > 0) {
    return boxHeight;
  }
  return null;
}

function normalizeInterfaceType(value: string): "UI" | "API" | "FUNC" | "DB" {
  const normalized = value.trim().toUpperCase();
  if (normalized === "UI" || normalized === "API" || normalized === "FUNC" || normalized === "DB") {
    return normalized;
  }
  return "FUNC";
}

function normalizeTestType(value: string): "Unit" | "Integration" | "E2E" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "unit") return "Unit";
  if (normalized === "integration") return "Integration";
  if (normalized === "e2e") return "E2E";
  return "Unit";
}

function resolveInterfaceEntryReqId(
  item: SubmissionTraceabilityInterface,
  requirementNodeMap: Map<string, unknown>,
): string | null {
  const firstMatchingReqId = item.req_ids.find((reqId) => requirementNodeMap.has(reqId));
  return firstMatchingReqId ?? null;
}

function pickTopLevelInterfaceType(interfaces: SubmissionTraceabilityInterface[]): "UI" | "API" | "FUNC" | "DB" | null {
  const priority: Array<"UI" | "API" | "FUNC" | "DB"> = ["UI", "API", "FUNC", "DB"];
  const availableTypes = new Set(interfaces.map((item) => normalizeInterfaceType(item.type)));
  return priority.find((type) => availableTypes.has(type)) ?? null;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function resolveToggleState(current: boolean, next: boolean | ((current: boolean) => boolean)): boolean {
  return typeof next === "function" ? next(current) : next;
}

function alignRequirementCenters(
  positionedNodes: Array<{ data: RequirementNode; depth: number }>,
  baseCenters: Map<string, number>,
  desiredCenters: Map<string, number>,
): Map<string, number> {
  const result = new Map(baseCenters);
  const minCenter = FLOW_MARGIN_Y + NODE_HEIGHT / 2;
  const minGap = NODE_HEIGHT + Math.max(8, VERTICAL_GAP);
  const maxShift = Math.max(NODE_HEIGHT * 2, 180);
  const nodesByDepth = new Map<number, Array<{ data: RequirementNode; depth: number }>>();

  positionedNodes.forEach((node) => {
    const group = nodesByDepth.get(node.depth) ?? [];
    group.push(node);
    nodesByDepth.set(node.depth, group);
  });

  nodesByDepth.forEach((group) => {
    const sorted = [...group].sort(
      (left, right) => (baseCenters.get(left.data.id) ?? 0) - (baseCenters.get(right.data.id) ?? 0),
    );
    const targetCenters = sorted.map((node) => {
      const base = baseCenters.get(node.data.id) ?? minCenter;
      const desired = desiredCenters.get(node.data.id);
      if (desired == null) {
        return base;
      }
      const shift = Math.max(-maxShift, Math.min(maxShift, desired - base));
      return base + shift;
    });

    const packed = [...targetCenters];
    for (let index = 0; index < packed.length; index += 1) {
      if (index === 0) {
        packed[index] = Math.max(packed[index], minCenter);
        continue;
      }
      packed[index] = Math.max(packed[index], packed[index - 1] + minGap);
    }

    let delta = average(targetCenters) - average(packed);
    if (packed[0] + delta < minCenter) {
      delta = minCenter - packed[0];
    }

    for (let index = 0; index < packed.length; index += 1) {
      const nextCenter = packed[index] + delta;
      result.set(sorted[index].data.id, nextCenter);
    }
  });

  return result;
}

function buildFlowFromTree(
  tree: RequirementNode,
  selectedNodeId: string | null,
  selectedTraceabilityId: string | null,
  selectedTraceabilityKind: "interface" | "test" | null,
  nodeStates: Record<string, RequirementVisualState>,
  pulseNodeId: string | null,
  editable: boolean,
  dependencySourcesVisible: boolean,
  dependencyTargetsVisible: boolean,
  showDependencies: boolean,
  traceabilityNodes: TraceabilityCanvasPayload | null,
  measuredTraceabilityHeights: Record<string, number>,
  showInterfaces: boolean,
  showTests: boolean,
  allTraceability: TraceabilityCanvasPayload | null,
  taskAssets: SubmissionTaskAssets | null,
  onMeasuredHeightChange?: (nodeId: string, height: number) => void,
): FlowGraph {
  const root = hierarchy(tree, (node) => node.children);
  const layout = createTreeLayout<RequirementNode>()
    .nodeSize([NODE_HEIGHT + VERTICAL_GAP, NODE_WIDTH + HORIZONTAL_GAP]);
  const positionedRoot = layout(root);
  const positionedNodes = positionedRoot.descendants();
  const minX = Math.min(...positionedNodes.map((node) => node.x));
  const minY = Math.min(...positionedNodes.map((node) => node.y));
  const baseRequirementCenters = new Map(
    positionedNodes.map((node) => [node.data.id, FLOW_MARGIN_Y + (node.x - minX)]),
  );
  const structureEdges: Edge[] = positionedRoot.links().map((link) => ({
    id: `${link.source.data.id}-${link.target.data.id}`,
    source: link.source.data.id,
    target: link.target.data.id,
    type: "step",
    animated: false,
    zIndex: 1,
  }));
  const validNodeIds = new Set(positionedNodes.map((node) => node.data.id));
  const dependencyEdges: Edge[] = [];
  const showSelectedDependenciesOnly = Boolean(selectedNodeId);
  positionedNodes.forEach((positioned) => {
    const sourceNode = positioned.data;
    if (showSelectedDependenciesOnly && sourceNode.id !== selectedNodeId) {
      return;
    }
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
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: DEPENDENCY_EDGE_COLOR,
        },
        style: {
          stroke: DEPENDENCY_EDGE_COLOR,
          strokeWidth: DEPENDENCY_EDGE_STROKE_WIDTH,
          strokeDasharray: DEPENDENCY_EDGE_DASHARRAY,
        },
      });
    });
  });
  const traceabilityEnabled = showInterfaces || showTests;
  const layoutTraceability = traceabilityEnabled ? allTraceability : traceabilityNodes;
  const hasNeededTraceability = traceabilityEnabled ? Boolean(allTraceability) : Boolean(traceabilityNodes);
  let requirementCenters = new Map(baseRequirementCenters);
  let traceabilityLayout: TraceabilityLayoutResult = {
    nodes: [],
    edges: [],
    relationEdges: [],
    desiredRequirementCenters: new Map(),
  };
  if (hasNeededTraceability && (traceabilityEnabled || selectedNodeId) && layoutTraceability) {
    const layoutData = layoutTraceability;
    const rightmostX = Math.max(...positionedNodes.map((node) => FLOW_MARGIN_X + (node.y - minY) - NODE_WIDTH / 2));
    const INTERFACE_TYPES = ["UI", "API", "FUNC", "DB"];
    const TEST_TYPES = ["Unit", "Integration", "E2E"];
    const COL_STRIDE = TRACEABILITY_NODE_WIDTH + TRACEABILITY_COLUMN_GAP;
    const baseX = rightmostX + NODE_WIDTH + TRACEABILITY_OFFSET_X;
    const interfaceColumnX: Record<string, number> = {};
    INTERFACE_TYPES.forEach((t, i) => { interfaceColumnX[t] = baseX + i * COL_STRIDE; });
    const testBaseX = baseX + INTERFACE_TYPES.length * COL_STRIDE;
    const testColumnX: Record<string, number> = {};
    TEST_TYPES.forEach((t, i) => { testColumnX[t] = testBaseX + i * COL_STRIDE; });
    const requirementNodeMap = new Map(positionedNodes.map((pn) => [pn.data.id, pn]));
    const interfacesByReqId = new Map<string, typeof layoutData.interfaces>();
    const testsByReqId = new Map<string, typeof layoutData.tests>();
    const interfaceNodeIdByInterfaceId = new Map<string, string>();
    const interfaceById = new Map<string, SubmissionTraceabilityInterface>();
    const selectedTraceabilityRequirementId = (() => {
      if (selectedTraceabilityKind === "interface" && selectedTraceabilityId) {
        const item = layoutData.interfaces.find((entry) => entry.interface_id === selectedTraceabilityId);
        return item ? resolveInterfaceEntryReqId(item, requirementNodeMap) : null;
      }
      if (selectedTraceabilityKind === "test" && selectedTraceabilityId) {
        const item = layoutData.tests.find((entry) => entry.test_id === selectedTraceabilityId);
        return item?.req_id ?? null;
      }
      return null;
    })();
    const hasExplicitRequirementSelection = Boolean(selectedNodeId);
    const focusedRequirementId = selectedNodeId ?? selectedTraceabilityRequirementId ?? null;
    const focusedRequirementInterfaces = focusedRequirementId
      ? layoutData.interfaces.filter((item) => resolveInterfaceEntryReqId(item, requirementNodeMap) === focusedRequirementId)
      : [];
    const topLevelInterfaceType = focusedRequirementId ? pickTopLevelInterfaceType(focusedRequirementInterfaces) : null;
    layoutData.interfaces.forEach((item) => {
      const reqId = resolveInterfaceEntryReqId(item, requirementNodeMap);
      if (!reqId) return;
      interfaceById.set(item.interface_id, item);
      const list = interfacesByReqId.get(reqId) ?? [];
      list.push(item);
      interfacesByReqId.set(reqId, list);
    });
    layoutData.tests.forEach((item) => {
      if (!requirementNodeMap.has(item.req_id)) return;
      const list = testsByReqId.get(item.req_id) ?? [];
      list.push(item);
      testsByReqId.set(item.req_id, list);
    });
    const anchorNodeIds = positionedNodes.map((pn) => pn.data.id);
    const computeTraceabilityLayout = (anchorCenters: Map<string, number>): TraceabilityLayoutResult => {
      const traceNodes: Node<FlowNodeData>[] = [];
      const traceEdges: Edge[] = [];
      const relationEdges: Edge[] = [];
      const desiredRequirementCenters = new Map<string, number>();
      const localInterfaceNodeIdByInterfaceId = new Map<string, string>();
      const traceabilityBlocks: Array<{
        anchorNodeId: string;
        anchorCenterY: number;
        blockHeight: number;
        desiredStartY: number;
        shouldRender: boolean;
        isFocusedRequirement: boolean;
        items: Array<{
          kind: "interface" | "test";
          column: string;
          nodeId: string;
          yOffset: number;
          height: number;
          interfaceItem?: SubmissionTraceabilityInterface;
          testItem?: SubmissionTraceabilityTest;
        }>;
      }> = [];

      for (const anchorNodeId of anchorNodeIds) {
        const anchorCenterY = anchorCenters.get(anchorNodeId) ?? baseRequirementCenters.get(anchorNodeId) ?? FLOW_MARGIN_Y;
        const shouldRender = traceabilityEnabled || anchorNodeId === focusedRequirementId;
        const isFocusedRequirement = anchorNodeId === focusedRequirementId;
        const directInterfaces = interfacesByReqId.get(anchorNodeId) ?? [];
        const nodeInterfaces = showInterfaces || !traceabilityEnabled ? directInterfaces : [];
        const nodeTests = showTests || !traceabilityEnabled ? (testsByReqId.get(anchorNodeId) ?? []) : [];
        const interfacesByType: Record<string, typeof nodeInterfaces> = {};
        INTERFACE_TYPES.forEach((t) => { interfacesByType[t] = []; });
        nodeInterfaces.forEach((item) => {
          const t = normalizeInterfaceType(item.type);
          interfacesByType[t].push(item);
        });

        const testsByType: Record<string, typeof nodeTests> = {};
        TEST_TYPES.forEach((t) => { testsByType[t] = []; });
        nodeTests.forEach((item) => {
          const t = normalizeTestType(item.type);
          testsByType[t].push(item);
        });
        const columnTraceabilityItems: Record<string, Array<{
          kind: "interface" | "test";
          column: string;
          nodeId: string;
          height: number;
          interfaceItem?: SubmissionTraceabilityInterface;
          testItem?: SubmissionTraceabilityTest;
        }>> = {};
        [...INTERFACE_TYPES, ...TEST_TYPES].forEach((column) => {
          columnTraceabilityItems[column] = [];
        });

        for (const ifaceType of INTERFACE_TYPES) {
          for (const item of interfacesByType[ifaceType]) {
            const nodeId = `traceability-interface:${item.interface_id}`;
            const height = measuredTraceabilityHeights[nodeId]
              ?? estimateTraceabilityNodeHeight(
                item.interface_id,
                fileBasename(item.file_path),
                formatTraceabilitySubtitle(item.file_path, item.first_line, item.type),
              );
            columnTraceabilityItems[ifaceType].push({
              kind: "interface",
              column: ifaceType,
              nodeId,
              height,
              interfaceItem: item,
            });
          }
        }

        for (const testType of TEST_TYPES) {
          for (const item of testsByType[testType]) {
            const nodeId = `traceability-test:${item.test_id}`;
            const height = measuredTraceabilityHeights[nodeId]
              ?? estimateTraceabilityNodeHeight(
                item.test_id,
                fileBasename(item.file_path),
                formatTraceabilitySubtitle(item.file_path, item.first_line, item.type),
              );
            columnTraceabilityItems[testType].push({
              kind: "test",
              column: testType,
              nodeId,
              height,
              testItem: item,
            });
          }
        }

        const orderedTraceabilityItems: Array<{
          kind: "interface" | "test";
          column: string;
          nodeId: string;
          yOffset: number;
          height: number;
          interfaceItem?: SubmissionTraceabilityInterface;
          testItem?: SubmissionTraceabilityTest;
        }> = [];
        const activeColumns = [...INTERFACE_TYPES, ...TEST_TYPES].filter(
          (column) => (columnTraceabilityItems[column] ?? []).length > 0,
        );
        let rowCursor = 0;
        const maxRows = activeColumns.reduce(
          (maxValue, column) => Math.max(maxValue, columnTraceabilityItems[column]?.length ?? 0),
          0,
        );

        for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
          const rowItems = activeColumns
            .map((column) => columnTraceabilityItems[column]?.[rowIndex] ?? null)
            .filter((item): item is NonNullable<typeof item> => item !== null);
          if (rowItems.length === 0) {
            continue;
          }
          const rowHeight = rowItems.reduce((maxValue, item) => Math.max(maxValue, item.height), 0);
          rowItems.forEach((item) => {
            orderedTraceabilityItems.push({
              ...item,
              yOffset: rowCursor + Math.max(0, (rowHeight - item.height) / 2),
            });
          });
          rowCursor += rowHeight + TRACEABILITY_ROW_GAP;
        }

        if (orderedTraceabilityItems.length === 0) {
          continue;
        }

        const blockHeight = rowCursor - TRACEABILITY_ROW_GAP;
        traceabilityBlocks.push({
          anchorNodeId,
          anchorCenterY,
          blockHeight,
          desiredStartY: anchorCenterY - blockHeight / 2,
          shouldRender,
          isFocusedRequirement,
          items: orderedTraceabilityItems,
        });
      }

      const TRACEABILITY_BLOCK_PADDING = 6;
      const sortedBlocks = [...traceabilityBlocks].sort((left, right) => left.desiredStartY - right.desiredStartY);
      const starts = sortedBlocks.map((block) => block.desiredStartY);

      const requiredSeparation = (
        upperBlock: typeof sortedBlocks[number],
        lowerBlock: typeof sortedBlocks[number],
      ): number => {
        let separation = 0;
        let hasSharedColumn = false;
        for (const upperItem of upperBlock.items) {
          for (const lowerItem of lowerBlock.items) {
            if (upperItem.column !== lowerItem.column) {
              continue;
            }
            hasSharedColumn = true;
            separation = Math.max(
              separation,
              upperItem.yOffset + upperItem.height + TRACEABILITY_BLOCK_PADDING - lowerItem.yOffset,
            );
          }
        }
        return hasSharedColumn ? Math.max(0, separation) : 0;
      };

      const maxIterations = Math.max(4, sortedBlocks.length * 6);
      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        let changed = false;

        for (let index = 0; index < sortedBlocks.length - 1; index += 1) {
          const separation = requiredSeparation(sortedBlocks[index], sortedBlocks[index + 1]);
          if (separation <= 0) {
            continue;
          }
          const gap = starts[index + 1] - starts[index];
          if (gap >= separation) {
            continue;
          }
          const needed = separation - gap;
          let moveUpper = needed / 2;
          let moveLower = needed - moveUpper;
          const maxUpperShift = Math.max(0, starts[index] - FLOW_MARGIN_Y);
          if (moveUpper > maxUpperShift) {
            const remainder = moveUpper - maxUpperShift;
            moveUpper = maxUpperShift;
            moveLower += remainder;
          }
          if (moveUpper > 0) {
            starts[index] -= moveUpper;
          }
          if (moveLower > 0) {
            starts[index + 1] += moveLower;
          }
          changed = true;
        }

        for (let index = 0; index < sortedBlocks.length; index += 1) {
          let lowerBound = FLOW_MARGIN_Y;
          if (index > 0) {
            lowerBound = Math.max(
              lowerBound,
              starts[index - 1] + requiredSeparation(sortedBlocks[index - 1], sortedBlocks[index]),
            );
          }
          let upperBound = Number.POSITIVE_INFINITY;
          if (index < sortedBlocks.length - 1) {
            upperBound = starts[index + 1] - requiredSeparation(sortedBlocks[index], sortedBlocks[index + 1]);
          }
          const target = Math.min(Math.max(sortedBlocks[index].desiredStartY, lowerBound), upperBound);
          if (Number.isFinite(target) && Math.abs(target - starts[index]) > 0.25) {
            starts[index] = target;
            changed = true;
          }
        }

        if (!changed) {
          break;
        }
      }

      if (starts.length > 0) {
        const minStart = Math.min(...starts);
        if (minStart > FLOW_MARGIN_Y) {
          const upwardShift = minStart - FLOW_MARGIN_Y;
          for (let index = 0; index < starts.length; index += 1) {
            starts[index] -= upwardShift;
          }
        }
      }

      sortedBlocks.forEach((block, blockIndex) => {
        const startY = starts[blockIndex];
        desiredRequirementCenters.set(block.anchorNodeId, block.anchorCenterY);
        if (!block.shouldRender) {
          return;
        }
        block.items.forEach((entry) => {
          const y = startY + entry.yOffset;
          if (entry.kind === "interface" && entry.interfaceItem) {
            const item = entry.interfaceItem;
            const ifaceType = entry.column;
            localInterfaceNodeIdByInterfaceId.set(item.interface_id, entry.nodeId);
            traceNodes.push({
              id: entry.nodeId,
              type: "traceabilityNode",
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
              position: { x: interfaceColumnX[ifaceType], y },
              data: {
                kind: "interface",
                label: item.interface_id,
                title: fileBasename(item.file_path),
                subtitle: formatInterfaceMeta(item),
                requirementNodeId: block.anchorNodeId,
                traceabilityId: item.interface_id,
                filePath: item.file_path,
                firstLine: item.first_line,
                itemType: item.type,
                dimmed: hasExplicitRequirementSelection
                  ? Boolean(focusedRequirementId) && !block.isFocusedRequirement
                  : Boolean(focusedRequirementId) && (!block.isFocusedRequirement || selectedTraceabilityKind === "interface" && selectedTraceabilityId !== item.interface_id),
                onMeasuredHeightChange,
                selected: selectedTraceabilityKind === "interface" && selectedTraceabilityId === item.interface_id,
                visualState: "default",
                pulse: false,
                dependencySourcesVisible: false,
                dependencyTargetsVisible: false,
              },
              draggable: false,
              selectable: false,
              zIndex: 4,
            });
            if (block.isFocusedRequirement && topLevelInterfaceType === ifaceType) {
              traceEdges.push({
                id: `traceability-link:${block.anchorNodeId}:${entry.nodeId}`,
                source: block.anchorNodeId,
                target: entry.nodeId,
                sourceHandle: "traceability-source",
                targetHandle: "traceability-target",
                type: "traceabilityEdge",
                animated: false,
                zIndex: 3,
                style: {
                  stroke: TRACEABILITY_EDGE_COLOR,
                  strokeWidth: 1.55,
                },
              });
            }
            return;
          }
          if (entry.kind === "test" && entry.testItem) {
            const item = entry.testItem;
            const testType = entry.column;
            traceNodes.push({
              id: entry.nodeId,
              type: "traceabilityNode",
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
              position: { x: testColumnX[testType], y },
              data: {
                kind: "test",
                label: item.test_id,
                title: fileBasename(item.file_path),
                subtitle: formatTestMeta(item),
                requirementNodeId: block.anchorNodeId,
                traceabilityId: item.test_id,
                filePath: item.file_path,
                firstLine: item.first_line,
                itemType: item.type,
                testStatus: item.status,
                dimmed: hasExplicitRequirementSelection
                  ? Boolean(focusedRequirementId) && !block.isFocusedRequirement
                  : Boolean(focusedRequirementId) && (!block.isFocusedRequirement || selectedTraceabilityKind === "test" && selectedTraceabilityId !== item.test_id),
                onMeasuredHeightChange,
                selected: selectedTraceabilityKind === "test" && selectedTraceabilityId === item.test_id,
                visualState: "default",
                pulse: false,
                dependencySourcesVisible: false,
                dependencyTargetsVisible: false,
              },
              draggable: false,
              selectable: false,
              zIndex: 4,
            });
            if (block.isFocusedRequirement) {
              traceEdges.push({
                id: `traceability-link:${block.anchorNodeId}:${entry.nodeId}`,
                source: block.anchorNodeId,
                target: entry.nodeId,
                sourceHandle: "traceability-source",
                targetHandle: "traceability-target",
                type: "traceabilityEdge",
                animated: false,
                zIndex: 3,
                style: {
                  stroke: TRACEABILITY_EDGE_COLOR,
                  strokeWidth: TRACEABILITY_EDGE_STROKE_WIDTH,
                  strokeDasharray: TRACEABILITY_EDGE_DASHARRAY,
                },
              });
            }
          }
        });
      });

      const relationEdgeIds = new Set<string>();
      focusedRequirementInterfaces.forEach((item) => {
        const sourceNodeId = localInterfaceNodeIdByInterfaceId.get(item.interface_id);
        if (!sourceNodeId) return;
        item.callers.forEach((callerId) => {
          const callerItem = interfaceById.get(callerId);
          if (!callerItem || resolveInterfaceEntryReqId(callerItem, requirementNodeMap) !== focusedRequirementId) {
            return;
          }
          const targetNodeId = sourceNodeId;
          const sourceRelationNodeId = localInterfaceNodeIdByInterfaceId.get(callerId);
          if (!sourceRelationNodeId || !targetNodeId || targetNodeId === sourceRelationNodeId) return;
          const edgeId = `traceability-interface-relation:${callerId}->${item.interface_id}`;
          if (relationEdgeIds.has(edgeId)) return;
          relationEdgeIds.add(edgeId);
          relationEdges.push({
            id: edgeId,
            source: sourceRelationNodeId,
            target: targetNodeId,
            sourceHandle: "interface-relation-source",
            targetHandle: "interface-relation-target",
            type: "interfaceRelationEdge",
            animated: false,
            zIndex: 4,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: INTERFACE_RELATION_EDGE_COLOR },
            style: {
              stroke: INTERFACE_RELATION_EDGE_COLOR,
              strokeWidth: INTERFACE_RELATION_EDGE_STROKE_WIDTH,
              strokeDasharray: INTERFACE_RELATION_EDGE_DASHARRAY,
            },
          });
        });
      });

      return { nodes: traceNodes, edges: traceEdges, relationEdges, desiredRequirementCenters };
    };

    traceabilityLayout = computeTraceabilityLayout(baseRequirementCenters);
  }
  const nodes: Node<FlowNodeData>[] = positionedNodes.map((positioned) => {
    const node = positioned.data;
    const requirementSelected = selectedNodeId === node.id;
    const nodeCenterY = requirementCenters.get(node.id) ?? baseRequirementCenters.get(node.id) ?? FLOW_MARGIN_Y;
    return {
      id: node.id,
      type: "requirementNode",
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: {
        x: FLOW_MARGIN_X + (positioned.y - minY) - NODE_WIDTH / 2,
        y: nodeCenterY - NODE_HEIGHT / 2,
      },
      data: {
        kind: "requirement",
        label: node.id,
        title: node.name,
        thumbnailSrc: getFirstDescriptionImage(node.description, taskAssets),
        type: node.type,
        selected: requirementSelected,
        visualState: nodeStates[node.id] ?? "default",
        pulse: pulseNodeId === node.id,
        dependencySourcesVisible: editable && dependencySourcesVisible,
        dependencyTargetsVisible,
      },
      draggable: false,
      zIndex: 2,
    };
  });
  return {
    nodes: [...nodes, ...traceabilityLayout.nodes],
    edges: showDependencies
      ? [...structureEdges, ...traceabilityLayout.edges, ...traceabilityLayout.relationEdges, ...dependencyEdges]
      : [...structureEdges, ...traceabilityLayout.edges, ...traceabilityLayout.relationEdges],
  };
}

function DependencyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}: EdgeProps<Edge>) {

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
  });
  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{
        stroke: DEPENDENCY_EDGE_COLOR,
        strokeWidth: DEPENDENCY_EDGE_STROKE_WIDTH,
        strokeDasharray: DEPENDENCY_EDGE_DASHARRAY,
        ...style,
      }}
      interactionWidth={20}
    />
  );
}

function TraceabilityEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<Edge>) {

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
    curvature: 0.2,
  });
  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        stroke: "#94a3b8",
        strokeWidth: 1.3,
        strokeDasharray: "6 5",
      }}
      interactionWidth={16}
    />
  );
}

function InterfaceRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}: EdgeProps<Edge>) {

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
    curvature: 0.28,
  });
  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{
        stroke: INTERFACE_RELATION_EDGE_COLOR,
        strokeWidth: INTERFACE_RELATION_EDGE_STROKE_WIDTH,
        strokeDasharray: INTERFACE_RELATION_EDGE_DASHARRAY,
        ...style,
      }}
      interactionWidth={18}
    />
  );
}

function TraceabilityFlowNode({ id, data }: NodeProps<Node<FlowNodeData>>) {
  const sideNodeRef = useRef<HTMLDivElement | null>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const lastMeasuredHeightRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!sideNodeRef.current || !data.onMeasuredHeightChange) {
      return;
    }
    const element = sideNodeRef.current;
    let disposed = false;
    let frameId: number | null = null;
    const reportHeight = () => {
      const measuredHeight = measureTraceabilityNodeHeight(element);
      if (!measuredHeight) {
        return;
      }
      const normalizedHeight = Math.ceil(measuredHeight);
      if (lastMeasuredHeightRef.current === normalizedHeight) {
        return;
      }
      lastMeasuredHeightRef.current = normalizedHeight;
      data.onMeasuredHeightChange?.(id, normalizedHeight);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        if (!disposed) {
          updateNodeInternals(id);
        }
      });
    };
    reportHeight();
    const observer = new ResizeObserver(() => {
      reportHeight();
    });
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [data.onMeasuredHeightChange, id, updateNodeInternals]);
  const itemTypeKey = (data.itemType || "").toLowerCase();
  const typeColor = TRACEABILITY_TYPE_COLORS[itemTypeKey];
  const typeClassName = typeColor ? `task-flow-traceability-node--type-${itemTypeKey}` : "";
  const testStatusClassName = data.kind === "test" && data.testStatus ? `task-flow-traceability-node--status-${data.testStatus}` : "";
  return (
    <div
      ref={sideNodeRef}
      className={`task-flow-card task-flow-traceability-node task-flow-traceability-node--${data.kind} ${typeClassName} ${testStatusClassName} ${data.selected ? "selected" : ""}`}
      style={{
        borderLeftColor: typeColor,
        borderLeftWidth: typeColor ? "4px" : undefined,
        opacity: data.dimmed ? 0.4 : undefined,
      }}
    >
      <Handle
        id="traceability-target"
        type="target"
        position={Position.Left}
        className="task-flow-handle traceability-target"
        isConnectable={false}
      />
      {data.kind === "interface" ? (
        <>
          <Handle
            id="interface-relation-target"
            type="target"
            position={Position.Left}
            className="task-flow-handle interface-relation-target"
            isConnectable={false}
          />
          <Handle
            id="interface-relation-source"
            type="source"
            position={Position.Right}
            className="task-flow-handle interface-relation-source"
            isConnectable={false}
          />
        </>
      ) : null}
      <div className="task-flow-traceability-head">
        <span className="task-flow-traceability-kicker">{data.kind === "interface" ? "INTERFACE" : "TEST"}</span>
        {data.itemType ? (
          <span
            className="task-flow-traceability-type-badge"
            style={{
              backgroundColor: typeColor,
              color: typeColor ? "#ffffff" : undefined,
            }}
          >
            {data.itemType}
          </span>
        ) : null}
      </div>
      <div className="task-flow-traceability-body">
        <strong>{data.label}</strong>
      </div>
      <span className="task-flow-traceability-filename">{data.title}</span>
      {data.subtitle ? <span className="task-flow-traceability-subtitle">{data.subtitle}</span> : null}
    </div>
  );
}

function RequirementFlowNode({ data }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div
      className={`task-flow-card task-flow-requirement-node ${data.selected ? "active" : ""} ${data.dimmed ? "dimmed" : ""} ${data.type === "ATOMIC" ? "atomic" : ""} visual-${data.visualState} ${data.pulse ? "pulse" : ""}`}
    >
      {data.dependencyTargetsVisible ? <span className="task-flow-handle-visual dependency-target" aria-hidden="true" /> : null}
      <Handle
        id="dependency-target"
        type="target"
        position={Position.Left}
        className={`task-flow-handle dependency-target ${data.dependencyTargetsVisible ? "visible" : ""}`}
        isConnectable={data.dependencyTargetsVisible}
      />
      <Handle
        id="traceability-source"
        type="source"
        position={Position.Right}
        className="task-flow-handle traceability-source"
        isConnectable={false}
      />
      <div className="task-flow-requirement-body">
        <div className="task-flow-requirement-copy">
          <span className="task-flow-requirement-id">{data.label}</span>
          <strong>{data.title}</strong>
        </div>
        {data.thumbnailSrc ? (
          <div className="task-flow-requirement-thumbnail" aria-hidden="true">
            <img key={data.thumbnailSrc} src={data.thumbnailSrc} alt="" loading="eager" decoding="sync" />
          </div>
        ) : null}
      </div>
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
          <span>Design</span>
        </div>
        <div className="task-flow-legend-item">
          <span className="task-flow-legend-swatch implement" />
          <span>Implement</span>
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

function TreeCanvasInner({
  tree,
  selectedNodeId,
  selectedTraceabilityId = null,
  selectedTraceabilityKind = null,
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
  taskAssets = null,
  nodeStates = {},
  focusNodeId = null,
  pulseNodeId = null,
  showLegend = false,
  showCanvasToolbar = true,
  detailTestId,
  autoFitOnTreeChange = true,
  traceabilityNodes = null,
  showInterfaces: showInterfacesProp,
  showTests: showTestsProp,
  onShowInterfacesChange,
  onShowTestsChange,
  allTraceability = null,
  onRequestAllTraceability,
  onTraceabilityOverlayChange,
  onTraceabilityNodeClick,
  canvasRef,
}: TreeCanvasInnerProps) {
  const reactFlow = useReactFlow();
  const storeApi = useStoreApi();
  const lastFocusKeyRef = useRef<string | null>(null);
  const hasInitializedViewRef = useRef(false);
  const previewFrameRef = useRef<number | null>(null);
  const previewPointRef = useRef<{ x: number; y: number } | null>(null);
  const previewPathRef = useRef<SVGPathElement | null>(null);
  const previewArrowPathRef = useRef<SVGPathElement | null>(null);
  const previewSourcePointRef = useRef<{ x: number; y: number } | null>(null);

  const [detailWidth, setDetailWidth] = useState(392);
  const [isResizingDetail, setIsResizingDetail] = useState(false);
  const [measuredTraceabilityHeights, setMeasuredTraceabilityHeights] = useState<Record<string, number>>({});
  const [dependencyConnectionActive, setDependencyConnectionActive] = useState(false);
  const [clickConnectionSourceId, setClickConnectionSourceId] = useState<string | null>(null);
  const [showDependencies, setShowDependencies] = useState(mode === "editable");
  const [showInterfacesInternal, setShowInterfacesInternal] = useState(false);
  const [showTestsInternal, setShowTestsInternal] = useState(false);
  const showInterfaces = showInterfacesProp ?? showInterfacesInternal;
  const showTests = showTestsProp ?? showTestsInternal;
  const setShowInterfaces = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    const resolved = resolveToggleState(showInterfaces, next);
    if (showInterfacesProp === undefined) {
      setShowInterfacesInternal(resolved);
    }
    onShowInterfacesChange?.(resolved);
  }, [onShowInterfacesChange, showInterfaces, showInterfacesProp]);
  const setShowTests = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    const resolved = resolveToggleState(showTests, next);
    if (showTestsProp === undefined) {
      setShowTestsInternal(resolved);
    }
    onShowTestsChange?.(resolved);
  }, [onShowTestsChange, showTests, showTestsProp]);
  const handleMeasuredTraceabilityHeightChange = useCallback((nodeId: string, height: number) => {
    if (!nodeId || !Number.isFinite(height)) {
      return;
    }
    const normalizedHeight = Math.ceil(height);
    setMeasuredTraceabilityHeights((current) => {
      if (current[nodeId] === normalizedHeight) {
        return current;
      }
      return { ...current, [nodeId]: normalizedHeight };
    });
  }, []);

  useEffect(() => {
    if (!isResizingDetail) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const viewportWidth = window.innerWidth;
      const maxWidth = Math.max(320, Math.round(viewportWidth * 0.48));
      const nextWidth = Math.max(320, Math.min(maxWidth, viewportWidth - event.clientX));
      setDetailWidth(nextWidth);
      if (!detailExpanded) {
        onDetailExpandedChange(true);
      }
    };

    const handlePointerUp = () => {
      setIsResizingDetail(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [detailExpanded, isResizingDetail, onDetailExpandedChange]);

  useEffect(() => {
    if (!traceabilityNodes || !selectedNodeId) {
      setMeasuredTraceabilityHeights({});
      return;
    }
    const validNodeIds = new Set([
      ...traceabilityNodes.interfaces.map((item) => `traceability-interface:${item.interface_id}`),
      ...traceabilityNodes.tests.map((item) => `traceability-test:${item.test_id}`),
    ]);
    setMeasuredTraceabilityHeights((current) => {
      const nextEntries = Object.entries(current).filter(([nodeId]) => validNodeIds.has(nodeId));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [selectedNodeId, traceabilityNodes]);

  useEffect(() => {
    if (!(showInterfaces || showTests)) {
      return;
    }
    if (allTraceability) {
      return;
    }
    onRequestAllTraceability?.();
  }, [allTraceability, onRequestAllTraceability, showInterfaces, showTests]);

  useEffect(() => {
    onTraceabilityOverlayChange?.({ showInterfaces, showTests });
  }, [onTraceabilityOverlayChange, showInterfaces, showTests]);
  const baseFlow = useMemo(
    () => buildFlowFromTree(
      tree,
      selectedNodeId,
      selectedTraceabilityId,
      selectedTraceabilityKind,
      nodeStates,
      pulseNodeId,
      mode === "editable",
      !dependencyConnectionActive,
      dependencyConnectionActive,
      showDependencies,
      traceabilityNodes,
      measuredTraceabilityHeights,
      showInterfaces,
      showTests,
      allTraceability ?? null,
      taskAssets,
      handleMeasuredTraceabilityHeightChange,
    ),
    [
      dependencyConnectionActive,
      handleMeasuredTraceabilityHeightChange,
      measuredTraceabilityHeights,
      mode,
      nodeStates,
      pulseNodeId,
      selectedTraceabilityId,
      selectedTraceabilityKind,
      selectedNodeId,
      showDependencies,
      traceabilityNodes,
      tree,
      showInterfaces,
      showTests,
      allTraceability,
      taskAssets,
    ],
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(baseFlow.nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(baseFlow.edges);
  const flow = { nodes: flowNodes, edges: flowEdges };

  useEffect(() => {
    setFlowEdges((currentEdges) => {
      if (currentEdges.length === baseFlow.edges.length && currentEdges.every((edge, index) => edge.id === baseFlow.edges[index]?.id)) {
        let changed = false;
        const nextEdges = currentEdges.map((edge, index) => {
          const incoming = baseFlow.edges[index];
          if (
            edge.source === incoming.source &&
            edge.target === incoming.target &&
            edge.type === incoming.type &&
            edge.animated === incoming.animated &&
            edge.zIndex === incoming.zIndex
          ) {
            return edge;
          }
          changed = true;
          return { ...edge, ...incoming };
        });
        return changed ? nextEdges : currentEdges;
      }
      return baseFlow.edges;
    });
  }, [baseFlow.edges, setFlowEdges]);

  useEffect(() => {
    setFlowNodes((currentNodes) => {
      const incomingById = new Map(baseFlow.nodes.map((node) => [node.id, node]));
      if (currentNodes.length === baseFlow.nodes.length && currentNodes.every((node) => incomingById.has(node.id))) {
        let changed = false;
        const nextNodes = currentNodes.map((node) => {
          const incoming = incomingById.get(node.id);
          if (!incoming) {
            return node;
          }
          const currentData = node.data;
          const incomingData = incoming.data;
          if (
            node.position.x === incoming.position.x &&
            node.position.y === incoming.position.y &&
            node.type === incoming.type &&
            node.zIndex === incoming.zIndex &&
            node.hidden === incoming.hidden &&
            currentData?.kind === incomingData?.kind &&
            currentData?.label === incomingData?.label &&
            currentData?.title === incomingData?.title &&
            currentData?.thumbnailSrc === incomingData?.thumbnailSrc &&
            currentData?.type === incomingData?.type &&
            currentData?.selected === incomingData?.selected &&
            currentData?.traceabilityId === incomingData?.traceabilityId &&
            currentData?.visualState === incomingData?.visualState &&
            currentData?.pulse === incomingData?.pulse &&
            currentData?.dimmed === incomingData?.dimmed &&
            currentData?.label === incomingData?.label &&
            currentData?.title === incomingData?.title &&
            currentData?.subtitle === incomingData?.subtitle &&
            currentData?.itemType === incomingData?.itemType &&
            currentData?.filePath === incomingData?.filePath &&
            currentData?.firstLine === incomingData?.firstLine &&
            currentData?.dependencySourcesVisible === incomingData?.dependencySourcesVisible &&
            currentData?.dependencyTargetsVisible === incomingData?.dependencyTargetsVisible
          ) {
            return node;
          }
          changed = true;
          return {
            ...node,
            position: incoming.position,
            type: incoming.type,
            zIndex: incoming.zIndex,
            hidden: incoming.hidden,
            data: { ...currentData, ...incomingData },
          };
        });
        return changed ? nextNodes : currentNodes;
      }
      return baseFlow.nodes;
    });
  }, [baseFlow.nodes, setFlowNodes]);
  const edgeTypes = useMemo(
    () => ({
      dependencyEdge: DependencyEdge,
      traceabilityEdge: TraceabilityEdge,
      interfaceRelationEdge: InterfaceRelationEdge,
    }),
    [],
  );
  const nodeTypes = useMemo(
    () => ({ requirementNode: RequirementFlowNode, traceabilityNode: TraceabilityFlowNode }),
    [],
  );
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
    lastFocusKeyRef.current = `${focusNodeId}:${pulseNodeId ?? ""}`;
  }, [focusNodeId, pulseNodeId]);
  const handleZoomIn = useCallback(() => {
    reactFlow.zoomIn({ duration: 180 });
  }, [reactFlow]);
  const handleZoomOut = useCallback(() => {
    reactFlow.zoomOut({ duration: 180 });
  }, [reactFlow]);
  const handleFitView = useCallback(() => {
    reactFlow.fitView({ padding: 0.22, duration: 260, maxZoom: 1.15 });
  }, [reactFlow]);
  useImperativeHandle(canvasRef, () => ({
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    fitView: handleFitView,
  }), [canvasRef, handleFitView, handleZoomIn, handleZoomOut]);
  const detailContent = selectedNode
    ? (renderDetailContent ? renderDetailContent(selectedNode) : <RequirementNodeDetailContent node={selectedNode} mode="readonly" />)
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
        {showCanvasToolbar ? (
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
          <Tooltip title={showInterfaces ? "Hide interfaces" : "Show interfaces"}>
            <button
              type="button"
              className={`icon-tool-btn ${showInterfaces ? "active" : ""}`}
              onClick={() => setShowInterfaces((current) => !current)}
            >
              <span style={{ fontSize: 11, fontWeight: 600 }}>IF</span>
            </button>
          </Tooltip>
          <Tooltip title={showTests ? "Hide tests" : "Show tests"}>
            <button
              type="button"
              className={`icon-tool-btn ${showTests ? "active" : ""}`}
              onClick={() => setShowTests((current) => !current)}
            >
              <span style={{ fontSize: 11, fontWeight: 600 }}>T</span>
            </button>
          </Tooltip>
        </div>
        ) : null}
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
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(event, node) => {
              const target = event.target as HTMLElement | null;
              if (target?.closest(".task-flow-handle")) {
                return;
              }
              if (node.data.kind === "interface" || node.data.kind === "test") {
                onTraceabilityNodeClick?.({
                  kind: node.data.kind,
                  id: node.data.label,
                  requirementNodeId: node.data.requirementNodeId ?? null,
                  filePath: node.data.filePath ?? "",
                  firstLine: node.data.firstLine ?? null,
                });
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
            connectionLineType={ConnectionLineType.Step}
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
              type: "step",
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
      {selectedNode && detailPlacement === "right" && detailExpanded ? (
        <div
          className="create-task-detail-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize detail panel"
          onPointerDown={(event) => {
            if (window.innerWidth <= 820) {
              return;
            }
            event.preventDefault();
            setIsResizingDetail(true);
          }}
        >
          <span className="create-task-detail-resizer-handle" />
        </div>
      ) : null}
      {selectedNode ? (
        <div
          data-quickstart-id={detailTestId}
          className={`create-task-detail-drawer detail-placement-${detailPlacement} ${detailExpanded ? "expanded" : "collapsed"}`}
          style={detailPlacement === "right" && detailExpanded ? { width: `${detailWidth}px` } : undefined}
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

const RequirementTreeCanvas = forwardRef<RequirementTreeCanvasHandle, RequirementTreeCanvasProps>(function RequirementTreeCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} canvasRef={ref} />
    </ReactFlowProvider>
  );
});

export default RequirementTreeCanvas;
