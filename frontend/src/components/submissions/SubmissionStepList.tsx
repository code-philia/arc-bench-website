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
          </div>
        </div>
      ))}
    </div>
  );
}
