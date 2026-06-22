import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import SubmissionResultCard from "../components/submissions/SubmissionResultCard";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { ApiError, api } from "../lib/api";
import { checkHostDemoPreview } from "../lib/preview";
import type { SubmissionDetail, SubmissionLogs } from "../lib/types";

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt) return "-";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.round((end - start) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function resultSummary(submission: SubmissionDetail) {
  const total = submission.passed_count + submission.failed_count;
  if (total === 0) return "No test results yet";
  return `${submission.passed_count}/${total} passed`;
}

export default function SubmissionDetailPage() {
  const { submissionId = "" } = useParams();
  const { user } = useAuth();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [logs, setLogs] = useState<SubmissionLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorStatus, setLoadErrorStatus] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "events" | "stdout" | "stderr">("results");
  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewFrameVersion, setPreviewFrameVersion] = useState(0);
  const pollRef = useRef<number | null>(null);
  const previewUrl = api.getSubmissionPreviewUrl(submissionId);
  const previewFrameUrl = `${previewUrl}?refresh=${previewFrameVersion}`;

  const refreshPreview = async () => {
    setPreviewLoading(true);
    try {
      const available = await checkHostDemoPreview(submissionId);
      setPreviewAvailable(available);
      if (available) {
        setPreviewFrameVersion((current) => current + 1);
      }
    } catch {
      setPreviewAvailable(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    setPreviewAvailable(false);
    setPreviewLoading(true);
    setPreviewFrameVersion(0);
  }, [submissionId]);

  useEffect(() => {
    setLoadError(null);
    setLoadErrorStatus(null);
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
      .catch((error: Error) => {
        setSubmission(null);
        setLogs(null);
        setLoadError(error.message);
        setLoadErrorStatus(error instanceof ApiError ? error.status : null);
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

  useEffect(() => {
    if (!submission) {
      setPreviewAvailable(false);
      setPreviewLoading(false);
      return;
    }
    if (previewAvailable) {
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);

    const checkPreview = () => {
      checkHostDemoPreview(submissionId)
        .then((available) => {
          if (cancelled) {
            return;
          }
          setPreviewAvailable(available);
          setPreviewLoading(false);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setPreviewAvailable(false);
          setPreviewLoading(false);
        });
    };

    checkPreview();

    if (["PENDING", "RUNNING"].includes(submission.status)) {
      const previewPoll = window.setInterval(checkPreview, 3000);
      return () => {
        cancelled = true;
        window.clearInterval(previewPoll);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [previewAvailable, submission, submissionId]);

  if (loading) {
    return (
      <div className="page centered">
        <div className="loading-state">Loading submission...</div>
      </div>
    );
  }

  if (!submission) {
    const loginRequired = loadErrorStatus === 401;
    return (
      <div className="page centered">
        <div className="empty-state">
          {loginRequired
            ? "Login is required to view this submission."
            : loadError || "Submission not found."}
          <div style={{ marginTop: 8 }}>
            {loginRequired || !user ? (
              <Link className="inline-link" to="/login">
                Login
              </Link>
            ) : (
              <Link className="inline-link" to="/requirements">
                Back to competitions
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page submission-page">
      <div className="submission-hero">
        <div className="submission-hero-main">
          <div>
            <div className="muted">Submission</div>
            <h1>{submission.display_name || submission.id}</h1>
            <p className="muted">
              {submission.requirement_id} / {submission.runtime} / {submission.status}
            </p>
            {submission.model_name ? <div className="submission-model-row"><span className="model-chip">{submission.model_name}</span></div> : null}
          </div>
          <div className="submission-meta-grid">
            <div className="submission-meta-card">
              <div className="submission-meta-label">Submission ID</div>
              <div className="submission-meta-value">{submission.id}</div>
            </div>
            <div className="submission-meta-card">
              <div className="submission-meta-label">Model</div>
              <div className="submission-meta-value">{submission.model_name || "-"}</div>
            </div>
            <div className="submission-meta-card">
              <div className="submission-meta-label">Created</div>
              <div className="submission-meta-value">{formatDateTime(submission.created_at)}</div>
            </div>
            <div className="submission-meta-card">
              <div className="submission-meta-label">Started</div>
              <div className="submission-meta-value">{formatDateTime(submission.started_at)}</div>
            </div>
            <div className="submission-meta-card">
              <div className="submission-meta-label">Duration</div>
              <div className="submission-meta-value">{formatDuration(submission.started_at, submission.finished_at)}</div>
            </div>
            <div className="submission-meta-card">
              <div className="submission-meta-label">Results</div>
              <div className="submission-meta-value">{resultSummary(submission)}</div>
            </div>
          </div>
        </div>
        <div className="submission-hero-side">
          <div className="submission-score">{submission.score?.toFixed(1) ?? "--"}</div>
          <div className={`test-badge ${submission.status === "PASSED" ? "pass" : submission.status === "FAILED" ? "fail" : "pending"}`}>
            {submission.status}
          </div>
        </div>
      </div>

      <div className="submission-grid">
        <section className="action-section">
          <div className="action-section-title">Run Status</div>
          <SubmissionStepList
            steps={submission.steps}
            submissionStatus={submission.status}
            failureReason={submission.failure_reason}
          />
        </section>

        <section className="action-section">
          <div className="action-section-title">Execution Detail</div>
          <div className="doc-tabs detail-tabs">
            {[
              { key: "results", label: "Results" },
              { key: "events", label: "Events" },
              { key: "stdout", label: "Stdout" },
              { key: "stderr", label: "Stderr" },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`doc-tab${activeTab === tab.key ? " active" : ""}`}
                type="button"
                onClick={() => setActiveTab(tab.key as "results" | "events" | "stdout" | "stderr")}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="detail-tab-panel">
            {activeTab === "results" ? (
              <SubmissionResultCard submission={submission} />
            ) : activeTab === "events" ? (
              <pre className="log-panel">{logs?.events || "No backend events yet."}</pre>
            ) : activeTab === "stdout" ? (
              <pre className="log-panel">{logs?.stdout || "No stdout yet."}</pre>
            ) : (
              <pre className="log-panel">{logs?.stderr || "No stderr yet."}</pre>
            )}
          </div>
        </section>

        <section className="action-section">
          <div className="action-section-header">
            <div className="action-section-title">Live Website Preview</div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                className="inline-link"
                onClick={() => {
                  void refreshPreview();
                }}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                {previewAvailable ? "Refresh" : "Retry"}
              </button>
              {previewAvailable ? (
                <a className="inline-link" href={previewUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              ) : null}
            </div>
          </div>
          <div className="detail-tab-panel">
            {previewLoading ? (
              <div className="results-empty">
                <div className="loading-state">Loading preview...</div>
              </div>
            ) : previewAvailable ? (
              <iframe
                key={`${submissionId}-${previewFrameVersion}`}
                src={previewFrameUrl}
                title="Live Website Preview"
                className="playground-preview-iframe"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            ) : (
              <div className="results-empty">
                <div className="empty-state">
                  {["PENDING", "RUNNING"].includes(submission.status)
                    ? "The website preview will appear after implementation artifacts are generated."
                    : "This submission does not include previewable frontend artifacts."}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

