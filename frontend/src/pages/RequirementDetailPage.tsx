import {
  message,
} from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import MarkdownDocument, { extractHeadings } from "../components/requirements/MarkdownDocument";
import SubmissionResultCard from "../components/submissions/SubmissionResultCard";
import SubmissionStepList from "../components/submissions/SubmissionStepList";
import { api } from "../lib/api";
import type { RequirementDetail, SubmissionDetail, SubmissionSummary } from "../lib/types";

function submissionBadgeClass(status: string) {
  if (status === "PASSED") return "pass";
  if (status === "FAILED") return "fail";
  return "pending";
}

export default function RequirementDetailPage() {
  const { requirementId = "12306" } = useParams();
  const [requirement, setRequirement] = useState<RequirementDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [activeDoc, setActiveDoc] = useState("readme");
  const [runtime, setRuntime] = useState("python");
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getRequirement(requirementId), api.listSubmissions(requirementId)])
      .then(([detail, history]) => {
        setRequirement(detail);
        setSubmissions(history);
      })
      .catch((error: Error) => {
        message.error(error.message);
        setRequirement(null);
      })
      .finally(() => setLoading(false));
  }, [requirementId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

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
    try {
      setUploadError(null);
      const created = await api.createSubmission(requirement.id, runtime, file, displayName);
      setSubmissions((current) => [created.submission, ...current]);
      const started = await api.startSubmission(created.submission.id);
      setActiveSubmission(started);
      beginPolling(created.submission.id);
      setDisplayName("");
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

  const currentMarkdown =
    activeDoc === "readme" ? requirement.requirements_markdown : requirement.prerequisites_markdown;
  const headings = extractHeadings(currentMarkdown);

  return (
    <div className="page detail-page">
      <div className="detail-layout">
        <section className="readme-panel">
          <div className="readme-header">
            <div className="breadcrumb">
              <span>Web Apps</span>
              <span className="sep">/</span>
              <span className="current">
                {requirement.id} — {requirement.title}
              </span>
            </div>
          </div>
          <div className="doc-tabs">
            <button
              type="button"
              className={`doc-tab${activeDoc === "readme" ? " active" : ""}`}
              onClick={() => setActiveDoc("readme")}
            >
              README.md
            </button>
            <button
              type="button"
              className={`doc-tab${activeDoc === "prerequisites" ? " active" : ""}`}
              onClick={() => setActiveDoc("prerequisites")}
            >
              prerequisites.md
            </button>
          </div>
          <div className="readme-body">
            <aside className="toc">
              <div className="toc-title">Contents</div>
              {headings.length === 0 ? (
                <div className="empty-state compact">No sections found.</div>
              ) : (
                headings.map((heading, index) => (
                  <a
                    key={heading.id}
                    className={`toc-item${index === 0 ? " active" : ""}${heading.level === 3 ? " sub" : ""}`}
                    href={`#${heading.id}`}
                  >
                    {heading.text}
                  </a>
                ))
              )}
            </aside>
            <MarkdownDocument
              markdown={currentMarkdown}
              assetsBaseUrl={requirement.assets_base_url}
              referencesBaseUrl={requirement.references_base_url}
            />
          </div>
        </section>

        <aside className="action-panel">
          <div className="action-section">
            <div className="action-section-title">Upload Agent</div>
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
            <div className="submission-name-field">
              <label className="field-label" htmlFor="submission-name">
                Submission Name
              </label>
              <input
                id="submission-name"
                className="text-input"
                type="text"
                maxLength={120}
                placeholder="MyAgent_v1"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
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
            <button className="btn-primary" type="button" disabled={!file} onClick={handleUpload}>
              Start Test
            </button>
          </div>

          <div className="action-section">
            <div className="action-section-title">Progress</div>
            {activeSubmission ? (
              <SubmissionStepList
                steps={activeSubmission.steps}
                submissionStatus={activeSubmission.status}
                failureReason={activeSubmission.failure_reason}
              />
            ) : (
              <div className="empty-state compact">No active submission.</div>
            )}
          </div>

          <div className="action-section">
            <div className="action-section-title">Test Results</div>
            {activeSubmission ? (
              <>
                {activeSubmission.failure_reason ? (
                  <div className="inline-alert error">{activeSubmission.failure_reason}</div>
                ) : null}
                <SubmissionResultCard submission={activeSubmission} />
              </>
            ) : (
              <div className="empty-state compact">Run a submission to see results.</div>
            )}
          </div>

          <div className="action-section">
            <div className="action-section-title">Submission History</div>
            {submissions.length === 0 ? (
              <div className="empty-state compact">No submissions yet.</div>
            ) : (
              <table className="task-table compact">
                <thead>
                  <tr>
                    <th>Submission</th>
                    <th style={{ width: "100px" }}>Status</th>
                    <th style={{ width: "80px" }}>Score</th>
                    <th style={{ width: "170px" }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.slice(0, 5).map((record) => (
                    <tr key={record.id}>
                      <td>
                        <Link className="inline-link" to={`/submissions/${record.id}`}>
                          {record.display_name || record.id}
                        </Link>
                        {record.display_name ? <div className="table-sub mono-sub">{record.id}</div> : null}
                      </td>
                      <td>
                        <span className={`test-badge ${submissionBadgeClass(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td>{record.score == null ? "-" : record.score.toFixed(1)}</td>
                      <td>{new Date(record.created_at).toLocaleString()}</td>
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
