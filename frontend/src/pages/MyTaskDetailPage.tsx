import { DeleteOutlined, DownloadOutlined, EditOutlined, UploadOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import MarkdownTocDocument from "../components/requirements/MarkdownTocDocument";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { api } from "../lib/api";
import { parseTaskTreeYaml } from "../lib/taskTree";
import type { SubmissionDetail, SubmissionSummary, UserTaskDetail } from "../lib/types";

function submissionBadgeClass(status: string) {
  if (status === "PASSED") return "pass";
  if (status === "FAILED") return "fail";
  return "pending";
}

function resultSummary(submission: SubmissionDetail) {
  const total = submission.passed_count + submission.failed_count;
  if (total === 0) {
    return "No test results yet";
  }
  return `${submission.passed_count}/${total} passed`;
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function MyTaskDetailPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<UserTaskDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [activeSubmission, setActiveSubmission] = useState<SubmissionDetail | null>(null);
  const [submissionTab, setSubmissionTab] = useState<"submit" | "history">("submit");
  const [runtime, setRuntime] = useState("python");
  const [agentSource, setAgentSource] = useState<"upload" | "builtin_arc_agent" | "builtin_octos_agent">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [modelName, setModelName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingBundle, setDownloadingBundle] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getMyTask(taskId)
      .then((detail) => {
        setTask(detail);
        if (!user) {
          setSubmissions([]);
          return;
        }
        return api.listSubmissions(taskId).then(setSubmissions).catch(() => setSubmissions([]));
      })
      .catch(() => {
        setTask(null);
        setSubmissions([]);
      })
      .finally(() => setLoading(false));
  }, [taskId, user]);

  useEffect(() => {
    if (!user) {
      setActiveSubmission(null);
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  const bundleLabel = useMemo(() => {
    if (downloadingBundle) {
      return "Preparing Bundle...";
    }
    return "Download Requirement";
  }, [downloadingBundle]);
  const tocTree = useMemo(() => {
    if (!task?.yaml_content.trim()) {
      return null;
    }
    try {
      return parseTaskTreeYaml(task.yaml_content);
    } catch {
      return null;
    }
  }, [task?.yaml_content]);

  const beginPolling = (submissionId: string) => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
    }
    pollRef.current = window.setInterval(() => {
      api
        .getSubmission(submissionId)
        .then((submission) => {
          setActiveSubmission(submission);
          setSubmissions((current) => {
            const next = current.filter((item) => item.id !== submission.id);
            return [submission, ...next];
          });
          if (!["PENDING", "RUNNING"].includes(submission.status) && pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
        })
        .catch(() => undefined);
    }, 2000);
  };

  const handleUpload = async () => {
    if (!task) {
      return;
    }
    if (!user) {
      navigate("/login", { state: { from: `/playground/my-tasks/${task.id}` } });
      return;
    }
    const normalizedDisplayName = displayName.trim();
    const normalizedModelName = modelName.trim();
    if (!normalizedDisplayName) {
      const errorMessage = "Submission name is required.";
      setUploadError(errorMessage);
      message.error(errorMessage);
      return;
    }
    if (!normalizedModelName) {
      const errorMessage = "Model name is required.";
      setUploadError(errorMessage);
      message.error(errorMessage);
      return;
    }
    if (agentSource === "upload" && !file) {
      const errorMessage = "Agent package is required.";
      setUploadError(errorMessage);
      message.error(errorMessage);
      return;
    }

    try {
      setSubmitting(true);
      setUploadError(null);
      const created = await api.createSubmission({
        requirementId: task.id,
        runtime,
        file: agentSource === "upload" ? file : null,
        agentSource,
        taskType: task.task_type,
        displayName: normalizedDisplayName,
        modelName: normalizedModelName,
        catalog: "my_tasks",
      });
      setSubmissions((current) => [created.submission, ...current]);
      const started = await api.startSubmission(created.submission.id);
      setActiveSubmission(started);
      setSubmissionTab("submit");
      beginPolling(created.submission.id);
      setDisplayName("");
      setModelName("");
      setFile(null);
      message.success("Submission created and queued.");
    } catch (error) {
      const errorMessage = (error as Error).message;
      setUploadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadBundle = async () => {
    if (!task) {
      return;
    }
    try {
      setDownloadingBundle(true);
      const bundle = await api.downloadMyTaskBundle(task.id);
      downloadFile(bundle);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setDownloadingBundle(false);
    }
  };

  if (loading) {
    return (
      <div className="page centered">
        <div className="loading-state">Loading task...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="page centered">
        <div className="empty-state">Task not found.</div>
      </div>
    );
  }

  return (
    <div className="page detail-page detail-page-locked">
      <div className="detail-layout detail-layout-locked">
        <section className="readme-panel">
          <div className="readme-header">
            <div className="breadcrumb">
              <span>Playground</span>
              <span className="sep">/</span>
              <Link to="/playground/my-tasks">My Tasks</Link>
              <span className="sep">/</span>
              <span className="current">{task.title}</span>
            </div>
          </div>
          <MarkdownTocDocument
            markdown={task.markdown_content}
            assetsBaseUrl=""
            referencesBaseUrl={`/api/my-tasks/${task.id}/reference/`}
            tocTree={tocTree}
            bodyClassName="playground-readme-body"
            tocClassName="playground-readme-toc"
            scrollClassName="playground-readme-scroll"
            tocTitle="Contents"
          />
        </section>

        <aside className="action-panel action-panel-locked">
          <div className="action-section action-section-locked">
            <div className="submission-subsection">
              <div className="submission-subsection-title">Task Overview</div>
              <div className="submission-result-grid">
                <div className="submission-result-stat">
                  <span className="submission-result-label">Type</span>
                  <strong>{task.task_type}</strong>
                </div>
                <div className="submission-result-stat">
                  <span className="submission-result-label">Nodes</span>
                  <strong>{task.node_count}</strong>
                </div>
                <div className="submission-result-stat">
                  <span className="submission-result-label">Atomic</span>
                  <strong>{task.atomic_count}</strong>
                </div>
              </div>
            </div>

            <div className="submission-subsection">
              <div className="submission-subsection-title">Task Actions</div>
              <Link className="btn-outline create-task-side-link" to={`/playground/my-tasks/${task.id}/edit`}>
                <EditOutlined /> Edit Requirement
              </Link>
              <button type="button" className="btn-outline create-task-side-link" onClick={() => void handleDownloadBundle()}>
                <DownloadOutlined /> {bundleLabel}
              </button>
            </div>

            <div className="detail-tabs submission-tabs-shell">
              <div className="tabs submission-tabs">
                <button
                  type="button"
                  className={`tab${submissionTab === "submit" ? " active" : ""}`}
                  onClick={() => setSubmissionTab("submit")}
                >
                  Submit
                </button>
                <button
                  type="button"
                  className={`tab${submissionTab === "history" ? " active" : ""}`}
                  onClick={() => setSubmissionTab("history")}
                >
                  History
                </button>
              </div>
            </div>

            {submissionTab === "submit" ? (
              <>
                <div className="submission-subsection">
                  <div className="submission-subsection-title">Upload Agent</div>
                  <div className="agent-source-selector">
                    <button
                      type="button"
                      className={`agent-source-card${agentSource === "upload" ? " active" : ""}`}
                      onClick={() => {
                        setAgentSource("upload");
                        setUploadError(null);
                      }}
                    >
                      <span className="agent-source-title">Upload .zip</span>
                      <span className="agent-source-copy">Use your own agent package.</span>
                    </button>
                    <button
                      type="button"
                      className={`agent-source-card${agentSource !== "upload" ? " active" : ""}`}
                      onClick={() => {
                        setAgentSource("builtin_arc_agent");
                        setUploadError(null);
                      }}
                    >
                      <span className="agent-source-title">Built-in Agent</span>
                      <span className="agent-source-copy">Use an integrated ARC or Octos runner.</span>
                    </button>
                  </div>
                  {agentSource !== "upload" ? (
                    <div className="builtin-agent-selector" role="group" aria-label="Built-in agent type">
                      <button
                        type="button"
                        className={`builtin-agent-option${agentSource === "builtin_arc_agent" ? " active" : ""}`}
                        onClick={() => {
                          setAgentSource("builtin_arc_agent");
                          setUploadError(null);
                        }}
                      >
                        <span>ARC Agent</span>
                        <small>Agentic Requirement Compiler</small>
                      </button>
                      <button
                        type="button"
                        className={`builtin-agent-option${agentSource === "builtin_octos_agent" ? " active" : ""}`}
                        onClick={() => {
                          setAgentSource("builtin_octos_agent");
                          setUploadError(null);
                        }}
                      >
                        <span>Octos Agent</span>
                        <small>Your Own AI Assistant</small>
                      </button>
                    </div>
                  ) : null}
                  {agentSource === "upload" ? (
                    <a
                      className="btn-outline competition-download-btn submission-download-btn"
                      href={`/api/my-tasks/${task.id}/starter-agent`}
                    >
                      <DownloadOutlined /> Download Agent Template
                    </a>
                  ) : null}
                  <div className="env-selector">
                    <button className={`env-option${runtime === "python" ? " active" : ""}`} type="button" onClick={() => setRuntime("python")}>
                      Python
                    </button>
                    <button className="env-option" type="button" disabled>
                      Node.js
                    </button>
                    <button className="env-option" type="button" disabled>
                      Go
                    </button>
                  </div>
                  {agentSource === "upload" ? (
                    <label className="upload-zone">
                      <input
                        className="visually-hidden"
                        type="file"
                        accept=".zip"
                        onChange={(event) => {
                          setFile(event.target.files?.[0] ?? null);
                          setUploadError(null);
                        }}
                      />
                      <div className="upload-icon">
                        <UploadOutlined />
                      </div>
                      <div className="upload-text">Drop your agent code here</div>
                      <div className="upload-hint">Python only | root main.py + requirements.txt | SDK events should be written during execution</div>
                    </label>
                  ) : (
                    <div className="builtin-agent-panel">
                      <div className="file-icon">{agentSource === "builtin_octos_agent" ? "OCT" : "ARC"}</div>
                      <div className="file-info">
                        <div className="file-name">{agentSource === "builtin_octos_agent" ? "Octos Agent" : "ARC Agent"}</div>
                      </div>
                    </div>
                  )}
                  {!user ? (
                    <div className="inline-alert">Login is required before uploading an agent or viewing your submission history.</div>
                  ) : null}
                  <div className="submission-name-field">
                    <label className="field-label" htmlFor="my-task-submission-name">
                      Submission Name
                    </label>
                    <input
                      id="my-task-submission-name"
                      className="text-input"
                      type="text"
                      maxLength={120}
                      placeholder="NewSubmission"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                    />
                  </div>
                  <div className="submission-name-field">
                    <label className="field-label" htmlFor="my-task-submission-model">
                      Model Name
                    </label>
                    <input
                      id="my-task-submission-model"
                      className="text-input"
                      type="text"
                      maxLength={120}
                      placeholder="Claude Sonnet 4"
                      value={modelName}
                      onChange={(event) => setModelName(event.target.value)}
                    />
                  </div>
                  {agentSource === "upload" && file ? (
                    <div className="uploaded-file">
                      <div className="file-icon">.zip</div>
                      <div className="file-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button className="file-remove" type="button" onClick={() => setFile(null)}>
                        <DeleteOutlined />
                      </button>
                    </div>
                  ) : null}
                  {uploadError ? <div className="inline-alert error">{uploadError}</div> : null}
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={(agentSource === "upload" && !file) || !user || submitting}
                    onClick={() => void handleUpload()}
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </div>

                <div className="submission-subsection">
                  <div className="submission-subsection-title">Progress</div>
                  {activeSubmission ? (
                    <div className="submission-summary-card">
                      <div className="submission-summary-top">
                        <div>
                          <div className="submission-summary-name">{activeSubmission.display_name || activeSubmission.id}</div>
                          <div className="submission-summary-meta">
                            {activeSubmission.model_name ? <span className="model-chip">{activeSubmission.model_name}</span> : null}
                          </div>
                        </div>
                        <span className={`test-badge ${submissionBadgeClass(activeSubmission.status)}`}>
                          {activeSubmission.status}
                        </span>
                      </div>
                      <SubmissionStepList
                        steps={activeSubmission.steps}
                        submissionStatus={activeSubmission.status}
                        failureReason={activeSubmission.failure_reason}
                      />
                    </div>
                  ) : (
                    <div className="empty-state compact">No active submission.</div>
                  )}
                </div>

                <div className="submission-subsection">
                  <div className="submission-subsection-title">Test Results</div>
                  {activeSubmission ? (
                    <div className="submission-result-summary">
                      {activeSubmission.failure_reason ? (
                        <div className="inline-alert error">{activeSubmission.failure_reason}</div>
                      ) : null}
                      <div className="submission-result-grid">
                        <div className="submission-result-stat">
                          <span className="submission-result-label">Score</span>
                          <strong>{activeSubmission.score == null ? "--" : activeSubmission.score.toFixed(1)}</strong>
                        </div>
                        <div className="submission-result-stat">
                          <span className="submission-result-label">Summary</span>
                          <strong>{resultSummary(activeSubmission)}</strong>
                        </div>
                        <div className="submission-result-stat">
                          <span className="submission-result-label">Tests</span>
                          <strong>{activeSubmission.passed_count + activeSubmission.failed_count}</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state compact">Run a submission to see results.</div>
                  )}
                </div>
              </>
            ) : !user ? (
              <div className="empty-state compact">Login to view your submission history.</div>
            ) : submissions.length === 0 ? (
              <div className="empty-state compact">No submissions yet.</div>
            ) : (
              <table className="task-table compact">
                <thead>
                  <tr>
                    <th>Submission</th>
                    <th style={{ width: "140px" }}>Model</th>
                    <th style={{ width: "100px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.slice(0, 5).map((record) => (
                    <tr
                      key={record.id}
                      onClick={() => navigate(`/playground/my-tasks/${task.id}/submissions/${record.id}`)}
                    >
                      <td>
                        <Link className="inline-link" to={`/playground/my-tasks/${task.id}/submissions/${record.id}`}>
                          {record.display_name || record.id}
                        </Link>
                        {record.display_name ? <div className="table-sub mono-sub">{record.id}</div> : null}
                      </td>
                      <td>
                        {record.model_name ? <span className="model-chip">{record.model_name}</span> : "-"}
                      </td>
                      <td>
                        <span className={`test-badge ${submissionBadgeClass(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
