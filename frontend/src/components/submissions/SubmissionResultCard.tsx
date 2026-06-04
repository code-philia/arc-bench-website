import type { SubmissionDetail } from "../../lib/types";

export default function SubmissionResultCard({ submission }: { submission: SubmissionDetail }) {
  const total = submission.passed_count + submission.failed_count;
  const score = submission.score ?? 0;

  if (total === 0) {
    return (
      <div className="results-empty">
        <div className="empty-state">Results will appear after the runner completes.</div>
      </div>
    );
  }

  return (
    <div className="results-panel">
      <div className="results-summary">
        <div className="results-count">
          <span className="pass-num">{submission.passed_count}</span>
          <span className="total-num">/{total}</span>
        </div>
        <div className="results-bar" aria-hidden="true">
          <div className="results-bar-fill" style={{ width: `${score}%` }} />
        </div>
        <div className="results-score">{score.toFixed(1)}</div>
      </div>
      <div className="test-list">
        {submission.tests.map((test) => (
          <div key={`${test.name}-${test.duration_ms}`} className="test-item">
            <span className={`test-badge ${test.status === "passed" ? "pass" : "fail"}`}>
              {test.status}
            </span>
            <span className="test-name">{test.name}</span>
            <span className="test-time">{Math.round(test.duration_ms)} ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}
