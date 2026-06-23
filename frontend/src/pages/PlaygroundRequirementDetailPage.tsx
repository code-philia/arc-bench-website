import { message } from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import MarkdownTocDocument from "../components/requirements/MarkdownTocDocument";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { api } from "../lib/api";
import type { RequirementDetail, SubmissionDetail, SubmissionSummary } from "../lib/types";
import { useQuickStart } from "../quickstart/QuickStartContext";

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

function normalizeTaskType(value: string) {
  if (value === "web" || value === "mobile" || value === "kernel" || value === "mixed") {
    return value;
  }
  return "web";
}

function taskTypeLabel(value: string) {
  if (value === "web") return "Web Applications";
  if (value === "mobile") return "Mobile Applications";
  if (value === "kernel") return "Kernel Operators";
  return "Mixed Tasks";
}

export default function PlaygroundRequirementDetailPage() {
  const { taskType: rawTaskType = "web", requirementId = "12306" } = useParams();
  const taskType = normalizeTaskType(rawTaskType);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const catalog = location.pathname.startsWith("/requirements/") ? "competition" : "playground";
  const [requirement, setRequirement] = useState<RequirementDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [activeDoc, setActiveDoc] = useState("readme");
  const [runtime, setRuntime] = useState("python");
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [modelName, setModelName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<SubmissionDetail | null>(null);
  const [submissionTab, setSubmissionTab] = useState<"submit" | "history">("submit");
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<number | null>(null);
  const quickStart = useQuickStart();
  const { active, prefill } = quickStart;
  const currentMarkdown = useMemo(() => {
    if (!requirement) {
      return "";
    }
    return activeDoc === "readme" ? requirement.requirements_markdown : requirement.prerequisites_markdown;
  }, [activeDoc, requirement]);

  useEffect(() => {
    quickStart.syncStepForRoute();
  }, [quickStart, requirementId, taskType]);

  useEffect(() => {
    setLoading(true);
    api
      .getRequirement(requirementId, catalog)
      .then((detail) => {
        setRequirement(detail);
        if (!user) {
          setSubmissions([]);
          return;
        }
        return api.listSubmissions(requirementId).then(setSubmissions).catch(() => setSubmissions([]));
      })
      .catch((error: Error) => {
        message.error(error.message);
        setRequirement(null);
      })
      .finally(() => setLoading(false));
  }, [catalog, requirementId, user]);

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

  useEffect(() => {
    if (!active) {
      return;
    }
    setRuntime(prefill.runtime);
    setDisplayName(prefill.displayName);
    setModelName(prefill.modelName);
    if (prefill.file) {
      setFile(prefill.file);
    }
  }, [active, prefill.displayName, prefill.file, prefill.modelName, prefill.runtime]);

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
    if (!requirement || !file) {
      return;
    }
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
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
    try {
      setUploadError(null);
      const created = await api.createSubmission(requirement.id, runtime, file, normalizedDisplayName, normalizedModelName, catalog);
      setSubmissions((current) => [created.submission, ...current]);
      const started = await api.startSubmission(created.submission.id);
      setActiveSubmission(started);
      setSubmissionTab("submit");
      beginPolling(created.submission.id);
      setDisplayName("");
      setModelName("");
      message.success("Submission created and queued.");
    } catch (error) {
      const errorMessage = (error as Error).message;
      setUploadError(errorMessage);
      message.error(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="page centered">
        <div className="loading-state">Loading requirement...</div>
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className="page centered">
        <div className="empty-state">Requirement not available.</div>
      </div>
    );
  }

  return (
    <div className="page detail-page detail-page-locked">
      <div className="detail-layout detail-layout-locked">
        <section className="readme-panel">
          <div className="readme-header">
            <div className="breadcrumb">
              {catalog === "competition" ? (
                <>
                  <span>Competition</span>
                  <span className="sep">/</span>
                  <Link to="/requirements">Task Bank</Link>
                  <span className="sep">/</span>
                  <span className="current">{requirement.display_id} - {requirement.title}</span>
                </>
              ) : (
                <>
                  <span>Playground</span>
                  <span className="sep">/</span>
                  <span>Task Bank</span>
                  <span className="sep">/</span>
                  <Link to={`/playground/task-bank/${taskType}`}>{taskTypeLabel(taskType)}</Link>
                  <span className="sep">/</span>
                  <span className="current">{requirement.display_id} - {requirement.title}</span>
                </>
              )}
            </div>
          </div>
          <div className="doc-tabs">
            <button
              type="button"
              className={`doc-tab${activeDoc === "readme" ? " active" : ""}`}
              onClick={() => {
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
                setActiveDoc("readme");
              }}
            >
              README.md
            </button>
            <button
              type="button"
              className={`doc-tab${activeDoc === "prerequisites" ? " active" : ""}`}
              onClick={() => {
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
                setActiveDoc("prerequisites");
              }}
            >
              prerequisites.md
            </button>
          </div>
          <MarkdownTocDocument
            markdown={currentMarkdown}
            assetsBaseUrl={requirement.assets_base_url}
            referencesBaseUrl={requirement.references_base_url}
            bodyClassName="playground-readme-body"
            tocClassName="playground-readme-toc"
            scrollClassName="quickstart-document-anchor playground-readme-scroll"
            tocDataQuickstartId="quickstart-contents"
            scrollDataQuickstartId="quickstart-document"
          />
        </section>

        <aside className="action-panel action-panel-locked">
          <div className="action-section action-section-locked">
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
                  <div className="env-selector">
                    {[
                      { label: "Python", value: "python" },
                      { label: "Node.js", value: "nodejs", disabled: true },
                      { label: "Go", value: "go", disabled: true },
                      { label: "Java", value: "java", disabled: true },
                      { label: "Docker", value: "docker", disabled: true },
                    ].map((option) => (
                      <button
                        key={option.value}
                        className={`env-option${runtime === option.value ? " active" : ""}`}
                        type="button"
                        disabled={option.disabled}
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
                    <div className="upload-hint">Python only | root main.py + requirements.txt | entrypoint: python main.py -r &lt;requirements.md&gt;</div>
                  </label>
                  {!user ? (
                    <div className="inline-alert">Login is required before uploading an agent or viewing your submission history.</div>
                  ) : null}
                  <div className="submission-name-field">
                    <label className="field-label" htmlFor="playground-submission-name">
                      Submission Name
                    </label>
                    <input
                      id="playground-submission-name"
                      className="text-input"
                      type="text"
                      maxLength={120}
                      placeholder="MyAgent_v1"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                    />
                  </div>
                  <div className="submission-name-field">
                    <label className="field-label" htmlFor="playground-submission-model">
                      Model Name
                    </label>
                    <input
                      id="playground-submission-model"
                      className="text-input"
                      type="text"
                      maxLength={120}
                      placeholder="Claude Sonnet 4"
                      value={modelName}
                      onChange={(event) => setModelName(event.target.value)}
                    />
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
                    disabled={!file || !user}
                    data-quickstart-id="quickstart-submit"
                    onClick={handleUpload}
                  >
                    Submit
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
                      onClick={() => navigate(`/playground/task-bank/${taskType}/${requirement.id}/submissions/${record.id}`)}
                    >
                      <td>
                        <Link className="inline-link" to={`/playground/task-bank/${taskType}/${requirement.id}/submissions/${record.id}`}>
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
