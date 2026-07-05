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
import {
  QUICK_START_DISPLAY_NAME,
  QUICK_START_MODEL_NAME,
  QUICK_START_REQUIREMENT_ID,
  QUICK_START_STEPS,
} from "./constants";
import type {
  QuickStartCanvasDemoState,
  QuickStartPrefill,
  QuickStartStep,
} from "./types";

type QuickStartContextValue = {
  active: boolean;
  stepIndex: number;
  currentStep: QuickStartStep | null;
  prefill: QuickStartPrefill;
  canvasDemo: QuickStartCanvasDemoState;
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
  const [prefill, setPrefill] = useState<QuickStartPrefill>({
    runtime: "python",
    displayName: QUICK_START_DISPLAY_NAME,
    modelName: QUICK_START_MODEL_NAME,
    file: null,
    loading: false,
    error: null,
  });
  const [demoSubmissionId, setDemoSubmissionId] = useState<string | null>(null);
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
    setDemoSubmissionId(null);
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

  const requestNodeDetailFocus = useCallback(() => {
    setCanvasDemo((current) => ({
      ...current,
      selectedNodeId: current.selectedNodeId ?? current.currentNodeId ?? "ROOT",
      currentNodeId: current.currentNodeId ?? current.selectedNodeId ?? "ROOT",
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
      const created = await api.createSubmission({
        requirementId: QUICK_START_REQUIREMENT_ID,
        runtime: "python",
        file,
        displayName: QUICK_START_DISPLAY_NAME,
        modelName: QUICK_START_MODEL_NAME,
      });
      const started = await api.startSubmission(created.submission.id);
      setDemoSubmissionId(started.id);
      setCanvasDemo({
        active: true,
        completed: false,
        currentNodeId: null,
        nodeStates: {},
        selectedNodeId: null,
        detailExpanded: false,
      });
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
    if (currentStep.id === "submission-node-detail") {
      requestNodeDetailFocus();
    }
  }, [active, currentStep, demoSubmissionId, location.pathname, requestNodeDetailFocus]);

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
      prefill,
      canvasDemo,
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
