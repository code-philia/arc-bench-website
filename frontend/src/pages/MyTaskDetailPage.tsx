import { DeleteOutlined, DownloadOutlined, EditOutlined, UploadOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import AgentTemplateDialog from "../components/requirements/AgentTemplateDialog";
import MarkdownTocDocument from "../components/requirements/MarkdownTocDocument";
import { api } from "../lib/api";
import { DEFAULT_MODEL_NAME, MODEL_OPTIONS } from "../lib/models";
import { parseTaskTreeYaml } from "../lib/taskTree";
import type { SubmissionSummary, UserTaskDetail } from "../lib/types";

function submissionBadgeClass(status: string) {
  if (status === "PASSED") return "pass";
  if (status === "FAILED") return "fail";
  return "pending";
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function agentRuntimeOptions() {
  return [
    { label: "Python", value: "python" },
    { label: "JavaScript", value: "javascript" },
    { label: "TypeScript", value: "typescript" },
  ];
}

function uploadHint(runtime: string) {
  if (runtime === "javascript") {
    return "Root index.js + package.json | SDK events should be written during execution";
  }
  if (runtime === "typescript") {
    return "Root index.ts + package.json | SDK events should be written during execution";
  }
  return "Root main.py + requirements.txt | optional package.json for Node dependencies";
}

export default function MyTaskDetailPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<UserTaskDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [submissionTab, setSubmissionTab] = useState<"submit" | "history">("submit");
  const [runtime, setRuntime] = useState("python");
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [modelName, setModelName] = useState<string>(DEFAULT_MODEL_NAME);
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
        return api.listRuns(taskId).then(setSubmissions).catch(() => setSubmissions([]));
      })
      .catch(() => {
        setTask(null);
        setSubmissions([]);
      })
      .finally(() => setLoading(false));
  }, [taskId, user]);

  useEffect(() => {
    if (!user) {
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
    if (!file) {
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
        file,
        agentSource: "upload",
        taskType: task.task_type,
        displayName: normalizedDisplayName,
        modelName: normalizedModelName,
        catalog: "my_tasks",
      });
      const createdRun = await api.createRun(created.submission.id, task.id);
      const started = await api.startSubmission(createdRun.run.id);
      setSubmissions((current) => [started, ...current.filter((item) => item.id !== started.id)]);
      setSubmissionTab("history");
      beginPolling(createdRun.run.id);
      setDisplayName("");
      setModelName(DEFAULT_MODEL_NAME);
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
                  <div className="submission-subsection-title">Agent Package</div>
                  <AgentTemplateDialog href={`/api/my-tasks/${task.id}/starter-agent`} runtime={runtime} />
                  <div className="env-selector">
                    {agentRuntimeOptions().map((option) => (
                      <button
                        key={option.value}
                        className={`env-option${runtime === option.value ? " active" : ""}`}
                        type="button"
                        onClick={() => setRuntime(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
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
                      <div className="upload-hint">{uploadHint(runtime)}</div>
                  </label>
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
                      Model
                    </label>
                    <select
                      id="my-task-submission-model"
                      className="text-input"
                      value={modelName}
                      onChange={(event) => setModelName(event.target.value)}
                    >
                      {MODEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  {file ? (
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
                    disabled={!file || !user || submitting}
                    onClick={() => void handleUpload()}
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
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
