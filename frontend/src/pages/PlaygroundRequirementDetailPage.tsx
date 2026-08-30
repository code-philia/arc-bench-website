import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import MarkdownTocDocument from "../components/requirements/MarkdownTocDocument";
import AgentTemplateDialog from "../components/requirements/AgentTemplateDialog";
import TestSuiteViewer from "../components/requirements/TestSuiteViewer";
import { api } from "../lib/api";
import { DEFAULT_MODEL_NAME, MODEL_OPTIONS } from "../lib/models";
import { parseTaskTreeYaml } from "../lib/taskTree";
import type { RequirementDetail, RequirementTestFile, SubmissionDetail, SubmissionSummary } from "../lib/types";
import { useQuickStart } from "../quickstart/QuickStartContext";

function submissionBadgeClass(status: string) {
  if (status === "PASSED") return "pass";
  if (status === "FAILED") return "fail";
  return "pending";
}

function normalizeTaskType(value: string) {
  if (value === "web" || value === "mobile" || value === "kernel" || value === "mixed" || value === "cli") {
    return value;
  }
  return "web";
}

function taskTypeLabel(value: string) {
  if (value === "web") return "Web Applications";
  if (value === "mobile") return "Mobile Applications";
  if (value === "kernel") return "Kernel Operators";
  if (value === "cli") return "CLI Tasks";
  return "Mixed Tasks";
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

export default function PlaygroundRequirementDetailPage() {
  const { taskType: rawTaskType = "web", requirementId = "12306" } = useParams();
  const taskType = normalizeTaskType(rawTaskType);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCompetitionRoute = location.pathname.startsWith("/requirements/");
  const isBenchmarkRoute = location.pathname.startsWith("/playground/arc-bench/");
  const catalog: "playground" | "competition" | "benchmark" = isCompetitionRoute
    ? "competition"
    : isBenchmarkRoute
      ? "benchmark"
      : "playground";
  const [requirement, setRequirement] = useState<RequirementDetail | null>(null);
  const [testFiles, setTestFiles] = useState<RequirementTestFile[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [activeDoc, setActiveDoc] = useState<"readme" | "tests">("readme");
  const [runtime, setRuntime] = useState("python");
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [modelName, setModelName] = useState<string>(DEFAULT_MODEL_NAME);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<SubmissionDetail | null>(null);
  const [submissionTab, setSubmissionTab] = useState<"submit" | "history">("submit");
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [runSelectionMode, setRunSelectionMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<number | null>(null);
  const quickStart = useQuickStart();
  const { active, prefill } = quickStart;
  const currentMarkdown = useMemo(() => {
    if (!requirement) {
      return "";
    }
    return requirement.requirements_markdown;
  }, [activeDoc, requirement]);
  const tocTree = useMemo(() => {
    if (activeDoc !== "readme" || !requirement?.requirements_yaml?.trim()) {
      return null;
    }
    try {
      return parseTaskTreeYaml(requirement.requirements_yaml);
    } catch {
      return null;
    }
  }, [activeDoc, requirement?.requirements_yaml]);

  const refreshSubmissions = async () => {
    if (!user) {
      setSubmissions([]);
      return;
    }
    setSubmissions(await api.listRuns(requirementId));
  };

  useEffect(() => {
    quickStart.syncStepForRoute();
  }, [quickStart, requirementId, taskType]);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getRequirement(requirementId, catalog), api.getRequirementTests(requirementId, catalog)])
      .then(([detail, tests]) => {
        setRequirement(detail);
        setTestFiles(tests.files);
        if (!user) {
          setSubmissions([]);
          return;
        }
        return refreshSubmissions().catch(() => setSubmissions([]));
      })
      .catch((error: Error) => {
        message.error(error.message);
        setRequirement(null);
        setTestFiles([]);
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
    if (!requirement) {
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
      setSubmitting(true);
      setUploadError(null);
      if (!file) {
        const errorMessage = "Agent package is required.";
        setUploadError(errorMessage);
        message.error(errorMessage);
        return;
      }
      const created = await api.createSubmission({
        requirementId: requirement.id,
        runtime,
        file,
        agentSource: "upload",
        displayName: normalizedDisplayName,
        modelName: normalizedModelName,
        catalog,
      });
      const createdRun = await api.createRun(created.submission.id, requirement.id);
      const started = await api.startSubmission(createdRun.run.id);
      setActiveSubmission(started);
      setSubmissions((current) => [started, ...current.filter((item) => item.id !== started.id)]);
      setSubmissionTab("history");
      beginPolling(createdRun.run.id);
      setDisplayName("");
      setModelName(DEFAULT_MODEL_NAME);
      if (!active) {
        setFile(null);
      }
      message.success("Submission created and queued.");
    } catch (error) {
      const errorMessage = (error as Error).message;
      setUploadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSelectedRuns = async () => {
    if (selectedRunIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedRunIds.length} selected run${selectedRunIds.length === 1 ? "" : "s"}? Their runtime directories will be permanently removed.`)) return;
    try {
      const result = await api.deleteRuns(selectedRunIds);
      if (activeSubmission && result.deleted_ids.includes(activeSubmission.id)) setActiveSubmission(null);
      const skippedIds = result.skipped.map((item) => item.id);
      setSelectedRunIds(skippedIds);
      setRunSelectionMode(skippedIds.length > 0);
      await refreshSubmissions();
      if (result.deleted_ids.length > 0) {
        message.success(`${result.deleted_ids.length} selected run${result.deleted_ids.length === 1 ? "" : "s"} deleted.`);
      }
      if (result.skipped.length > 0) {
        message.warning(`${result.skipped.length} run${result.skipped.length === 1 ? "" : "s"} could not be deleted and remain selected.`);
      }
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const toggleRunSelection = (runId: string) => {
    setSelectedRunIds((current) => current.includes(runId) ? current.filter((id) => id !== runId) : [...current, runId]);
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
              className={`doc-tab${activeDoc === "tests" ? " active" : ""}`}
              onClick={() => {
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
                setActiveDoc("tests");
              }}
            >
              tests
            </button>
          </div>
          {activeDoc === "readme" ? <MarkdownTocDocument
              markdown={currentMarkdown}
              assetsBaseUrl={requirement.assets_base_url}
              referencesBaseUrl={requirement.references_base_url}
              tocTree={tocTree}
              bodyClassName="playground-readme-body"
              tocClassName="playground-readme-toc"
              scrollClassName="quickstart-document-anchor playground-readme-scroll"
              tocDataQuickstartId="quickstart-contents"
              scrollDataQuickstartId="quickstart-document"
            /> : <div className="playground-readme-scroll test-suite-scroll"><TestSuiteViewer files={testFiles} /></div>}
        </section>

        <aside className="action-panel action-panel-locked">
          <div className={`action-section action-section-locked${submissionTab === "history" ? " action-section--history" : ""}`}>
            <div className="detail-tabs submission-tabs-shell">
              <div className="tabs submission-tabs">
                <button
                  type="button"
                  className={`tab${submissionTab === "submit" ? " active" : ""}`}
                  onClick={() => { setSubmissionTab("submit"); setRunSelectionMode(false); setSelectedRunIds([]); }}
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
                  <AgentTemplateDialog href={`/api/requirements/${requirement.id}/starter-agent?catalog=${catalog}`} runtime={runtime} />
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
                    <label className="field-label" htmlFor="playground-submission-name">
                      Submission Name
                    </label>
                    <input
                      id="playground-submission-name"
                      className="text-input"
                      type="text"
                      maxLength={120}
                      placeholder="NewSubmission"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                    />
                  </div>
                  <div className="submission-name-field">
                    <label className="field-label" htmlFor="playground-submission-model">
                      Model
                    </label>
                    <select
                      id="playground-submission-model"
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
                    data-quickstart-id="quickstart-submit"
                    onClick={handleUpload}
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
              <div className="submission-history-area">
                <div className="submission-history-toolbar">
                  {runSelectionMode ? <>
                    <label><input type="checkbox" checked={submissions.length > 0 && selectedRunIds.length === submissions.length} onChange={(event) => setSelectedRunIds(event.target.checked ? submissions.map((record) => record.id) : [])} /> Select all</label>
                    <div className="history-selection-actions"><button type="button" className="history-select-button" onClick={() => { setRunSelectionMode(false); setSelectedRunIds([]); }}>Cancel</button><button type="button" className="history-bulk-delete" disabled={selectedRunIds.length === 0} onClick={() => void deleteSelectedRuns()}><DeleteOutlined /> Delete selected{selectedRunIds.length ? ` (${selectedRunIds.length})` : ""}</button></div>
                  </> : <button type="button" className="history-select-button" onClick={() => setRunSelectionMode(true)}>Select</button>}
                </div>
                <div className="submission-history-table-wrap">
              <table className="task-table compact">
                <thead>
                  <tr>
                    {runSelectionMode ? <th style={{ width: "36px" }} aria-label="Select" /> : null}
                    <th>Submission</th>
                    <th style={{ width: "140px" }}>Model</th>
                    <th style={{ width: "100px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((record) => (
                    <tr
                      key={record.id}
                      onClick={() => navigate(
                        catalog === "benchmark"
                          ? `/playground/arc-bench/${taskType}/${requirement.id}/submissions/${record.id}`
                          : `/playground/task-bank/${taskType}/${requirement.id}/submissions/${record.id}`,
                      )}
                    >
                      {runSelectionMode ? <td onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedRunIds.includes(record.id)} onChange={() => toggleRunSelection(record.id)} aria-label={`Select ${record.display_name || record.id}`} /></td> : null}
                      <td>
                        <Link
                          className="inline-link"
                          to={
                            catalog === "benchmark"
                              ? `/playground/arc-bench/${taskType}/${requirement.id}/submissions/${record.id}`
                              : `/playground/task-bank/${taskType}/${requirement.id}/submissions/${record.id}`
                          }
                        >
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
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
