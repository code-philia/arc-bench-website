import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import SubmissionResultCard from "../components/submissions/SubmissionResultCard";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { ApiError, api } from "../lib/api";
import type { SubmissionDetail, SubmissionLogs, SubmissionPreviewStatus, SubmissionSseEvent } from "../lib/types";

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
  const [previewStatus, setPreviewStatus] = useState<SubmissionPreviewStatus | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewFrameVersion, setPreviewFrameVersion] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sseReconnectRef = useRef<number | null>(null);
  const previewUrl = previewStatus?.preview_url ?? api.getSubmissionPreviewUrl(submissionId);
  const previewFrameUrl = `${previewUrl}${previewUrl.includes("?") ? "&" : "?"}refresh=${previewFrameVersion}`;
  const previewAvailable = previewStatus?.available ?? false;
  const hasSubmission = submission !== null;

  const toPreviewErrorStatus = (error: Error): SubmissionPreviewStatus => ({
    available: false,
    stale: false,
    preview_url: null,
    workspace_head_oid: null,
    preview_head_oid: null,
    error: error.message,
  });

  const loadPreviewStatus = async (silent = false) => {
    if (!silent) {
      setPreviewLoading(true);
    }
    try {
      const status = await api.getSubmissionPreviewStatus(submissionId);
      setPreviewStatus(status);
    } catch (error) {
      if (!silent) {
        setPreviewStatus(toPreviewErrorStatus(error as Error));
      }
    } finally {
      if (!silent) {
        setPreviewLoading(false);
      }
    }
  };

  const refreshPreview = async () => {
    setPreviewLoading(true);
    try {
      const status = await api.refreshSubmissionPreview(submissionId);
      setPreviewStatus(status);
      if (status.available) {
        setPreviewFrameVersion((current) => current + 1);
      }
    } catch (error) {
      setPreviewStatus(toPreviewErrorStatus(error as Error));
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    setPreviewStatus(null);
    setPreviewLoading(true);
    setPreviewFrameVersion(0);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (sseReconnectRef.current) {
      window.clearTimeout(sseReconnectRef.current);
      sseReconnectRef.current = null;
    }
  }, [submissionId]);

  useEffect(() => {
    setLoadError(null);
    setLoadErrorStatus(null);
    Promise.all([api.getSubmission(submissionId), api.getSubmissionLogs(submissionId)])
      .then(([detail, latestLogs]) => {
        setSubmission(detail);
        setLogs(latestLogs);
      })
      .catch((error: Error) => {
        setSubmission(null);
        setLogs(null);
        setLoadError(error.message);
        setLoadErrorStatus(error instanceof ApiError ? error.status : null);
      })
      .finally(() => setLoading(false));

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (sseReconnectRef.current) {
        window.clearTimeout(sseReconnectRef.current);
        sseReconnectRef.current = null;
      }
    };
  }, [submissionId]);

  useEffect(() => {
    if (!submissionId || !user) {
      return;
    }

    const refreshSubmissionDetail = async () => {
      const latest = await api.getSubmission(submissionId);
      setSubmission(latest);
      return latest;
    };

    const refreshSubmissionLogs = async () => {
      const latestLogs = await api.getSubmissionLogs(submissionId);
      setLogs(latestLogs);
      return latestLogs;
    };

    const handleSseEvent = (event: SubmissionSseEvent) => {
      if (event.refresh.submission) {
        void refreshSubmissionDetail().catch(() => undefined);
      }
      if (event.refresh.logs) {
        void refreshSubmissionLogs().catch(() => undefined);
      }
      if (event.refresh.preview) {
        void loadPreviewStatus(true);
      }
    };

    const connect = () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = api.connectSubmissionEvents(submissionId, {
        onEvent: handleSseEvent,
        onError: () => {
          eventSourceRef.current?.close();
          eventSourceRef.current = null;
          if (sseReconnectRef.current) {
            window.clearTimeout(sseReconnectRef.current);
          }
          sseReconnectRef.current = window.setTimeout(() => {
            connect();
          }, 2000);
        },
      });
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (sseReconnectRef.current) {
        window.clearTimeout(sseReconnectRef.current);
        sseReconnectRef.current = null;
      }
    };
  }, [submissionId, user]);

  useEffect(() => {
    if (!submission) {
      setPreviewStatus(null);
      setPreviewLoading(false);
      return;
    }
    void loadPreviewStatus(previewStatus !== null);
  }, [submissionId, hasSubmission]);

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
    <div className="page submission-page bg-[var(--bg-deep)] px-6 py-7 text-[var(--text)] lg:px-8">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-5 border-b border-[var(--border)] p-5 lg:flex-row lg:items-start lg:justify-between lg:p-6">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Submission</div>
              <h1 className="mt-2 truncate text-2xl font-semibold leading-tight tracking-normal text-[var(--text)]">
                {submission.display_name || submission.id}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                {submission.requirement_id} / {submission.runtime} / {submission.status}
              </p>
              {submission.model_name ? (
                <div className="mt-3">
                  <span className="model-chip">{submission.model_name}</span>
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3 lg:flex-col lg:items-end">
              <div className="text-3xl font-semibold leading-none text-[var(--accent)]">{submission.score?.toFixed(1) ?? "--"}</div>
              <div className={`test-badge ${submission.status === "PASSED" ? "pass" : submission.status === "FAILED" ? "fail" : "pending"}`}>
                {submission.status}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-6">
            <div className="submission-meta-card rounded-none border-0 bg-transparent p-4">
              <div className="submission-meta-label">Submission ID</div>
              <div className="submission-meta-value">{submission.id}</div>
            </div>
            <div className="submission-meta-card rounded-none border-0 bg-transparent p-4">
              <div className="submission-meta-label">Model</div>
              <div className="submission-meta-value">{submission.model_name || "-"}</div>
            </div>
            <div className="submission-meta-card rounded-none border-0 bg-transparent p-4">
              <div className="submission-meta-label">Created</div>
              <div className="submission-meta-value">{formatDateTime(submission.created_at)}</div>
            </div>
            <div className="submission-meta-card rounded-none border-0 bg-transparent p-4">
              <div className="submission-meta-label">Started</div>
              <div className="submission-meta-value">{formatDateTime(submission.started_at)}</div>
            </div>
            <div className="submission-meta-card rounded-none border-0 bg-transparent p-4">
              <div className="submission-meta-label">Duration</div>
              <div className="submission-meta-value">{formatDuration(submission.started_at, submission.finished_at)}</div>
            </div>
            <div className="submission-meta-card rounded-none border-0 bg-transparent p-4">
              <div className="submission-meta-label">Results</div>
              <div className="submission-meta-value">{resultSummary(submission)}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="action-section rounded-lg border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <div className="action-section-title">Run Status</div>
          <SubmissionStepList
            steps={submission.steps}
            submissionStatus={submission.status}
            failureReason={submission.failure_reason}
          />
        </section>

        <section className="action-section rounded-lg border border-[var(--border)] bg-[var(--bg)] p-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <div className="px-5 pt-5">
          <div className="action-section-title">Execution Detail</div>
          <div className="doc-tabs detail-tabs rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
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

        <section className="action-section rounded-lg border border-[var(--border)] bg-[var(--bg)] p-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)] xl:col-start-2">
          <div className="action-section-header border-b border-[var(--border)] px-5 py-4">
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
                Refresh
              </button>
              <a className="inline-link" href={previewUrl} target="_blank" rel="noreferrer">
                Open
              </a>
            </div>
          </div>
          <div className="detail-tab-panel">
            {previewStatus?.stale ? (
              <div className="submission-alert-wrap">
                <div className="submission-alert">
                  Preview is out of date. Refresh to rebuild from current workspace.
                </div>
              </div>
            ) : null}
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
                  {previewStatus?.error
                    ? previewStatus.error
                    : ["PENDING", "RUNNING"].includes(submission.status)
                      ? "Preview has not been built yet. Refresh after the workspace is ready."
                      : "Preview is not available for the current workspace."}
                </div>
              </div>
            )}
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}

