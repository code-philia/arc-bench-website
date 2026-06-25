import type { SubmissionStep } from "../../lib/types";

type SubmissionStepListProps = {
  steps: SubmissionStep[];
  submissionStatus?: string;
  failureReason?: string | null;
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
  if (submissionStatus === "PAUSED") {
    return steps.map((step) => (step.status === "running"
      ? {
          ...step,
          status: "paused",
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

export default function SubmissionStepList({
  steps,
  submissionStatus,
  failureReason,
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
            {step.logs.length ? (
              <div className="step-log-list">
                {step.logs.map((logLine) => (
                  <div key={logLine} className={logClassName(logLine)}>
                    {logLine}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
