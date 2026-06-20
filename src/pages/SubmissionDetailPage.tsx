import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import SubmissionResultCard from "../components/submissions/SubmissionResultCard";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { ApiError, api } from "../lib/api";
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

export default function SubmissionDetailPage() {
  const { submissionId = "" } = useParams();
  const { user } = useAuth();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [logs, setLogs] = useState<SubmissionLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorStatus, setLoadErrorStatus] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "stdio">("results");
  const [stdioTab, setStdioTab] = useState<"stdout" | "stderr">("stdout");
  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const pollRef = useRef<number | null>(null);

  const previewUrl = submission ? api.getSubmissionPreviewUrl(submissionId) : "";

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

  // Check preview availability when submission changes or completes
  useEffect(() => {
    if (!submission) {
      setPreviewAvailable(false);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);

    const checkPreview = () => {
      api.getSubmissionPreviewStatus(submissionId)
        .then((status) => {
          if (!cancelled) {
            setPreviewAvailable(status.available);
            setPreviewLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPreviewAvailable(false);
            setPreviewLoading(false);
          }
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
  }, [submission, submissionId]);

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
              <Link className="inline-link" to="/">
                Go home
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page submission-page-locked" style={{ padding: 0, height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "320px 1fr", 
        gridTemplateRows: "1fr 400px",
        height: "100%",
        width: "100%",
        gap: "0" 
      }}>
        {/* Left sidebar - Status panel */}
        <aside style={{ 
          gridColumn: "1 / 2", 
          gridRow: "1 / 2", 
          overflow: "auto", 
          borderRight: "1px solid var(--border)",
          background: "var(--bg-sidebar)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ padding: "20px" }}>
            <h1 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{submission.display_name || submission.id}</h1>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <div>ID: {submission.id.substring(0, 10)}</div>
              <div>Duration: {formatDuration(submission.started_at, submission.finished_at)}</div>
            </div>
          </div>

          <div style={{ padding: "0 20px 20px" }}>
            <div className="action-section-title" style={{ marginBottom: '12px', fontWeight: 600 }}>Run Status</div>
            <SubmissionStepList
              steps={submission.steps}
              submissionStatus={submission.status}
              failureReason={submission.failure_reason}
            />
          </div>
        </aside>

        {/* Right panel - Preview area */}
        <main style={{ 
          gridColumn: "2 / 3", 
          gridRow: "1 / 2", 
          overflow: "hidden", 
          display: "flex", 
          flexDirection: "column",
          background: "#f5f5f5"
        }}>
          <div style={{ 
            padding: "8px 16px", 
            background: "white", 
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span style={{ fontWeight: 600 }}>Live Website Preview</span>
            {previewAvailable && (
              <a href={previewUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>
                Open in new tab
              </a>
            )}
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            {previewLoading ? (
              <div style={{ 
                height: "100%",
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "var(--text-secondary)"
              }}>
                Loading preview...
              </div>
            ) : previewAvailable ? (
              <iframe
                key={submissionId}
                src={previewUrl}
                title="Website Preview"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            ) : (
              <div style={{ 
                height: "100%",
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                textAlign: "center",
                padding: "40px",
                color: "var(--text-secondary)"
              }}>
                <div>
                  <div style={{ fontSize: '1.5rem', marginBottom: '16px' }}>🌐</div>
                  <div>Preview not available yet.</div>
                  <div style={{ fontSize: '0.875rem', marginTop: '8px' }}>
                    {["PENDING", "RUNNING"].includes(submission.status)
                      ? "The website preview will appear after the agent completes implementation."
                      : "This submission does not include generated website artifacts."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Bottom panel - Test Results, Stdio */}
        <footer style={{ 
          gridColumn: "1 / 3", 
          gridRow: "2 / 3", 
          borderTop: "1px solid var(--border)", 
          display: "flex", 
          flexDirection: "column",
          background: "white"
        }}>
          <div className="doc-tabs detail-tabs" style={{ padding: '0 20px', background: '#fafafa' }}>
            {[
              { key: "results", label: "Test Result" },
              { key: "stdio", label: "Stdout/Stderr" },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`doc-tab${activeTab === tab.key ? " active" : ""}`}
                type="button"
                onClick={() => setActiveTab(tab.key as "results" | "stdio")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            {activeTab === "results" ? (
              <div style={{ padding: '20px', height: '100%', overflow: 'auto' }}>
                <SubmissionResultCard submission={submission} />
              </div>
            ) : (
              <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <div className="doc-tabs detail-tabs nested-tabs" style={{ padding: '0 20px' }}>
                  <button
                    className={`doc-tab${stdioTab === "stdout" ? " active" : ""}`}
                    type="button"
                    onClick={() => setStdioTab("stdout")}
                  >
                    Stdout
                  </button>
                  <button
                    className={`doc-tab${stdioTab === "stderr" ? " active" : ""}`}
                    type="button"
                    onClick={() => setStdioTab("stderr")}
                  >
                    Stderr
                  </button>
                </div>
                <pre style={{ 
                  flex: 1, 
                  margin: 0, 
                  padding: '20px', 
                  background: '#1e1e1e', 
                  color: '#d4d4d4', 
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}>
                  {stdioTab === "stdout" ? (logs?.stdout || "No stdout yet.") : (logs?.stderr || "No stderr yet.")}
                </pre>
              </div>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
