import { useEffect, useMemo, useState } from "react";

import type { SubmissionStep } from "../../lib/types";

type SubmissionStepListProps = {
  steps: SubmissionStep[];
  submissionStatus?: string;
  failureReason?: string | null;
  runnerEventLines?: string[];
};

type StepLogRendererProps = {
  step: SubmissionStep;
  logClassName: (logLine: string) => string;
  runnerEventLines?: string[];
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  deploy_agent: "Pull runner container, prepare workspace, and install agent dependencies.",
  start_agent: "Execute the agent until it finishes the task and exits cleanly.",
  run_tests: "Execute the benchmark test suite against the finished task output.",
};

function normalizeSteps(
  steps: SubmissionStep[],
  submissionStatus?: string,
  failureReason?: string | null,
): SubmissionStep[] {
  if (submissionStatus === "PAUSED" || submissionStatus === "PAUSE_REQUESTED") {
    return steps.map((step) => (step.status === "running"
      ? {
          ...step,
          status: "paused",
          description: submissionStatus === "PAUSE_REQUESTED" ? "Pausing current run" : step.description,
        }
      : step));
  }

  if (submissionStatus !== "FAILED") {
    return steps;
  }

  const hasExplicitFailedStep = steps.some((step) => step.status === "failed");
  if (hasExplicitFailedStep) {
    return steps.map((step) => {
      if (step.status === "completed") {
        return {
          ...step,
          description: STEP_DESCRIPTIONS[step.key] || step.description,
        };
      }

      if (step.status === "failed") {
        return {
          ...step,
          description: failureReason || step.description || "Failed",
        };
      }

      if (step.status === "running") {
        return {
          ...step,
          status: "pending",
          description: "Not reached",
        };
      }

      return {
        ...step,
        description: step.status === "pending"
          ? (STEP_DESCRIPTIONS[step.key] || step.description)
          : step.description,
      };
    });
  }

  let failureAssigned = false;

  return steps.map((step) => {
    const baseDescription = STEP_DESCRIPTIONS[step.key] || step.description;
    if (step.status === "completed") {
      return {
        ...step,
        description: baseDescription,
      };
    }

    if (!failureAssigned && (step.status === "running" || step.status === "pending")) {
      failureAssigned = true;
      return {
        ...step,
        status: "failed",
        description: failureReason || step.description || "Failed",
      };
    }

    return {
      ...step,
      status: "pending",
      description: step.status === "pending" ? baseDescription : "Not reached",
    };
  });
}

function StepLogRenderer({ step, logClassName, runnerEventLines }: StepLogRendererProps) {
  const recentLogs = useMemo(() => step.logs.slice(-5), [step.logs]);
  const streamLines = useMemo(() => (runnerEventLines ?? []).slice(-5), [runnerEventLines]);
  const streamSignature = useMemo(() => streamLines.join("\n"), [streamLines]);
  const [streamVersion, setStreamVersion] = useState(0);

  useEffect(() => {
    if (!streamSignature) {
      return;
    }
    setStreamVersion((current) => current + 1);
  }, [streamSignature]);

  if (step.key === "start_agent" && streamLines.length > 0) {
    return (
      <div className="step-log-stream-shell">
        <div key={`runner-stream-${streamVersion}`} className="step-log-stream">
          {streamLines.map((logLine, index) => (
            <div
              key={`runner-line-${streamVersion}-${index}-${logLine}`}
              className={`${logClassName(logLine)} step-log-stream-item${index === streamLines.length - 1 ? " latest" : ""}`}
            >
              {logLine}
            </div>
          ))}
        </div>
        <div className="step-log-stream-meta">
          <span className="step-log-stream-badge">runner-events.jsonl</span>
          <span className="step-log-stream-status">{streamLines.length}/5 visible</span>
        </div>
      </div>
    );
  }

  if (recentLogs.length === 0) {
    return null;
  }

  return (
    <div className="step-log-list">
      {recentLogs.map((logLine, index) => (
        <div key={`${step.key}-${index}-${logLine}`} className={logClassName(logLine)}>
          {logLine}
        </div>
      ))}
    </div>
  );
}

export default function SubmissionStepList({
  steps,
  submissionStatus,
  failureReason,
  runnerEventLines,
}: SubmissionStepListProps) {
  const resolvedSteps = normalizeSteps(steps, submissionStatus, failureReason);

  const logClassName = (logLine: string) => {
    if (logLine.includes("[success]")) return "step-log-item success";
    if (logLine.includes("[error]")) return "step-log-item error";
    return "step-log-item";
  };

  return (
    <div className="stepper">
      {resolvedSteps.map((step, index) => (
        <div key={step.key} className={`step ${step.status.toLowerCase()}`}>
          <div className="step-indicator">
            <div className="step-node">{index + 1}</div>
            {index < resolvedSteps.length - 1 ? <div className="step-line" /> : null}
          </div>
          <div className="step-content">
            <div className="step-stage-label">Stage {index + 1}</div>
            <div className="step-title">{step.title}</div>
            <div className="step-desc">{step.description}</div>
            <StepLogRenderer step={step} logClassName={logClassName} runnerEventLines={runnerEventLines} />
          </div>
        </div>
      ))}
    </div>
  );
}
