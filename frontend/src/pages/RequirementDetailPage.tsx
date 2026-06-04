import {
  Alert,
  Button,
  Empty,
  List,
  Segmented,
  Spin,
  Table,
  Tabs,
  Tag,
  Upload,
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

export default function RequirementDetailPage() {
  const { requirementId = "12306" } = useParams();
  const [requirement, setRequirement] = useState<RequirementDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [activeDoc, setActiveDoc] = useState("readme");
  const [runtime, setRuntime] = useState("python");
  const [file, setFile] = useState<File | null>(null);
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
      const created = await api.createSubmission(requirement.id, runtime, file);
      setSubmissions((current) => [created.submission, ...current]);
      const started = await api.startSubmission(created.submission.id);
      setActiveSubmission(started);
      beginPolling(created.submission.id);
      message.success("Submission created and queued.");
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="page centered">
        <Spin size="large" />
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className="page centered">
        <Empty description="Requirement not available" />
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
              className={`doc-tab${activeDoc === "readme" ? " active" : ""}`}
              onClick={() => setActiveDoc("readme")}
            >
              README.md
            </button>
            <button
              className={`doc-tab${activeDoc === "prerequisites" ? " active" : ""}`}
              onClick={() => setActiveDoc("prerequisites")}
            >
              prerequisites.md
            </button>
          </div>
          <div className="readme-body">
            <aside className="toc">
              <div className="toc-title">Contents</div>
              <List
                dataSource={headings}
                renderItem={(heading) => (
                  <List.Item className={`toc-item level-${heading.level}`}>
                    <a href={`#${heading.id}`}>{heading.text}</a>
                  </List.Item>
                )}
              />
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
            <Segmented
              className="env-selector"
              value={runtime}
              onChange={(value) => setRuntime(String(value))}
              options={[
                { label: "Python", value: "python" },
                { label: "Node.js", value: "nodejs" },
                { label: "Go", value: "go", disabled: true },
                { label: "Java", value: "java", disabled: true },
                { label: "Docker", value: "docker", disabled: true },
              ]}
            />
            <Upload.Dragger
              accept=".zip"
              multiple={false}
              beforeUpload={(candidate) => {
                setFile(candidate);
                return false;
              }}
              showUploadList={false}
              className="upload-zone"
            >
              <p className="upload-icon">
                <UploadOutlined />
              </p>
              <p className="upload-text">Drop your agent code here</p>
              <p className="upload-hint">.zip only in v1</p>
            </Upload.Dragger>
            {file ? (
              <div className="uploaded-file">
                <div className="file-info">
                  <div className="file-name">{file.name}</div>
                  <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
                <Button type="text" icon={<DeleteOutlined />} onClick={() => setFile(null)} />
              </div>
            ) : null}
            <Button type="primary" block disabled={!file} onClick={handleUpload}>
              Start Test
            </Button>
          </div>

          <div className="action-section">
            <div className="action-section-title">Progress</div>
            {activeSubmission ? (
              <SubmissionStepList steps={activeSubmission.steps} />
            ) : (
              <Empty description="No active submission" />
            )}
          </div>

          <div className="action-section">
            <div className="action-section-title">Test Results</div>
            {activeSubmission ? (
              <>
                {activeSubmission.failure_reason ? (
                  <Alert
                    style={{ marginBottom: 12 }}
                    type="error"
                    showIcon
                    message={activeSubmission.failure_reason}
                  />
                ) : null}
                <SubmissionResultCard submission={activeSubmission} />
              </>
            ) : (
              <Empty description="Run a submission to see results." />
            )}
          </div>

          <div className="action-section">
            <div className="action-section-title">Submission History</div>
            <Table
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
              dataSource={submissions}
              columns={[
                {
                  title: "Submission ID",
                  render: (_, record) => <Link to={`/submissions/${record.id}`}>{record.id}</Link>,
                },
                {
                  title: "Status",
                  dataIndex: "status",
                  width: 100,
                  render: (value: string) => (
                    <Tag color={value === "PASSED" ? "success" : value === "FAILED" ? "error" : "processing"}>
                      {value}
                    </Tag>
                  ),
                },
                {
                  title: "Score",
                  dataIndex: "score",
                  width: 80,
                  render: (value: number | null) => (value == null ? "-" : value.toFixed(1)),
                },
                {
                  title: "Created",
                  dataIndex: "created_at",
                  width: 170,
                  render: (value: string) => new Date(value).toLocaleString(),
                },
              ]}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
