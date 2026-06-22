import { message } from "antd";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { RequirementVisualState, SubmissionDetail, SubmissionLogs, SubmissionStep } from "../lib/types";
import {
  QUICK_START_DISPLAY_NAME,
  QUICK_START_MODEL_NAME,
  QUICK_START_REQUIREMENT_ID,
  QUICK_START_STEPS,
} from "./constants";
import type {
  QuickStartCanvasDemoState,
  QuickStartMockSubmission,
  QuickStartMode,
  QuickStartPrefill,
  QuickStartStep,
} from "./types";

type QuickStartContextValue = {
  active: boolean;
  stepIndex: number;
  currentStep: QuickStartStep | null;
  mode: QuickStartMode | null;
  prefill: QuickStartPrefill;
  canvasDemo: QuickStartCanvasDemoState;
  mockSubmission: QuickStartMockSubmission | null;
  demoSubmissionId: string | null;
  start: () => void;
  finish: () => void;
  advance: () => Promise<void>;
  syncStepForRoute: () => void;
  requestNodeDetailFocus: () => void;
  setSelectedNode: (nodeId: string | null) => void;
  setDetailExpanded: (expanded: boolean) => void;
  isSubmissionRouteMatch: (submissionId: string) => boolean;
};

const QuickStartContext = createContext<QuickStartContextValue | undefined>(undefined);

const QUICK_START_LOGIN_FLAG = "arcbench.quickstart.login";

const demoSequence: Array<{ nodeId: string; states: RequirementVisualState[] }> = [
  { nodeId: "ROOT", states: ["design", "implement", "test-passed"] },
  { nodeId: "REQ-1", states: ["design", "implement", "test-passed"] },
  { nodeId: "REQ-1.1", states: ["design", "implement", "test-passed"] },
];

const emptyVisualLogs: SubmissionLogs = {
  events: "",
  stdout: "Quick Start simulation mode.\n",
  stderr: "",
  visual_events: [],
};

function buildMockSteps(): SubmissionStep[] {
  return [
    {
      key: "deploy_agent",
      title: "Deploy Agent",
      status: "completed",
      description: "Pull runner container, prepare workspace, and install agent dependencies.",
      logs: ["[success] Demo agent package loaded"],
    },
    {
      key: "start_agent",
      title: "Start Agent",
      status: "completed",
      description: "Execute the agent until it finishes the task and exits cleanly.",
      logs: ["[success] Requirement processing visualization started"],
    },
    {
      key: "run_tests",
      title: "Run Tests",
      status: "running",
      description: "Execute the benchmark test suite against the finished task output.",
      logs: ["[success] Canvas tutorial animation is active"],
    },
  ];
}

function buildMockSubmission(): QuickStartMockSubmission {
  const createdAt = new Date().toISOString();
  const submission: SubmissionDetail = {
    id: "quickstart-demo-submission",
    display_name: QUICK_START_DISPLAY_NAME,
    model_name: QUICK_START_MODEL_NAME,
    requirement_id: QUICK_START_REQUIREMENT_ID,
    runtime: "python",
    original_filename: "demo_agent.zip",
    status: "RUNNING",
    score: null,
    passed_count: 0,
    failed_count: 0,
    created_at: createdAt,
    started_at: createdAt,
    finished_at: null,
    failure_reason: null,
    steps: buildMockSteps(),
    stdout_path: null,
    stderr_path: null,
    result_path: null,
    workspace_path: null,
    logs_available: true,
    tests: [],
  };
  return { submission, logs: emptyVisualLogs };
}

function buildRoute(step: QuickStartStep, submissionId: string | null) {
  if (!step.route.includes("__dynamic__")) {
    return step.route;
  }
  return step.route.replace("__dynamic__", submissionId ?? "quickstart-demo-submission");
}

export function QuickStartProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState<QuickStartMode | null>(null);
  const [prefill, setPrefill] = useState<QuickStartPrefill>({
    runtime: "python",
    displayName: QUICK_START_DISPLAY_NAME,
    modelName: QUICK_START_MODEL_NAME,
    file: null,
    loading: false,
    error: null,
  });
  const [demoSubmissionId, setDemoSubmissionId] = useState<string | null>(null);
  const [mockSubmission, setMockSubmission] = useState<QuickStartMockSubmission | null>(null);
  const [canvasDemo, setCanvasDemo] = useState<QuickStartCanvasDemoState>({
    active: false,
    completed: false,
    currentNodeId: null,
    nodeStates: {},
    selectedNodeId: null,
    detailExpanded: false,
  });

  const timersRef = useRef<number[]>([]);
  const currentStep = active ? QUICK_START_STEPS[stepIndex] ?? null : null;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const resetState = useCallback(() => {
    clearTimers();
    setActive(false);
    setStepIndex(0);
    setMode(null);
    setDemoSubmissionId(null);
    setMockSubmission(null);
    setCanvasDemo({
      active: false,
      completed: false,
      currentNodeId: null,
      nodeStates: {},
      selectedNodeId: null,
      detailExpanded: false,
    });
    setPrefill({
      runtime: "python",
      displayName: QUICK_START_DISPLAY_NAME,
      modelName: QUICK_START_MODEL_NAME,
      file: null,
      loading: false,
      error: null,
    });
  }, [clearTimers]);

  const finish = useCallback(() => {
    resetState();
  }, [resetState]);

  const loadDemoAgent = useCallback(async () => {
    setPrefill((current) => ({ ...current, loading: true, error: null }));
    try {
      const file = await api.getDemoAgentFile();
      setPrefill((current) => ({ ...current, file, loading: false, error: null }));
      return file;
    } catch (error) {
      const errorMessage = (error as Error).message;
      setPrefill((current) => ({ ...current, loading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  const startCanvasDemo = useCallback(() => {
    clearTimers();
    setCanvasDemo({
      active: true,
      completed: false,
      currentNodeId: null,
      nodeStates: {},
      selectedNodeId: null,
      detailExpanded: false,
    });

    let offset = 400;
    demoSequence.forEach(({ nodeId, states }) => {
      states.forEach((state) => {
        const timer = window.setTimeout(() => {
          setCanvasDemo((current) => ({
            ...current,
            currentNodeId: nodeId,
            selectedNodeId: nodeId,
            nodeStates: {
              ...current.nodeStates,
              [nodeId]: state,
            },
          }));
        }, offset);
        timersRef.current.push(timer);
        offset += 2000;
      });
    });
  }, [clearTimers]);

  const completeCanvasDemo = useCallback(() => {
    clearTimers();
    setCanvasDemo({
      active: true,
      completed: true,
      currentNodeId: "REQ-1",
      selectedNodeId: "REQ-1",
      detailExpanded: false,
      nodeStates: {
        ROOT: "test-passed",
        "REQ-1": "test-passed",
        "REQ-1.1": "test-passed",
      },
    });
  }, [clearTimers]);

  const requestNodeDetailFocus = useCallback(() => {
    setCanvasDemo((current) => ({
      ...current,
      selectedNodeId: "REQ-1",
      currentNodeId: "REQ-1",
      detailExpanded: true,
    }));
  }, []);

  const setSelectedNode = useCallback((nodeId: string | null) => {
    setCanvasDemo((current) => ({
      ...current,
      selectedNodeId: nodeId,
    }));
  }, []);

  const setDetailExpanded = useCallback((expanded: boolean) => {
    setCanvasDemo((current) => ({
      ...current,
      detailExpanded: expanded,
    }));
  }, []);

  const ensureRealSubmission = useCallback(async () => {
    const file = prefill.file ?? await loadDemoAgent();
    try {
      const created = await api.createSubmission(
        QUICK_START_REQUIREMENT_ID,
        "python",
        file,
        QUICK_START_DISPLAY_NAME,
        QUICK_START_MODEL_NAME,
      );
      const started = await api.startSubmission(created.submission.id);
      setMode("real");
      setDemoSubmissionId(started.id);
      return started;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to start quick start submission.";
      message.error(errorMessage);
      throw error;
    }
  }, [loadDemoAgent, prefill.file]);

  const syncStepForRoute = useCallback(() => {
    if (!active) {
      return;
    }

    const currentRoute = location.pathname;
    const currentExpectedRoute = currentStep ? buildRoute(currentStep, demoSubmissionId) : null;
    if (currentExpectedRoute === currentRoute) {
      return;
    }

    if (currentRoute === QUICK_START_STEPS[2].route && stepIndex < 2) {
      setStepIndex(2);
      return;
    }

    const submissionRoute = buildRoute(QUICK_START_STEPS[5], demoSubmissionId);
    if (currentRoute === submissionRoute && stepIndex < 5) {
      setStepIndex(5);
      return;
    }

    if (currentRoute === QUICK_START_STEPS[0].route) {
      if (stepIndex !== 0) {
        setStepIndex(0);
      }
      return;
    }

    if (currentRoute === QUICK_START_STEPS[1].route) {
      if (stepIndex !== 1) {
        setStepIndex(1);
      }
      return;
    }

    const detailRoute = buildRoute(QUICK_START_STEPS[2], demoSubmissionId);
    if (currentRoute === detailRoute && stepIndex >= 2 && stepIndex <= 4) {
      return;
    }
    if (currentRoute === submissionRoute && stepIndex >= 5 && stepIndex <= 7) {
      return;
    }
  }, [active, currentStep, demoSubmissionId, location.pathname, stepIndex]);

  const advance = useCallback(async () => {
    if (!active || !currentStep) {
      return;
    }

    if (currentStep.id === "detail-submit") {
      let submission;
      try {
        submission = await ensureRealSubmission();
      } catch {
        return;
      }
      const nextStepIndex = stepIndex + 1;
      const nextStep = QUICK_START_STEPS[nextStepIndex];
      if (nextStep) {
        setStepIndex(nextStepIndex);
        navigate(buildRoute(nextStep, submission.id));
      }
      return;
    }

    if (currentStep.id === "submission-canvas") {
      completeCanvasDemo();
    }

    if (currentStep.id === "submission-node-detail") {
      requestNodeDetailFocus();
    }

    if (currentStep.id === "submission-api-doc") {
      finish();
      return;
    }

    const nextStepIndex = stepIndex + 1;
    const nextStep = QUICK_START_STEPS[nextStepIndex];
    if (!nextStep) {
      finish();
      return;
    }

    setStepIndex(nextStepIndex);
    const route = buildRoute(nextStep, demoSubmissionId);
    navigate(route);
  }, [
    active,
    completeCanvasDemo,
    currentStep,
    demoSubmissionId,
    ensureRealSubmission,
    finish,
    navigate,
    requestNodeDetailFocus,
    stepIndex,
  ]);

  const start = useCallback(() => {
    if (isLoading) {
      return;
    }
    if (!user) {
      window.sessionStorage.setItem(QUICK_START_LOGIN_FLAG, "1");
      navigate("/login", { state: { from: "/playground" } });
      return;
    }

    resetState();
    setActive(true);
    setStepIndex(0);
    setMode(null);
    setMockSubmission(null);
    void loadDemoAgent().catch(() => undefined);
    navigate("/playground");
  }, [isLoading, loadDemoAgent, navigate, resetState, user]);

  useEffect(() => {
    if (!active || !currentStep) {
      return;
    }
    const expectedRoute = buildRoute(currentStep, demoSubmissionId);
    if (location.pathname !== expectedRoute) {
      return;
    }
    if (currentStep.id === "submission-canvas" && !canvasDemo.active) {
      startCanvasDemo();
    }
    if (currentStep.id === "submission-node-detail") {
      requestNodeDetailFocus();
    }
  }, [active, canvasDemo.active, currentStep, demoSubmissionId, location.pathname, requestNodeDetailFocus, startCanvasDemo]);

  useEffect(() => {
    if (isLoading || !user) {
      return;
    }
    if (window.sessionStorage.getItem(QUICK_START_LOGIN_FLAG) !== "1") {
      return;
    }
    window.sessionStorage.removeItem(QUICK_START_LOGIN_FLAG);
    resetState();
    setActive(true);
    setStepIndex(0);
    void loadDemoAgent().catch(() => undefined);
    navigate("/playground", { replace: true });
  }, [isLoading, loadDemoAgent, navigate, resetState, user]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const isSubmissionRouteMatch = useCallback(
    (submissionId: string) => {
      if (!active || !demoSubmissionId) {
        return false;
      }
      return submissionId === demoSubmissionId;
    },
    [active, demoSubmissionId],
  );

  const value = useMemo<QuickStartContextValue>(
    () => ({
      active,
      stepIndex,
      currentStep,
      mode,
      prefill,
      canvasDemo,
      mockSubmission,
      demoSubmissionId,
      start,
      finish,
      advance,
      syncStepForRoute,
      requestNodeDetailFocus,
      setSelectedNode,
      setDetailExpanded,
      isSubmissionRouteMatch,
    }),
    [
      active,
      advance,
      canvasDemo,
      currentStep,
      demoSubmissionId,
      finish,
      isSubmissionRouteMatch,
      mockSubmission,
      mode,
      prefill,
      requestNodeDetailFocus,
      setDetailExpanded,
      setSelectedNode,
      syncStepForRoute,
      start,
      stepIndex,
    ],
  );

  return <QuickStartContext.Provider value={value}>{children}</QuickStartContext.Provider>;
}

export function useQuickStart() {
  const context = useContext(QuickStartContext);
  if (!context) {
    throw new Error("useQuickStart must be used within QuickStartProvider");
  }
  return context;
}
