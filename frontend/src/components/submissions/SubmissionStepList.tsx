import type { SubmissionStep } from "../../lib/types";

type SubmissionStepListProps = {
  steps: SubmissionStep[];
  submissionStatus?: string;
  failureReason?: string | null;
};

function normalizeSteps(
  steps: SubmissionStep[],
  submissionStatus?: string,
  failureReason?: string | null,
): SubmissionStep[] {
  if (submissionStatus !== "FAILED") {
    return steps;
  }

  let failureAssigned = false;

  return steps.map((step) => {
    if (step.status === "completed") {
      return step;
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
      description: step.status === "pending" ? step.description : "Not reached",
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
