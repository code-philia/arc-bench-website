import type { SubmissionDetail } from "../../lib/types";

export default function SubmissionResultCard({ submission }: { submission: SubmissionDetail }) {
  const total = submission.passed_count + submission.failed_count;
  const score = submission.score ?? 0;

  if (total === 0) {
    return (
      <div className="results-empty results-empty--quiet">
        <div className="results-empty-mark" aria-hidden="true">--</div>
        <div>
          <div className="results-empty-title">
            {submission.status === "PENDING" ? "Tests are queued" : submission.status === "RUNNING" ? "Tests are not running yet" : "No test results"}
          </div>
          <div className="results-empty-copy">
            {submission.status === "PENDING" || submission.status === "RUNNING"
              ? "Results will appear here when the runner reaches the test stage."
              : "This run finished without a test result to display."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="results-panel">
      <div className="results-summary">
        <div className="results-summary-count">
          <div className="results-summary-label">Tests passed</div>
          <div className="results-count">
            <span className="pass-num">{submission.passed_count}</span>
            <span className="total-num">/{total}</span>
          </div>
        </div>
        <div className="results-summary-meter">
          <div className="results-summary-meter-head">
            <span>Pass rate</span>
            <strong>{score.toFixed(1)}%</strong>
          </div>
          <div className="results-bar" aria-hidden="true">
            <div className="results-bar-fill" style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
          </div>
        </div>
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
