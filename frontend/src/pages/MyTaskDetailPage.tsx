import { DownloadOutlined, FileTextOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import MarkdownTocDocument from "../components/requirements/MarkdownTocDocument";
import { api } from "../lib/api";
import type { UserTaskDetail } from "../lib/types";

export default function MyTaskDetailPage() {
  const { taskId = "" } = useParams();
  const [task, setTask] = useState<UserTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMyTask(taskId)
      .then(setTask)
      .catch(() => setTask(null))
      .finally(() => setLoading(false));
  }, [taskId]);

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
    <div className="page detail-page">
      <div className="detail-layout">
        <section className="readme-panel">
          <div className="readme-header">
            <div className="breadcrumb">
              <span>My Tasks</span>
              <span className="sep">/</span>
              <span className="current">{task.title}</span>
            </div>
          </div>
          <MarkdownTocDocument
            markdown={task.markdown_content}
            assetsBaseUrl=""
            referencesBaseUrl={`/api/my-tasks/${task.id}/reference/`}
            tocTitle="Chapters"
          />
        </section>

        <aside className="action-panel">
          <div className="action-section">
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
              <div className="submission-subsection-title">Documents</div>
              <a className="btn-outline create-task-side-link" href={`/api/my-tasks/${task.id}/document?kind=yaml`}>
                <DownloadOutlined /> Download YAML
              </a>
              <a className="btn-outline create-task-side-link" href={`/api/my-tasks/${task.id}/document?kind=markdown`}>
                <FileTextOutlined /> Download Markdown
              </a>
            </div>
            <div className="submission-subsection">
              <div className="submission-subsection-title">Summary</div>
              <div className="inline-alert">{task.summary || "No summary provided."}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
