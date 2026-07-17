import { Graph, type EdgeData, type GraphData, type NodeData } from "@antv/g6";
import { hierarchy, tree as createTreeLayout } from "d3-hierarchy";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { RequirementNode } from "../../lib/taskTree";
import type {
  RequirementVisualState,
  SubmissionTraceabilityInterface,
  SubmissionTraceabilityPayload,
  SubmissionTraceabilityTest,
} from "../../lib/types";

type FactoryNodeKind =
  | "requirement"
  | "interface"
  | "test"
  | "lane-header"
  | "lane-container"
  | "section-frame"
  | "section-header"
  | "flow-anchor"
  | "flow-label";
type InterfaceLane = "ui" | "api" | "func" | "db";
type TestLane = "unit" | "integration" | "e2e";
type FactoryEdgeKind =
  | "requirement-hierarchy"
  | "requirement-interface"
  | "requirement-test"
  | "interface-call"
  | "factory-flow";

type FactoryNodeMeta = {
  kind: FactoryNodeKind;
  requirementId?: string | null;
  interfaceId?: string | null;
  testId?: string | null;
  lane?: InterfaceLane | TestLane;
  interfaceItem?: SubmissionTraceabilityInterface;
  testItem?: SubmissionTraceabilityTest;
};

type SubmissionFactoryCanvasProps = {
  tree: RequirementNode;
  selectedNodeId: string | null;
  selectionActive?: boolean;
  onSelectNode: (nodeId: string | null) => void;
  nodeStates?: Record<string, RequirementVisualState>;
  allTraceability?: SubmissionTraceabilityPayload | null;
  onRequestAllTraceability?: () => void;
  showInterfaces?: boolean;
  showTests?: boolean;
  selectedTraceabilityId?: string | null;
  selectedTraceabilityKind?: "interface" | "test" | null;
  onSelectInterface?: (payload: {
    id: string;
    requirementNodeId: string | null;
    filePath: string;
    firstLine: string | null;
  }) => void;
  onSelectTest?: (payload: {
    id: string;
    requirementNodeId: string | null;
    filePath: string;
    firstLine: string | null;
  }) => void;
};

export type SubmissionFactoryCanvasHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
};

type GraphModel = {
  data: GraphData;
};

type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const REQUIREMENT_NODE_WIDTH = 236;
const REQUIREMENT_NODE_HEIGHT = 104;
const INTERFACE_NODE_WIDTH = 204;
const INTERFACE_NODE_HEIGHT = 88;
const TEST_NODE_WIDTH = 196;
const TEST_NODE_HEIGHT = 90;
const LANE_HEADER_WIDTH = 160;
const LANE_HEADER_HEIGHT = 34;
const LANE_CONTAINER_MIN_HEIGHT = 88;
const LEFT_MARGIN = 72;
const TOP_MARGIN = 78;
const REQUIREMENT_COLUMN_GAP = 104;
const REQUIREMENT_ROW_GAP = 42;
const INTERFACE_AREA_OFFSET = 420;
const INTERFACE_COLUMN_GAP = 34;
const INTERFACE_ROW_GAP = 28;
const INTERFACE_SECTION_GAP = 34;
const TRACEABILITY_SECTION_GAP = 42;
const INTERFACE_LANE_PADDING_X = 28;
const INTERFACE_LANE_PADDING_Y = 24;
const INTERFACE_LANE_HEADER_GAP = 22;
const SECTION_FRAME_PADDING_X = 44;
const SECTION_FRAME_PADDING_TOP = 64;
const SECTION_FRAME_PADDING_BOTTOM = 42;
const SECTION_HEADER_HEIGHT = 72;
const SECTION_MIN_WIDTH = 344;
const FLOW_LANE_WIDTH = 108;
const INTERFACE_LANE_ORDERS: InterfaceLane[] = ["ui", "api", "func", "db"];
const TEST_LANE_ORDERS: TestLane[] = ["e2e", "integration", "unit"];

function truncateLabel(value: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}

function requirementStateStyle(state: RequirementVisualState | undefined, nodeType: RequirementNode["type"]) {
  switch (state) {
    case "design":
      return { fill: "#fff7e8", stroke: "#d67e0e" };
    case "implement":
      return { fill: "#edf4ff", stroke: "#2d68d6" };
    case "test-passed":
      return { fill: "#effdf5", stroke: "#188a54" };
    case "test-failed":
      return { fill: "#fff2f2", stroke: "#d76565" };
    default:
      return { fill: "#ffffff", stroke: "#8f9baa" };
  }
}

function interfaceLaneFromType(value: string): InterfaceLane {
  const normalized = value.trim().toUpperCase();
  if (normalized === "UI") return "ui";
  if (normalized === "FUNC") return "func";
  if (normalized === "DB") return "db";
  return "api";
}

function interfaceLaneStyle(lane: InterfaceLane) {
  switch (lane) {
    case "ui":
      return { fill: "rgba(78, 164, 199, 0.2)", stroke: "#264653", accent: "#264653" };
    case "api":
      return { fill: "rgba(42, 157, 143, 0.2)", stroke: "#2a9d8f", accent: "#2a9d8f" };
    case "func":
      return { fill: "rgba(244, 162, 97, 0.2)", stroke: "#f4a261", accent: "#f4a261" };
    case "db":
      return { fill: "rgba(149, 118, 201, 0.2)", stroke: "#9576c9", accent: "#9576c9" };
  }
}

function testLaneFromType(value: string): TestLane {
  const normalized = value.trim().toLowerCase();
  if (normalized === "integration") return "integration";
  if (normalized === "e2e") return "e2e";
  return "unit";
}

function testLaneStyle(lane: TestLane) {
  switch (lane) {
    case "unit":
      return { fill: "rgba(71, 111, 149, 0.5)", stroke: "#476f95", accent: "#476f95" };
    case "integration":
      return { fill: "rgba(117, 147, 175, 0.5)", stroke: "#7593af", accent: "#7593af" };
    case "e2e":
      return { fill: "rgba(163, 183, 202, 0.5)", stroke: "#a3b7ca", accent: "#a3b7ca" };
  }
}

function testResultFill(status: SubmissionTraceabilityTest["status"]) {
  if (status === "passed") {
    return "#eaf8ef";
  }
  if (status === "failed") {
    return "#fdecec";
  }
  return "#f3f4f6";
}

function testResultStroke(status: SubmissionTraceabilityTest["status"]) {
  if (status === "passed") {
    return "#16a34a";
  }
  if (status === "failed") {
    return "#dc2626";
  }
  return "#9ca3af";
}

function nodeLabelFontFamily() {
  return "'Aptos', 'Segoe UI', 'Helvetica Neue', sans-serif";
}

function resolveNodeAccent(meta: FactoryNodeMeta | undefined) {
  if (meta?.kind === "interface" && meta.lane) {
    return interfaceLaneStyle(meta.lane as InterfaceLane).accent;
  }
  if (meta?.kind === "test" && meta.lane) {
    return testLaneStyle(meta.lane as TestLane).accent;
  }
  return "#0f766e";
}

function resolveNodeHighlightFill(datum: NodeData) {
  const meta = (datum.data ?? {}) as FactoryNodeMeta;
  const style = (datum.style ?? {}) as { stroke?: string };
  if ((meta.kind === "requirement" || meta.kind === "test") && style.stroke) {
    return style.stroke;
  }
  return resolveNodeAccent(meta);
}

function resolveNodeHighlightSize(datum: NodeData, scale: number): number | [number, number] | undefined {
  const style = (datum.style ?? {}) as { size?: number | [number, number] };
  const baseSize = style.size;
  if (Array.isArray(baseSize)) {
    return [baseSize[0] * scale, baseSize[1] * scale] as [number, number];
  }
  if (typeof baseSize === "number") {
    return baseSize * scale;
  }
  return baseSize;
}

function resolveNodeHighlightLabelFontSize(datum: NodeData, scale: number): number | undefined {
  const style = (datum.style ?? {}) as { labelFontSize?: number };
  const baseSize = style.labelFontSize;
  if (typeof baseSize === "number") {
    return baseSize * scale;
  }
  return baseSize;
}

function resolveNodeHighlightLabelLineHeight(datum: NodeData, scale: number): number | undefined {
  const style = (datum.style ?? {}) as { labelLineHeight?: number };
  const baseLineHeight = style.labelLineHeight;
  if (typeof baseLineHeight === "number") {
    return baseLineHeight * scale;
  }
  return baseLineHeight;
}

function resolveEdgeHighlightColor(kind: FactoryEdgeKind | string) {
  if (kind === "factory-flow") {
    return "#f09b07";
  }
  if (kind === "interface-call") {
    return "#000000";
  }
  if (kind === "requirement-test") {
    return "#0011ff";
  }
  return "#0f766e";
}

function sectionFrameStyle(section: "requirements" | "interfaces" | "tests") {
  switch (section) {
    case "requirements":
      return {
        fill: "rgba(255, 255, 255, 0)",
        stroke: "#9ca3af",
        accent: "#f8fafc",
      };
    case "interfaces":
      return {
        fill: "rgba(255, 255, 255, 0)",
        stroke: "#9ca3af",
        accent: "#f8fafc",
      };
    case "tests":
      return {
        fill: "rgba(255, 255, 255, 0)",
        stroke: "#9ca3af",
        accent: "#f8fafc",
      };
  }
}

function resolveInterfacePreferredColumns(itemCount: number) {
  return Math.max(1, Math.min(itemCount || 1, itemCount > 12 ? 5 : itemCount > 6 ? 4 : 3));
}

function resolveTestPreferredColumns(itemCount: number) {
  return Math.max(1, Math.min(itemCount || 1, itemCount > 9 ? 5 : itemCount > 4 ? 4 : 3));
}

function resolveLaneSectionWidth(itemCount: number, nodeWidth: number, preferredColumns: number) {
  const columns = Math.max(1, Math.min(itemCount || 1, preferredColumns));
  return (INTERFACE_LANE_PADDING_X * 2)
    + (columns * nodeWidth)
    + (Math.max(0, columns - 1) * INTERFACE_COLUMN_GAP);
}

function createBounds(): Bounds {
  return {
    left: Number.POSITIVE_INFINITY,
    top: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    bottom: Number.NEGATIVE_INFINITY,
  };
}

function includeBounds(bounds: Bounds, centerX: number, centerY: number, width: number, height: number) {
  bounds.left = Math.min(bounds.left, centerX - (width / 2));
  bounds.top = Math.min(bounds.top, centerY - (height / 2));
  bounds.right = Math.max(bounds.right, centerX + (width / 2));
  bounds.bottom = Math.max(bounds.bottom, centerY + (height / 2));
}

function includeBoundsFromRect(bounds: Bounds, left: number, top: number, width: number, height: number) {
  bounds.left = Math.min(bounds.left, left);
  bounds.top = Math.min(bounds.top, top);
  bounds.right = Math.max(bounds.right, left + width);
  bounds.bottom = Math.max(bounds.bottom, top + height);
}

function hasBounds(bounds: Bounds) {
  return Number.isFinite(bounds.left)
    && Number.isFinite(bounds.top)
    && Number.isFinite(bounds.right)
    && Number.isFinite(bounds.bottom);
}

function buildElementStateMap(data: GraphData) {
  const states: Record<string, string[]> = {};
  [...(data.nodes ?? []), ...(data.edges ?? []), ...(data.combos ?? [])].forEach((item) => {
    states[String(item.id)] = Array.isArray(item.states) ? [...item.states] : [];
  });
  return states;
}

function RequirementStateLegend() {
  return (
    <div className="task-flow-legend">
      <div className="task-flow-legend-title">Legend</div>
      <div className="task-flow-legend-list">
        <div className="task-flow-legend-item">
          <span className="task-flow-legend-swatch design" />
          <span>Designing</span>
        </div>
        <div className="task-flow-legend-item">
          <span className="task-flow-legend-swatch implement" />
          <span>Implementing</span>
        </div>
        <div className="task-flow-legend-item">
          <span className="task-flow-legend-swatch test-passed" />
          <span>Passed</span>
        </div>
        <div className="task-flow-legend-item">
          <span className="task-flow-legend-swatch test-failed" />
          <span>Failed</span>
        </div>
      </div>
    </div>
  );
}

function parseInterfaceNodeTitle(item: SubmissionTraceabilityInterface) {
  const fallback = item.interface_id;
  const normalized = item.content.trim();
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
    return truncateLabel(title || fallback, 40);
  } catch {
    return fallback;
  }
}

function fileBasename(filePath: string) {
  const segments = filePath.split(/[\\/]/);
  return segments[segments.length - 1] || filePath;
}

function parseTestNodeTitle(item: SubmissionTraceabilityTest) {
  const location = fileBasename(item.file_path).trim();
  return truncateLabel(location || item.test_id, 34);
}

function formatTraceabilityFirstLine(firstLine: string | null) {
  const normalized = typeof firstLine === "string" ? firstLine.trim() : "";
  if (!normalized) {
    return null;
  }
  if (/^[0-9]+$/.test(normalized)) {
    return `Line ${normalized}`;
  }
  return truncateLabel(normalized, 26);
}

function buildNodeLabelText(nodeId: string, name: string, firstLine?: string | null) {
  const lines = [nodeId, name];
  const firstLineLabel = formatTraceabilityFirstLine(firstLine ?? null);
  if (firstLineLabel) {
    lines.push(firstLineLabel);
  }
  return lines.join("\n");
}

function buildInterfaceRelationPairs(interfaces: SubmissionTraceabilityInterface[]) {
  const existingIds = new Set(interfaces.map((item) => item.interface_id));
  const pairs = new Map<string, { source: string; target: string }>();

  interfaces.forEach((item) => {
    item.callees.forEach((calleeId) => {
      if (!existingIds.has(calleeId) || calleeId === item.interface_id) {
        return;
      }
      const edgeId = `call:${item.interface_id}->${calleeId}`;
      if (!pairs.has(edgeId)) {
        pairs.set(edgeId, { source: item.interface_id, target: calleeId });
      }
    });
  });

  return Array.from(pairs.entries()).map(([id, pair]) => ({ id, ...pair }));
}

function buildGraphModel({
  tree,
  nodeStates,
  allTraceability,
  showInterfaces,
  showTests,
  selectedNodeId,
  selectionActive,
  selectedTraceabilityId,
  selectedTraceabilityKind,
  width,
}: {
  tree: RequirementNode;
  nodeStates: Record<string, RequirementVisualState>;
  allTraceability: SubmissionTraceabilityPayload | null | undefined;
  showInterfaces: boolean;
  showTests: boolean;
  selectedNodeId: string | null;
  selectionActive: boolean;
  selectedTraceabilityId: string | null | undefined;
  selectedTraceabilityKind: "interface" | "test" | null | undefined;
  width: number;
}): GraphModel {
  const root = hierarchy(tree, (node) => node.children);
  const layout = createTreeLayout<RequirementNode>()
    .nodeSize([REQUIREMENT_NODE_HEIGHT + REQUIREMENT_ROW_GAP, REQUIREMENT_NODE_WIDTH + REQUIREMENT_COLUMN_GAP]);
  const positionedRoot = layout(root);
  const positionedNodes = positionedRoot.descendants();
  const minX = Math.min(...positionedNodes.map((node) => node.x));
  const minY = Math.min(...positionedNodes.map((node) => node.y));
  const maxRequirementX = Math.max(...positionedNodes.map((node) => LEFT_MARGIN + (node.y - minY)));

  const sectionNodes: NodeData[] = [];
  const flowNodes: NodeData[] = [];
  const requirementNodes: NodeData[] = [];
  const requirementEdges: EdgeData[] = [];
  const flowEdges: EdgeData[] = [];
  const requirementIndexById = new Map<string, number>();
  const requirementPositionById = new Map<string, { order: number; y: number }>();
  const requirementBounds = createBounds();
  const interfaceBounds = createBounds();
  const testBounds = createBounds();

  positionedNodes.forEach((node, index) => {
    const nodeX = LEFT_MARGIN + (node.y - minY);
    const nodeY = TOP_MARGIN + (node.x - minX);
    requirementIndexById.set(node.data.id, index);
    requirementPositionById.set(node.data.id, { order: index, y: nodeY });
    const state = nodeStates[node.data.id];
    const visual = requirementStateStyle(state, node.data.type);

    requirementNodes.push({
      id: node.data.id,
      type: "rect",
      style: {
        x: nodeX,
        y: nodeY,
        size: [REQUIREMENT_NODE_WIDTH, REQUIREMENT_NODE_HEIGHT],
        radius: 12,
        fill: visual.fill,
        stroke: visual.stroke,
        lineWidth: 1.4,
        shadowColor: "rgba(15, 23, 42, 0.06)",
        shadowBlur: 10,
        shadowOffsetX: 0,
        shadowOffsetY: 4,
        labelText: buildNodeLabelText(node.data.id, truncateLabel(node.data.name, 42)),
        labelFill: "#16202a",
        labelFontFamily: nodeLabelFontFamily(),
        labelFontSize: 22,
        labelFontWeight: 700,
        labelLineHeight: 26,
        labelWordWrap: true,
        labelMaxWidth: "82%",
        labelPlacement: "center",
        labelOffsetY: 2,
      },
      states: [],
      data: {
        kind: "requirement",
        requirementId: node.data.id,
      } satisfies FactoryNodeMeta,
    });
    includeBounds(requirementBounds, nodeX, nodeY, REQUIREMENT_NODE_WIDTH, REQUIREMENT_NODE_HEIGHT);
  });

  positionedRoot.links().forEach((link) => {
    requirementEdges.push({
      id: `requirement:${link.source.data.id}->${link.target.data.id}`,
      source: link.source.data.id,
      target: link.target.data.id,
      type: "cubic-horizontal",
      style: {
        stroke: "#a9b8ca",
        lineWidth: 2.05,
        opacity: 0.98,
      },
      states: [],
      data: {
        kind: "requirement-hierarchy",
      },
    });
  });

  const interfaces = (allTraceability?.interfaces ?? []).filter((item) => {
    const lane = interfaceLaneFromType(item.type);
    return lane === "ui" || lane === "api" || lane === "func" || lane === "db";
  });
  const tests = allTraceability?.tests ?? [];
  const interfaceRelationPairs = showInterfaces ? buildInterfaceRelationPairs(interfaces) : [];

  const interfaceNodes: NodeData[] = [];
  const interfaceEdges: EdgeData[] = [];
  const testNodes: NodeData[] = [];
  const testEdges: EdgeData[] = [];
  const interfaceRelationEdges: EdgeData[] = [];
  const effectiveSelectionActive = Boolean(selectionActive);
  const effectiveSelectedNodeId = effectiveSelectionActive ? selectedNodeId : null;
  const selectedInterfaceId = effectiveSelectionActive && selectedTraceabilityKind === "interface"
    ? selectedTraceabilityId ?? null
    : null;
  const selectedTestId = effectiveSelectionActive && selectedTraceabilityKind === "test"
    ? selectedTraceabilityId ?? null
    : null;
  const selectedInterface = selectedInterfaceId
    ? interfaces.find((item) => item.interface_id === selectedInterfaceId) ?? null
    : null;
  const selectedTest = selectedTestId
    ? tests.find((item) => item.test_id === selectedTestId) ?? null
    : null;

  const activeRequirementIds = new Set<string>();
  const activeInterfaceIds = new Set<string>();
  const activeTestIds = new Set<string>();

  if (effectiveSelectedNodeId) {
    activeRequirementIds.add(effectiveSelectedNodeId);
    interfaces.forEach((item) => {
      if (item.req_ids.includes(effectiveSelectedNodeId)) {
        activeInterfaceIds.add(item.interface_id);
      }
    });
    tests.forEach((item) => {
      if (item.req_id === effectiveSelectedNodeId) {
        activeTestIds.add(item.test_id);
      }
    });
  }

  if (selectedInterface) {
    activeInterfaceIds.add(selectedInterface.interface_id);
    selectedInterface.req_ids.forEach((reqId) => activeRequirementIds.add(reqId));
    interfaceRelationPairs.forEach((pair) => {
      if (pair.source === selectedInterface.interface_id) {
        activeInterfaceIds.add(pair.target);
      }
      if (pair.target === selectedInterface.interface_id) {
        activeInterfaceIds.add(pair.source);
      }
    });
  }

  if (selectedTest) {
    activeTestIds.add(selectedTest.test_id);
    if (selectedTest.req_id) {
      activeRequirementIds.add(selectedTest.req_id);
    }
  }

  const hasHighlight = activeRequirementIds.size > 0 || activeInterfaceIds.size > 0 || activeTestIds.size > 0;

  requirementNodes.forEach((node) => {
    const requirementId = String((node.data as FactoryNodeMeta).requirementId ?? "");
    const states: string[] = [];
    if (effectiveSelectedNodeId && requirementId === effectiveSelectedNodeId) {
      states.push("selected");
    } else if (activeRequirementIds.has(requirementId)) {
      states.push("related");
    }
    if (states.length > 0) {
      node.states = states;
    }
  });

  const laneBuckets = new Map<InterfaceLane, SubmissionTraceabilityInterface[]>(INTERFACE_LANE_ORDERS.map((lane) => [lane, []]));
  if (showInterfaces) {
    interfaces
      .slice()
      .sort((left, right) => {
        const leftY = Math.min(...left.req_ids.map((reqId) => requirementPositionById.get(reqId)?.y ?? Number.MAX_SAFE_INTEGER));
        const rightY = Math.min(...right.req_ids.map((reqId) => requirementPositionById.get(reqId)?.y ?? Number.MAX_SAFE_INTEGER));
        if (leftY !== rightY) {
          return leftY - rightY;
        }
        const leftOrder = Math.min(...left.req_ids.map((reqId) => requirementIndexById.get(reqId) ?? Number.MAX_SAFE_INTEGER));
        const rightOrder = Math.min(...right.req_ids.map((reqId) => requirementIndexById.get(reqId) ?? Number.MAX_SAFE_INTEGER));
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.interface_id.localeCompare(right.interface_id);
      })
      .forEach((item) => {
        laneBuckets.get(interfaceLaneFromType(item.type))?.push(item);
      });
  }

  const testBuckets = new Map<TestLane, SubmissionTraceabilityTest[]>(TEST_LANE_ORDERS.map((lane) => [lane, []]));
  if (showTests) {
    tests
      .slice()
      .sort((left, right) => {
        const leftY = requirementPositionById.get(left.req_id)?.y ?? Number.MAX_SAFE_INTEGER;
        const rightY = requirementPositionById.get(right.req_id)?.y ?? Number.MAX_SAFE_INTEGER;
        if (leftY !== rightY) {
          return leftY - rightY;
        }
        const leftOrder = requirementIndexById.get(left.req_id) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = requirementIndexById.get(right.req_id) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.test_id.localeCompare(right.test_id);
      })
      .forEach((item) => {
        testBuckets.get(testLaneFromType(item.type))?.push(item);
      });
  }

  const interfaceSectionWidth = Math.max(
    SECTION_MIN_WIDTH,
    ...INTERFACE_LANE_ORDERS.map((lane) => {
      const itemCount = laneBuckets.get(lane)?.length ?? 0;
      return resolveLaneSectionWidth(itemCount, INTERFACE_NODE_WIDTH, resolveInterfacePreferredColumns(itemCount));
    }),
  );
  const testSectionWidth = Math.max(
    SECTION_MIN_WIDTH,
    ...TEST_LANE_ORDERS.map((lane) => {
      const itemCount = testBuckets.get(lane)?.length ?? 0;
      return resolveLaneSectionWidth(itemCount, TEST_NODE_WIDTH, resolveTestPreferredColumns(itemCount));
    }),
  );

  const requirementFrameBaseWidth = Math.max(
    SECTION_MIN_WIDTH,
    (requirementBounds.right - requirementBounds.left) + (SECTION_FRAME_PADDING_X * 2),
  );
  const requirementFrameBaseRight = ((requirementBounds.left + requirementBounds.right) / 2) + (requirementFrameBaseWidth / 2);
  const interfaceSectionStartX = Math.max(
    Math.max(width * 0.45, maxRequirementX + INTERFACE_AREA_OFFSET),
    requirementFrameBaseRight + FLOW_LANE_WIDTH + SECTION_FRAME_PADDING_X,
  );
  const testSectionStartX = interfaceSectionStartX + interfaceSectionWidth + (SECTION_FRAME_PADDING_X * 2) + TRACEABILITY_SECTION_GAP;

  let interfaceLaneTop = TOP_MARGIN - 4;
  let testLaneTop = TOP_MARGIN - 4;

  if (showInterfaces) {
    INTERFACE_LANE_ORDERS.forEach((lane) => {
      const laneItems = laneBuckets.get(lane) ?? [];
      const laneVisual = interfaceLaneStyle(lane);
      const preferredColumns = resolveInterfacePreferredColumns(laneItems.length);
      const interfaceAvailableWidth = interfaceSectionWidth;
      const columns = Math.max(1, Math.min(laneItems.length || 1, preferredColumns));
      const rowCount = Math.max(1, Math.ceil(laneItems.length / columns));
      const containerHeight = Math.max(
        LANE_CONTAINER_MIN_HEIGHT,
        (INTERFACE_LANE_PADDING_Y * 2)
          + (rowCount * INTERFACE_NODE_HEIGHT)
          + (Math.max(0, rowCount - 1) * INTERFACE_ROW_GAP),
      );
      const containerTop = interfaceLaneTop + INTERFACE_LANE_HEADER_GAP;
      const headerX = interfaceSectionStartX + (LANE_HEADER_WIDTH / 2);
      const headerY = containerTop - (LANE_HEADER_HEIGHT / 2);
      const containerCenterY = containerTop + (containerHeight / 2);
      const containerCenterX = interfaceSectionStartX + (interfaceAvailableWidth / 2);

      interfaceNodes.push({
        id: `lane-container:${lane}`,
        type: "rect",
        style: {
          x: containerCenterX,
          y: containerCenterY,
          size: [interfaceAvailableWidth, containerHeight],
          radius: 16,
          fill: "rgba(255, 255, 255, 0)",
          fillOpacity: 0,
          stroke: laneVisual.stroke,
          strokeOpacity: 0.44,
          lineWidth: 1.1,
          lineDash: [7, 6],
        },
        states: [],
        data: {
          kind: "lane-container",
          lane,
        } satisfies FactoryNodeMeta,
      });
      includeBounds(interfaceBounds, containerCenterX, containerCenterY, interfaceAvailableWidth, containerHeight);

      interfaceNodes.push({
        id: `lane-header:${lane}`,
        type: "rect",
        style: {
          x: headerX,
          y: headerY,
          size: [LANE_HEADER_WIDTH, LANE_HEADER_HEIGHT],
          radius: 8,
          fill: "#f8fafc",
          stroke: laneVisual.stroke,
          strokeOpacity: 0.38,
          labelText: lane.toUpperCase(),
          labelFill: laneVisual.accent,
          labelFontFamily: nodeLabelFontFamily(),
          labelFontSize: 18,
          labelFontWeight: 600,
          labelLineHeight: LANE_HEADER_HEIGHT,
          labelPlacement: "center",
          labelTextAlign: "center",
          labelTextBaseline: "middle",
          labelOffsetX: 0,
          labelOffsetY: 0,
          lineWidth: 1,
        },
        states: [],
        data: {
          kind: "lane-header",
          lane,
        } satisfies FactoryNodeMeta,
      });
      includeBounds(interfaceBounds, headerX, headerY, LANE_HEADER_WIDTH, LANE_HEADER_HEIGHT);

      laneItems.forEach((item, itemIndex) => {
        const rowIndex = Math.floor(itemIndex / columns);
        const columnIndex = itemIndex % columns;
        const x = interfaceSectionStartX
          + INTERFACE_LANE_PADDING_X
          + (INTERFACE_NODE_WIDTH / 2)
          + (columnIndex * (INTERFACE_NODE_WIDTH + INTERFACE_COLUMN_GAP));
        const y = containerTop
          + INTERFACE_LANE_PADDING_Y
          + (INTERFACE_NODE_HEIGHT / 2)
          + (rowIndex * (INTERFACE_NODE_HEIGHT + INTERFACE_ROW_GAP));
        const states: string[] = [];
        const isSelectedInterface = Boolean(selectedInterfaceId && item.interface_id === selectedInterfaceId);
        const isRelatedInterface = !isSelectedInterface && (
          (effectiveSelectedNodeId ? item.req_ids.includes(effectiveSelectedNodeId) : false)
          || activeInterfaceIds.has(item.interface_id)
        );
        if (selectedInterfaceId && item.interface_id === selectedInterfaceId) {
          states.push("selected");
        } else if (isRelatedInterface) {
          states.push("related");
        }

        interfaceNodes.push({
          id: item.interface_id,
          type: "rect",
          states,
          style: {
            x,
            y,
            size: [INTERFACE_NODE_WIDTH, INTERFACE_NODE_HEIGHT],
            radius: 10,
            fill: laneVisual.fill,
            stroke: laneVisual.stroke,
            lineWidth: 1.35,
            shadowColor: "rgba(0, 0, 0, 0)",
            shadowBlur: 0,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            labelText: buildNodeLabelText(item.interface_id, parseInterfaceNodeTitle(item)),
            labelFill: "#142031",
            labelFontFamily: nodeLabelFontFamily(),
            labelFontSize: 20,
            labelFontWeight: 700,
            labelLineHeight: 24,
            labelWordWrap: true,
            labelMaxWidth: "82%",
            labelPlacement: "center",
            labelOffsetY: 1,
          },
          data: {
            kind: "interface",
            interfaceId: item.interface_id,
            lane,
            requirementId: item.req_ids[0] ?? null,
            interfaceItem: item,
          } satisfies FactoryNodeMeta,
        });
        includeBounds(interfaceBounds, x, y, INTERFACE_NODE_WIDTH, INTERFACE_NODE_HEIGHT);

        item.req_ids.forEach((reqId) => {
          if (!requirementIndexById.has(reqId)) {
            return;
          }
          const related = activeRequirementIds.has(reqId) || activeInterfaceIds.has(item.interface_id);
          interfaceEdges.push({
            id: `trace:${reqId}->${item.interface_id}`,
            source: reqId,
            target: item.interface_id,
            type: "cubic-horizontal",
            states: hasHighlight && related ? ["related"] : [],
            style: {
              stroke: "#c8d2df",
              lineWidth: 1.2,
              lineDash: [5, 4],
              opacity: 0.018,
              endArrow: true,
              endArrowType: "vee",
              endArrowFill: "#c8d2df",
              endArrowStroke: "#c8d2df",
              endArrowSize: 12,
            },
            data: {
              kind: "requirement-interface",
            },
          });
        });
      });

      interfaceLaneTop = containerTop + containerHeight + INTERFACE_SECTION_GAP;
    });
  }

  if (showTests) {
    TEST_LANE_ORDERS.forEach((lane) => {
      const laneItems = testBuckets.get(lane) ?? [];
      const laneVisual = testLaneStyle(lane);
      const preferredColumns = resolveTestPreferredColumns(laneItems.length);
      const testAvailableWidth = testSectionWidth;
      const columns = Math.max(1, Math.min(laneItems.length || 1, preferredColumns));
      const rowCount = Math.max(1, Math.ceil(laneItems.length / columns));
      const containerHeight = Math.max(
        LANE_CONTAINER_MIN_HEIGHT,
        (INTERFACE_LANE_PADDING_Y * 2)
          + (rowCount * TEST_NODE_HEIGHT)
          + (Math.max(0, rowCount - 1) * INTERFACE_ROW_GAP),
      );
      const containerTop = testLaneTop + INTERFACE_LANE_HEADER_GAP;
      const headerX = testSectionStartX + (LANE_HEADER_WIDTH / 2);
      const headerY = containerTop - (LANE_HEADER_HEIGHT / 2);
      const containerCenterY = containerTop + (containerHeight / 2);
      const containerCenterX = testSectionStartX + (testAvailableWidth / 2);

      testNodes.push({
        id: `test-lane-container:${lane}`,
        type: "rect",
        style: {
          x: containerCenterX,
          y: containerCenterY,
          size: [testAvailableWidth, containerHeight],
          radius: 16,
          fill: "rgba(255, 255, 255, 0)",
          fillOpacity: 0,
          stroke: laneVisual.stroke,
          strokeOpacity: 0.44,
          lineWidth: 1.1,
          lineDash: [7, 6],
        },
        states: [],
        data: {
          kind: "lane-container",
          lane,
        } satisfies FactoryNodeMeta,
      });
      includeBounds(testBounds, containerCenterX, containerCenterY, testAvailableWidth, containerHeight);

      testNodes.push({
        id: `test-lane-header:${lane}`,
        type: "rect",
        style: {
          x: headerX,
          y: headerY,
          size: [LANE_HEADER_WIDTH, LANE_HEADER_HEIGHT],
          radius: 8,
          fill: "#f8fafc",
          stroke: laneVisual.stroke,
          strokeOpacity: 0.38,
          labelText: lane === "e2e" ? "E2E" : lane.toUpperCase(),
          labelFill: laneVisual.accent,
          labelFontFamily: nodeLabelFontFamily(),
          labelFontSize: 18,
          labelFontWeight: 600,
          labelLineHeight: LANE_HEADER_HEIGHT,
          labelPlacement: "center",
          labelTextAlign: "center",
          labelTextBaseline: "middle",
          labelOffsetX: 0,
          labelOffsetY: 0,
          lineWidth: 1,
        },
        states: [],
        data: {
          kind: "lane-header",
          lane,
        } satisfies FactoryNodeMeta,
      });
      includeBounds(testBounds, headerX, headerY, LANE_HEADER_WIDTH, LANE_HEADER_HEIGHT);

      laneItems.forEach((item, itemIndex) => {
        const rowIndex = Math.floor(itemIndex / columns);
        const columnIndex = itemIndex % columns;
        const x = testSectionStartX
          + INTERFACE_LANE_PADDING_X
          + (TEST_NODE_WIDTH / 2)
          + (columnIndex * (TEST_NODE_WIDTH + INTERFACE_COLUMN_GAP));
        const y = containerTop
          + INTERFACE_LANE_PADDING_Y
          + (TEST_NODE_HEIGHT / 2)
          + (rowIndex * (TEST_NODE_HEIGHT + INTERFACE_ROW_GAP));
        const states: string[] = [];
        const isSelectedTest = Boolean(selectedTestId && item.test_id === selectedTestId);
        const isRelatedTest = !isSelectedTest && (
          (effectiveSelectedNodeId ? item.req_id === effectiveSelectedNodeId : false)
          || activeTestIds.has(item.test_id)
        );
        if (selectedTestId && item.test_id === selectedTestId) {
          states.push("selected");
        } else if (isRelatedTest) {
          states.push("related");
        }

        testNodes.push({
          id: `test:${item.test_id}`,
          type: "rect",
          states,
          style: {
            x,
            y,
            size: [TEST_NODE_WIDTH, TEST_NODE_HEIGHT],
            radius: 10,
            fill: testResultFill(item.status),
            stroke: testResultStroke(item.status),
            lineWidth: 1.5,
            shadowColor: "rgba(0, 0, 0, 0)",
            shadowBlur: 0,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            labelText: buildNodeLabelText(item.test_id, parseTestNodeTitle(item), item.first_line),
            labelFill: "#142031",
            labelFontFamily: nodeLabelFontFamily(),
            labelFontSize: 20,
            labelFontWeight: 700,
            labelLineHeight: 22,
            labelWordWrap: true,
            labelMaxWidth: "82%",
            labelPlacement: "center",
            labelOffsetY: 0,
          },
          data: {
            kind: "test",
            testId: item.test_id,
            lane,
            requirementId: item.req_id,
            testItem: item,
          } satisfies FactoryNodeMeta,
        });
        includeBounds(testBounds, x, y, TEST_NODE_WIDTH, TEST_NODE_HEIGHT);

        if (requirementIndexById.has(item.req_id)) {
          const related = activeRequirementIds.has(item.req_id) || activeTestIds.has(item.test_id);
          testEdges.push({
            id: `test-trace:${item.req_id}->${item.test_id}`,
            source: item.req_id,
            target: `test:${item.test_id}`,
            type: "cubic-horizontal",
            states: hasHighlight && related ? ["related"] : [],
            style: {
              stroke: "#c8d2df",
              lineWidth: 1.2,
              lineDash: [5, 4],
              opacity: 0.018,
              endArrow: true,
              endArrowType: "vee",
              endArrowFill: "#c8d2df",
              endArrowStroke: "#c8d2df",
              endArrowSize: 12,
            },
            data: {
              kind: "requirement-test",
            },
          });
        }
      });

      testLaneTop = containerTop + containerHeight + INTERFACE_SECTION_GAP;
    });
  }

  if (!hasBounds(interfaceBounds)) {
    includeBoundsFromRect(
      interfaceBounds,
      interfaceSectionStartX,
      TOP_MARGIN + INTERFACE_LANE_HEADER_GAP,
      interfaceSectionWidth,
      LANE_CONTAINER_MIN_HEIGHT,
    );
  }
  if (!hasBounds(testBounds)) {
    includeBoundsFromRect(
      testBounds,
      testSectionStartX,
      TOP_MARGIN + INTERFACE_LANE_HEADER_GAP,
      testSectionWidth,
      LANE_CONTAINER_MIN_HEIGHT,
    );
  }

  const contentTop = Math.min(requirementBounds.top, interfaceBounds.top, testBounds.top);
  const contentBottom = Math.max(requirementBounds.bottom, interfaceBounds.bottom, testBounds.bottom);
  const sectionTop = contentTop - SECTION_FRAME_PADDING_TOP;
  const sectionBottom = contentBottom + SECTION_FRAME_PADDING_BOTTOM;
  const sectionHeight = Math.max(320, sectionBottom - sectionTop);

  const resolveFrameBox = (bounds: Bounds) => {
    const contentWidth = bounds.right - bounds.left;
    const widthWithPadding = Math.max(SECTION_MIN_WIDTH, contentWidth + (SECTION_FRAME_PADDING_X * 2));
    const centerX = (bounds.left + bounds.right) / 2;
    return {
      left: centerX - (widthWithPadding / 2),
      width: widthWithPadding,
    };
  };

  const requirementFrame = resolveFrameBox(requirementBounds);
  const interfaceFrame = resolveFrameBox(interfaceBounds);
  const testFrame = resolveFrameBox(testBounds);
  const requirementSectionStyle = sectionFrameStyle("requirements");
  const interfaceSectionStyle = sectionFrameStyle("interfaces");
  const testSectionStyle = sectionFrameStyle("tests");

  [
    {
      id: "section-frame:requirements",
      left: requirementFrame.left,
      width: requirementFrame.width,
      title: "Requirements",
      style: requirementSectionStyle,
    },
    {
      id: "section-frame:interfaces",
      left: interfaceFrame.left,
      width: interfaceFrame.width,
      title: "Interfaces",
      style: interfaceSectionStyle,
    },
    {
      id: "section-frame:tests",
      left: testFrame.left,
      width: testFrame.width,
      title: "Tests",
      style: testSectionStyle,
    },
  ].forEach((section) => {
    sectionNodes.push({
      id: section.id,
      type: "rect",
      style: {
        x: section.left + (section.width / 2),
        y: sectionTop + (sectionHeight / 2),
        size: [section.width, sectionHeight],
        radius: 0,
        fill: section.style.fill,
        fillOpacity: 0,
        stroke: section.style.stroke,
        strokeOpacity: 0.52,
        lineWidth: 1.6,
        lineDash: [10, 8],
      },
      states: [],
      data: {
        kind: "section-frame",
      } satisfies FactoryNodeMeta,
    });

    sectionNodes.push({
      id: section.id.replace("section-frame", "section-header"),
      type: "rect",
      style: {
        x: section.left + (section.width / 2),
        y: sectionTop - 2,
        size: [section.width, SECTION_HEADER_HEIGHT],
        radius: 0,
        fill: section.style.accent,
        stroke: section.style.stroke,
        lineWidth: 1.2,
        labelText: section.title,
        labelFill: "#4c4c4c",
        labelFontFamily: "'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', sans-serif",
        labelFontSize: 42,
        labelFontWeight: 500,
        labelLineHeight: SECTION_HEADER_HEIGHT,
        labelPlacement: "center",
      },
      states: [],
      data: {
        kind: "section-header",
      } satisfies FactoryNodeMeta,
    });
  });

  const assemblyFlowY = sectionTop + (sectionHeight / 2);
  const flowOriginX = requirementFrame.left + requirementFrame.width + 18;
  const interfaceFlowTargetX = interfaceFrame.left - 18;
  const flowIconX = flowOriginX + ((interfaceFlowTargetX - flowOriginX) / 2);

  [
    { id: "flow-anchor:req-interface", x: flowOriginX, y: assemblyFlowY },
    { id: "flow-anchor:interface", x: interfaceFlowTargetX, y: assemblyFlowY },
  ].forEach((anchor) => {
    flowNodes.push({
      id: anchor.id,
      type: "circle",
      style: {
        x: anchor.x,
        y: anchor.y,
        size: 6,
        fill: "#2563eb",
        fillOpacity: 0,
        stroke: "#2563eb",
        strokeOpacity: 0,
      },
      states: [],
      data: {
        kind: "flow-anchor",
      } satisfies FactoryNodeMeta,
    });
  });

  flowNodes.push({
    id: "flow-label:arrow",
    type: "triangle",
    style: {
      x: flowIconX,
      y: assemblyFlowY,
      size: 42,
      direction: "right",
      fill: "l(0) 0:#1d4ed8 0.5:#38bdf8 1:#0f766e",
      stroke: "#60a5fa",
      lineWidth: 1.2,
      shadowColor: "rgba(56, 189, 248, 0.22)",
      shadowBlur: 10,
    },
    states: [],
    data: {
      kind: "flow-label",
    } satisfies FactoryNodeMeta,
  });

  flowEdges.push({
    id: "factory-flow:requirements->interfaces",
    source: "flow-anchor:req-interface",
    target: "flow-anchor:interface",
    type: "cubic-horizontal",
    style: {
      stroke: "l(0) 0:#1d4ed8 0.5:#38bdf8 1:#0f766e",
      lineWidth: 8,
      opacity: 0.9,
      lineDash: [22, 10],
      endArrow: false,
    },
    states: [],
    data: {
      kind: "factory-flow" satisfies FactoryEdgeKind,
    },
  });
  if (showInterfaces) {
    interfaceRelationPairs.forEach((pair) => {
      const sourceActive = activeInterfaceIds.has(pair.source);
      const targetActive = activeInterfaceIds.has(pair.target);
      const showRelation = selectedInterfaceId
        ? (sourceActive || targetActive)
        : (sourceActive && targetActive);

      interfaceRelationEdges.push({
        id: pair.id,
        source: pair.source,
        target: pair.target,
        type: "cubic-horizontal",
        states: hasHighlight && showRelation ? ["related"] : [],
        style: {
          stroke: "#6d28d9",
          lineWidth: 2.6,
          lineDash: [10, 6],
          opacity: 0.14,
          endArrow: true,
          endArrowType: "vee",
          endArrowFill: "#6d28d9",
          endArrowStroke: "#6d28d9",
          endArrowSize: 14,
        },
        data: {
          kind: "interface-call" satisfies FactoryEdgeKind,
        },
      });
    });
  }

  const selectedRequirementForHierarchy = effectiveSelectedNodeId ?? selectedInterface?.req_ids[0] ?? selectedTest?.req_id ?? null;
  if (selectedRequirementForHierarchy) {
    requirementEdges.forEach((edge) => {
      const sourceId = String(edge.source);
      const targetId = String(edge.target);
      if (sourceId === selectedRequirementForHierarchy || targetId === selectedRequirementForHierarchy) {
        edge.states = ["related"];
      }
    });
  }

  return {
    data: {
      nodes: [...sectionNodes, ...flowNodes, ...requirementNodes, ...interfaceNodes, ...testNodes],
      edges: [...flowEdges, ...requirementEdges, ...interfaceEdges, ...testEdges, ...interfaceRelationEdges],
    },
  };
}

const SubmissionFactoryCanvas = forwardRef<SubmissionFactoryCanvasHandle, SubmissionFactoryCanvasProps>(function SubmissionFactoryCanvas({
  tree,
  selectedNodeId,
  selectionActive = false,
  onSelectNode,
  nodeStates = {},
  allTraceability,
  onRequestAllTraceability,
  showInterfaces = true,
  showTests = true,
  selectedTraceabilityId,
  selectedTraceabilityKind,
  onSelectInterface,
  onSelectTest,
}, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const requestIssuedRef = useRef(false);
  const fitSignatureRef = useRef<string>("");
  const callbacksRef = useRef({
    onSelectNode,
    onSelectInterface,
    onSelectTest,
  });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  callbacksRef.current = {
    onSelectNode,
    onSelectInterface,
    onSelectTest,
  };
  const zoomIn = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    void graph.zoomTo(graph.getZoom() * 1.15);
  }, []);
  const zoomOut = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    void graph.zoomTo(graph.getZoom() / 1.15);
  }, []);
  const fitView = useCallback(() => {
    void graphRef.current?.fitView({ when: "always" });
  }, []);
  useImperativeHandle(ref, () => ({
    zoomIn,
    zoomOut,
    fitView,
  }), [fitView, zoomIn, zoomOut]);

  useEffect(() => {
    if (allTraceability || requestIssuedRef.current || !onRequestAllTraceability) {
      return;
    }
    requestIssuedRef.current = true;
    onRequestAllTraceability();
  }, [allTraceability, onRequestAllTraceability]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const updateSize = () => {
      const nextWidth = Math.max(320, Math.round(host.clientWidth));
      const nextHeight = Math.max(320, Math.round(host.clientHeight));
      setViewport((current) => (
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      ));
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const model = useMemo(
    () => buildGraphModel({
      tree,
      nodeStates,
      allTraceability,
      showInterfaces,
      showTests,
      selectedNodeId,
      selectionActive,
      selectedTraceabilityId,
      selectedTraceabilityKind,
      width: viewport.width || 1400,
    }),
    [allTraceability, nodeStates, selectedNodeId, selectedTraceabilityId, selectedTraceabilityKind, selectionActive, showInterfaces, showTests, tree, viewport.width],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    let cancelled = false;

    const bindGraphEvents = (graph: Graph) => {
      graph.on("node:click", (event: any) => {
        const targetId = String(event?.target?.id ?? "");
        if (!targetId) {
          return;
        }
        const datum = graph.getNodeData(targetId);
        const meta = (datum.data ?? {}) as FactoryNodeMeta;
        if (
          meta.kind === "lane-header"
          || meta.kind === "lane-container"
          || meta.kind === "section-frame"
          || meta.kind === "section-header"
          || meta.kind === "flow-anchor"
          || meta.kind === "flow-label"
        ) {
          callbacksRef.current.onSelectNode(null);
          return;
        }
        if (meta.kind === "requirement") {
          callbacksRef.current.onSelectNode(targetId);
          return;
        }
        if (meta.kind === "interface" && meta.interfaceItem) {
          callbacksRef.current.onSelectInterface?.({
            id: meta.interfaceItem.interface_id,
            requirementNodeId: meta.interfaceItem.req_ids[0] ?? null,
            filePath: meta.interfaceItem.file_path,
            firstLine: meta.interfaceItem.first_line,
          });
          return;
        }
        if (meta.kind === "test" && meta.testItem) {
          callbacksRef.current.onSelectTest?.({
            id: meta.testItem.test_id,
            requirementNodeId: meta.testItem.req_id ?? null,
            filePath: meta.testItem.file_path,
            firstLine: meta.testItem.first_line,
          });
        }
      });

      graph.on("canvas:click", () => {
        callbacksRef.current.onSelectNode(null);
      });
    };

    const render = async () => {
      if (!graphRef.current) {
        const graph = new Graph({
          container: host,
          width: viewport.width,
          height: viewport.height,
          animation: false,
          data: model.data,
          node: {
            type: (datum: NodeData) => String(datum.type ?? "rect"),
            style: (datum: NodeData) => ({ ...(datum.style ?? {}) }),
            state: {
              selected: {
                fill: (datum: NodeData) => resolveNodeHighlightFill(datum),
                stroke: (datum: NodeData) => resolveNodeHighlightFill(datum),
                size: (datum: NodeData) => resolveNodeHighlightSize(datum, 1.1),
                lineWidth: 4.4,
                labelFill: "#ffffff",
                labelFontSize: (datum: NodeData) => resolveNodeHighlightLabelFontSize(datum, 1.16),
                labelLineHeight: (datum: NodeData) => resolveNodeHighlightLabelLineHeight(datum, 1.16),
                labelFontWeight: 800,
                shadowColor: "rgba(0, 0, 0, 0)",
                shadowBlur: 0,
                shadowOffsetX: 0,
                shadowOffsetY: 0,
                opacity: 1,
              },
              related: {
                fill: (datum: NodeData) => resolveNodeHighlightFill(datum),
                stroke: (datum: NodeData) => resolveNodeHighlightFill(datum),
                size: (datum: NodeData) => resolveNodeHighlightSize(datum, 1.06),
                lineWidth: 3.4,
                labelFill: "#ffffff",
                labelFontSize: (datum: NodeData) => resolveNodeHighlightLabelFontSize(datum, 1.08),
                labelLineHeight: (datum: NodeData) => resolveNodeHighlightLabelLineHeight(datum, 1.08),
                labelFontWeight: 760,
                shadowColor: "rgba(0, 0, 0, 0)",
                shadowBlur: 0,
                shadowOffsetX: 0,
                shadowOffsetY: 0,
                opacity: 1,
              },
            },
          },
          edge: {
            type: (datum: EdgeData) => String(datum.type ?? "line"),
            style: (datum: EdgeData) => ({ ...(datum.style ?? {}) }),
            state: {
              related: {
                stroke: (datum: EdgeData) => {
                  const kind = String(((datum.data as { kind?: FactoryEdgeKind } | undefined)?.kind) ?? "");
                  return resolveEdgeHighlightColor(kind);
                },
                lineWidth: (datum: EdgeData) => {
                  const kind = String(((datum.data as { kind?: FactoryEdgeKind } | undefined)?.kind) ?? "");
                  if (kind === "interface-call") {
                    return 3.4;
                  }
                  if (kind === "factory-flow") {
                    return 4.2;
                  }
                  return 2.1;
                },
                lineDash: (datum: EdgeData) => {
                  const kind = String(((datum.data as { kind?: FactoryEdgeKind } | undefined)?.kind) ?? "");
                  if (kind === "interface-call") {
                    return [12, 6];
                  }
                  if (kind === "factory-flow") {
                    return [14, 6];
                  }
                  return [8, 4];
                },
                opacity: (datum: EdgeData) => {
                  const kind = String(((datum.data as { kind?: FactoryEdgeKind } | undefined)?.kind) ?? "");
                  if (kind === "interface-call") {
                    return 0.98;
                  }
                  if (kind === "factory-flow") {
                    return 0.9;
                  }
                  return 0.46;
                },
                endArrowFill: (datum: EdgeData) => {
                  const kind = String(((datum.data as { kind?: FactoryEdgeKind } | undefined)?.kind) ?? "");
                  return resolveEdgeHighlightColor(kind);
                },
                endArrowStroke: (datum: EdgeData) => {
                  const kind = String(((datum.data as { kind?: FactoryEdgeKind } | undefined)?.kind) ?? "");
                  return resolveEdgeHighlightColor(kind);
                },
                endArrowSize: (datum: EdgeData) => {
                  const kind = String(((datum.data as { kind?: FactoryEdgeKind } | undefined)?.kind) ?? "");
                  if (kind === "interface-call") {
                    return 16;
                  }
                  if (kind === "factory-flow") {
                    return 17;
                  }
                  return 13;
                },
              },
            },
          },
          behaviors: ["drag-canvas", "zoom-canvas"],
        });
        bindGraphEvents(graph);
        graphRef.current = graph;
        await graph.render();
        await graph.setElementState(buildElementStateMap(model.data), false);
      } else {
        graphRef.current.setSize(viewport.width, viewport.height);
        graphRef.current.setData(model.data);
        await graphRef.current.draw();
        await graphRef.current.setElementState(buildElementStateMap(model.data), false);
      }

      const fitSignature = `${viewport.width}:${viewport.height}:${model.data.nodes?.length ?? 0}:${model.data.edges?.length ?? 0}`;
      if (!cancelled && fitSignatureRef.current !== fitSignature) {
        fitSignatureRef.current = fitSignature;
        await graphRef.current?.fitView({ when: "always" });
      }
    };

    void render();

    return () => {
      cancelled = true;
    };
  }, [model.data, viewport.height, viewport.width]);

  useEffect(() => {
    return () => {
      graphRef.current?.destroy();
      graphRef.current = null;
    };
  }, []);

  return (
    <div className="submission-factory-canvas-shell">
      <RequirementStateLegend />
      <div ref={hostRef} className="submission-factory-canvas-host" />
      {!allTraceability ? (
        <div className="submission-factory-canvas-status">Loading traceability layers...</div>
      ) : null}
    </div>
  );
});

export default SubmissionFactoryCanvas;

