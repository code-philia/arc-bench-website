import type { SubmissionStep } from "../../lib/types";

export default function SubmissionStepList({ steps }: { steps: SubmissionStep[] }) {
  return (
    <div className="stepper">
      {steps.map((step, index) => (
        <div key={step.key} className={`step ${step.status}`}>
          <div className="step-indicator">
            <div className="step-node">{index + 1}</div>
            {index < steps.length - 1 ? <div className="step-line" /> : null}
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
