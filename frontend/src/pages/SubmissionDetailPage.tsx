import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import SubmissionResultCard from "../components/submissions/SubmissionResultCard";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { api } from "../lib/api";
import type { SubmissionDetail, SubmissionLogs } from "../lib/types";

export default function SubmissionDetailPage() {
  const { submissionId = "" } = useParams();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [logs, setLogs] = useState<SubmissionLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"results" | "stdout" | "stderr">("results");
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([api.getSubmission(submissionId), api.getSubmissionLogs(submissionId)])
      .then(([detail, latestLogs]) => {
        setSubmission(detail);
        setLogs(latestLogs);
        if (["PENDING", "RUNNING"].includes(detail.status)) {
          pollRef.current = window.setInterval(() => {
            api.getSubmission(submissionId).then(setSubmission).catch(() => undefined);
            api.getSubmissionLogs(submissionId).then(setLogs).catch(() => undefined);
          }, 2000);
        }
      })
      .finally(() => setLoading(false));

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [submissionId]);

  useEffect(() => {
    if (!submission || !pollRef.current) {
      return;
    }
    if (!["PENDING", "RUNNING"].includes(submission.status)) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [submission]);

  if (loading) {
    return (
      <div className="page centered">
        <div className="loading-state">Loading submission...</div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="page centered">
        <div className="empty-state">Submission not found.</div>
      </div>
    );
  }

  return (
    <div className="page submission-page">
      <div className="submission-hero">
        <div>
          <div className="muted">Submission</div>
          <h1>{submission.id}</h1>
          <p className="muted">
            {submission.requirement_id} · {submission.runtime} · {submission.status}
          </p>
        </div>
        <div className="submission-score">{submission.score?.toFixed(1) ?? "--"}</div>
      </div>

      {submission.failure_reason ? (
        <div className="inline-alert error" style={{ marginBottom: 16 }}>
          {submission.failure_reason}
        </div>
      ) : null}

      <div className="submission-grid">
        <section className="action-section">
          <div className="action-section-title">Run Status</div>
          <SubmissionStepList steps={submission.steps} />
        </section>

        <section className="action-section">
          <div className="action-section-title">Execution Detail</div>
          <div className="doc-tabs detail-tabs">
            {[
              { key: "results", label: "Results" },
              { key: "stdout", label: "stdout" },
              { key: "stderr", label: "stderr" },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`doc-tab${activeTab === tab.key ? " active" : ""}`}
                type="button"
                onClick={() => setActiveTab(tab.key as "results" | "stdout" | "stderr")}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="detail-tab-panel">
            {activeTab === "results" ? (
              <SubmissionResultCard submission={submission} />
            ) : activeTab === "stdout" ? (
              <pre className="log-panel">{logs?.stdout || "No stdout yet."}</pre>
            ) : (
              <pre className="log-panel">{logs?.stderr || "No stderr yet."}</pre>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
