import { Graph, type EdgeData, type GraphData, type NodeData } from "@antv/g6";
import { hierarchy, tree as createTreeLayout } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RequirementNode } from "../../lib/taskTree";
import type {
  RequirementVisualState,
  SubmissionTraceabilityInterface,
  SubmissionTraceabilityPayload,
} from "../../lib/types";

type FactoryNodeKind = "requirement" | "interface" | "lane-header" | "lane-container";
type InterfaceLane = "ui" | "api" | "func" | "db";
type FactoryEdgeKind = "requirement-hierarchy" | "requirement-interface" | "interface-call";

type FactoryNodeMeta = {
  kind: FactoryNodeKind;
  requirementId?: string | null;
  interfaceId?: string | null;
  lane?: InterfaceLane;
  interfaceItem?: SubmissionTraceabilityInterface;
};

type SubmissionFactoryCanvasProps = {
  tree: RequirementNode;
  selectedNodeId: string | null;
  selectionActive?: boolean;
  onSelectNode: (nodeId: string | null) => void;
  nodeStates?: Record<string, RequirementVisualState>;
  allTraceability?: SubmissionTraceabilityPayload | null;
  onRequestAllTraceability?: () => void;
  selectedTraceabilityId?: string | null;
  selectedTraceabilityKind?: "interface" | "test" | null;
  onSelectInterface?: (payload: {
    id: string;
    requirementNodeId: string | null;
    filePath: string;
    firstLine: string | null;
  }) => void;
};

type GraphModel = {
  data: GraphData;
};

const REQUIREMENT_NODE_WIDTH = 236;
const REQUIREMENT_NODE_HEIGHT = 96;
const INTERFACE_NODE_WIDTH = 204;
const INTERFACE_NODE_HEIGHT = 78;
const LANE_HEADER_WIDTH = 92;
const LANE_HEADER_HEIGHT = 30;
const LANE_CONTAINER_MIN_HEIGHT = 88;
const LEFT_MARGIN = 72;
const TOP_MARGIN = 78;
const REQUIREMENT_COLUMN_GAP = 104;
const REQUIREMENT_ROW_GAP = 42;
const INTERFACE_AREA_OFFSET = 420;
const INTERFACE_COLUMN_GAP = 34;
const INTERFACE_ROW_GAP = 28;
const INTERFACE_SECTION_GAP = 34;
const INTERFACE_LANE_PADDING_X = 28;
const INTERFACE_LANE_PADDING_Y = 24;
const INTERFACE_LANE_HEADER_GAP = 22;
const INTERFACE_LANE_ORDERS: InterfaceLane[] = ["ui", "api", "func", "db"];

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
      return nodeType === "ATOMIC"
        ? { fill: "#fffaf0", stroke: "#c39b39" }
        : { fill: "#ffffff", stroke: "#8f9baa" };
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
      return { fill: "#eff6ff", stroke: "#2563eb", accent: "#2563eb" };
    case "api":
      return { fill: "#ecfeff", stroke: "#0f766e", accent: "#0f766e" };
    case "func":
      return { fill: "#fff7ed", stroke: "#c2410c", accent: "#c2410c" };
    case "db":
      return { fill: "#f5f3ff", stroke: "#6d28d9", accent: "#6d28d9" };
  }
}

function nodeLabelFontFamily() {
  return "'Aptos', 'Segoe UI', 'Helvetica Neue', sans-serif";
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
  selectedNodeId,
  selectionActive,
  selectedTraceabilityId,
  selectedTraceabilityKind,
  width,
}: {
  tree: RequirementNode;
  nodeStates: Record<string, RequirementVisualState>;
  allTraceability: SubmissionTraceabilityPayload | null | undefined;
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

  const requirementNodes: NodeData[] = [];
  const requirementEdges: EdgeData[] = [];
  const requirementIndexById = new Map<string, number>();
  const requirementPositionById = new Map<string, { order: number; y: number }>();
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
        labelText: `${node.data.id}\n${truncateLabel(node.data.name, 42)}`,
        labelFill: "#16202a",
        labelFontFamily: nodeLabelFontFamily(),
        labelFontSize: 15.5,
        labelFontWeight: 650,
        labelLineHeight: 21,
        labelWordWrap: true,
        labelMaxWidth: "80%",
        labelPlacement: "center",
        labelOffsetY: 2,
      },
      states: [],
      data: {
        kind: "requirement",
        requirementId: node.data.id,
      } satisfies FactoryNodeMeta,
    });
  });

  positionedRoot.links().forEach((link) => {
    requirementEdges.push({
      id: `requirement:${link.source.data.id}->${link.target.data.id}`,
      source: link.source.data.id,
      target: link.target.data.id,
      type: "cubic-horizontal",
      style: {
        stroke: "#d0d8e3",
        lineWidth: 1.35,
        opacity: 0.9,
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

  const interfaceStartX = Math.max(width * 0.45, maxRequirementX + INTERFACE_AREA_OFFSET);
  const interfaceNodes: NodeData[] = [];
  const interfaceEdges: EdgeData[] = [];
  const interfaceRelationEdges: EdgeData[] = [];
  const effectiveSelectionActive = Boolean(selectionActive);
  const effectiveSelectedNodeId = effectiveSelectionActive ? selectedNodeId : null;
  const selectedInterfaceId = effectiveSelectionActive && selectedTraceabilityKind === "interface"
    ? selectedTraceabilityId ?? null
    : null;
  const selectedInterface = selectedInterfaceId
    ? interfaces.find((item) => item.interface_id === selectedInterfaceId) ?? null
    : null;

  const activeRequirementIds = new Set<string>();
  const activeInterfaceIds = new Set<string>();

  if (effectiveSelectedNodeId) {
    activeRequirementIds.add(effectiveSelectedNodeId);
    interfaces.forEach((item) => {
      if (item.req_ids.includes(effectiveSelectedNodeId)) {
        activeInterfaceIds.add(item.interface_id);
      }
    });
  }

  if (selectedInterface) {
    activeInterfaceIds.add(selectedInterface.interface_id);
    selectedInterface.req_ids.forEach((reqId) => activeRequirementIds.add(reqId));
  }

  const hasHighlight = activeRequirementIds.size > 0 || activeInterfaceIds.size > 0;

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

  const laneBuckets = new Map<InterfaceLane, SubmissionTraceabilityInterface[]>(
    INTERFACE_LANE_ORDERS.map((lane) => [lane, []]),
  );

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

  let laneTop = TOP_MARGIN - 4;

  INTERFACE_LANE_ORDERS.forEach((lane) => {
    const laneItems = laneBuckets.get(lane) ?? [];
    const laneVisual = interfaceLaneStyle(lane);
    const preferredColumns = Math.max(1, Math.min(laneItems.length || 1, laneItems.length > 12 ? 5 : laneItems.length > 6 ? 4 : 3));
    const interfaceAvailableWidth = Math.max(
      width - interfaceStartX - 88,
      (INTERFACE_LANE_PADDING_X * 2)
        + (preferredColumns * INTERFACE_NODE_WIDTH)
        + (Math.max(0, preferredColumns - 1) * INTERFACE_COLUMN_GAP),
    );
    const columns = Math.max(
      1,
      Math.floor(
        (interfaceAvailableWidth - (INTERFACE_LANE_PADDING_X * 2) + INTERFACE_COLUMN_GAP)
          / (INTERFACE_NODE_WIDTH + INTERFACE_COLUMN_GAP),
      ),
    );
    const rowCount = Math.max(1, Math.ceil(laneItems.length / columns));
    const containerHeight = Math.max(
      LANE_CONTAINER_MIN_HEIGHT,
      (INTERFACE_LANE_PADDING_Y * 2)
        + (rowCount * INTERFACE_NODE_HEIGHT)
        + (Math.max(0, rowCount - 1) * INTERFACE_ROW_GAP),
    );
    const headerY = laneTop + 10;
    const containerTop = laneTop + INTERFACE_LANE_HEADER_GAP;
    const containerCenterY = containerTop + (containerHeight / 2);
    const containerCenterX = interfaceStartX + (interfaceAvailableWidth / 2);

    interfaceNodes.push({
      id: `lane-container:${lane}`,
      type: "rect",
      style: {
        x: containerCenterX,
        y: containerCenterY,
        size: [interfaceAvailableWidth, containerHeight],
        radius: 16,
        fill: laneVisual.fill,
        fillOpacity: 0.42,
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

    interfaceNodes.push({
      id: `lane-header:${lane}`,
      type: "rect",
      style: {
        x: interfaceStartX + 44,
        y: headerY,
        size: [LANE_HEADER_WIDTH, LANE_HEADER_HEIGHT],
        radius: 8,
        fill: laneVisual.accent,
        stroke: laneVisual.accent,
        labelText: lane.toUpperCase(),
        labelFill: "#ffffff",
        labelFontFamily: nodeLabelFontFamily(),
        labelFontSize: 12.5,
        labelFontWeight: 700,
        labelPlacement: "center",
        lineWidth: 1,
      },
      states: [],
      data: {
        kind: "lane-header",
        lane,
      } satisfies FactoryNodeMeta,
    });

    laneItems.forEach((item, itemIndex) => {
      const rowIndex = Math.floor(itemIndex / columns);
      const columnIndex = itemIndex % columns;
      const x = interfaceStartX
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
          labelText: `${item.interface_id}\n${parseInterfaceNodeTitle(item)}`,
          labelFill: "#142031",
          labelFontFamily: nodeLabelFontFamily(),
          labelFontSize: 14.75,
          labelFontWeight: 650,
          labelLineHeight: 19,
          labelWordWrap: true,
          labelMaxWidth: "80%",
          labelPlacement: "center",
          labelOffsetY: 2,
        },
        data: {
          kind: "interface",
          interfaceId: item.interface_id,
          lane,
          requirementId: item.req_ids[0] ?? null,
          interfaceItem: item,
        } satisfies FactoryNodeMeta,
      });

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
            lineWidth: 1.15,
            lineDash: [5, 4],
            opacity: 0,
          },
          data: {
            kind: "requirement-interface",
          },
        });
      });
    });

    laneTop = containerTop + containerHeight + INTERFACE_SECTION_GAP;
  });

  buildInterfaceRelationPairs(interfaces).forEach((pair) => {
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
        lineWidth: 2.1,
        lineDash: [10, 6],
        opacity: 0,
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

  const selectedRequirementForHierarchy = effectiveSelectedNodeId ?? selectedInterface?.req_ids[0] ?? null;
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
      nodes: [...requirementNodes, ...interfaceNodes],
      edges: [...requirementEdges, ...interfaceEdges, ...interfaceRelationEdges],
    },
  };
}

export default function SubmissionFactoryCanvas({
  tree,
  selectedNodeId,
  selectionActive = false,
  onSelectNode,
  nodeStates = {},
  allTraceability,
  onRequestAllTraceability,
  selectedTraceabilityId,
  selectedTraceabilityKind,
  onSelectInterface,
}: SubmissionFactoryCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const requestIssuedRef = useRef(false);
  const fitSignatureRef = useRef<string>("");
  const callbacksRef = useRef({
    onSelectNode,
    onSelectInterface,
  });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  callbacksRef.current = {
    onSelectNode,
    onSelectInterface,
  };

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
      selectedNodeId,
      selectionActive,
      selectedTraceabilityId,
      selectedTraceabilityKind,
      width: viewport.width || 1400,
    }),
    [allTraceability, nodeStates, selectedNodeId, selectedTraceabilityId, selectedTraceabilityKind, selectionActive, tree, viewport.width],
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
        if (meta.kind === "lane-header" || meta.kind === "lane-container") {
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
                halo: true,
                haloLineWidth: 20,
                haloStroke: "#10b981",
                haloStrokeOpacity: 0.28,
                stroke: "#00a07c",
                lineWidth: 4.4,
                shadowColor: "rgba(0, 160, 124, 0.34)",
                shadowBlur: 30,
                shadowOffsetX: 0,
                shadowOffsetY: 8,
                opacity: 1,
              },
              related: {
                halo: true,
                haloLineWidth: 10,
                haloStroke: "#3a7afe",
                haloStrokeOpacity: 0.14,
                stroke: "#3a7afe",
                lineWidth: 2.7,
                shadowColor: "rgba(58, 122, 254, 0.12)",
                shadowBlur: 14,
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
                return kind === "interface-call" ? "#6d28d9" : "#0f766e";
              },
              lineWidth: (datum: EdgeData) => {
                const kind = String(((datum.data as { kind?: FactoryEdgeKind } | undefined)?.kind) ?? "");
                return kind === "interface-call" ? 2.5 : 1.7;
              },
              opacity: (datum: EdgeData) => {
                const kind = String(((datum.data as { kind?: FactoryEdgeKind } | undefined)?.kind) ?? "");
                return kind === "interface-call" ? 0.88 : 0.72;
              },
              endArrowFill: (datum: EdgeData) => {
                const kind = String(((datum.data as { kind?: FactoryEdgeKind } | undefined)?.kind) ?? "");
                return kind === "interface-call" ? "#6d28d9" : undefined;
              },
              endArrowStroke: (datum: EdgeData) => {
                const kind = String(((datum.data as { kind?: FactoryEdgeKind } | undefined)?.kind) ?? "");
                return kind === "interface-call" ? "#6d28d9" : undefined;
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
      <div className="submission-factory-canvas-hint">
        <span className="submission-factory-pill">Requirements</span>
        <span className="submission-factory-pill accent">Architecture</span>
        <span className="submission-factory-copy">Select a requirement or interface to highlight its linked nodes.</span>
      </div>
      <div ref={hostRef} className="submission-factory-canvas-host" />
      {!allTraceability ? (
        <div className="submission-factory-canvas-status">Loading interface layers...</div>
      ) : null}
    </div>
  );
}
