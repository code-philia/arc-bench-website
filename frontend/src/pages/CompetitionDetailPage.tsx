import { DownloadOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../lib/api";
import type { CompetitionDetail } from "../lib/types";

function typeLabel(type: string) {
  if (type === "web") return "Web";
  if (type === "android") return "Mobile";
  if (type === "mixed") return "Mixed";
  return type;
}

export default function CompetitionDetailPage() {
  const { competitionId = "" } = useParams();
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getCompetition(competitionId)
      .then(setCompetition)
      .catch(() => setCompetition(null))
      .finally(() => setLoading(false));
  }, [competitionId]);

  if (loading) {
    return (
      <div className="page centered">
        <div className="loading-state">Loading competition...</div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="page centered">
        <div className="empty-state">Competition not found.</div>
      </div>
    );
  }

  return (
    <div className="page library-page">
      <div className="competition-shell">
        <section className="competition-detail-hero">
          <div className="competition-detail-copy">
            <div className="breadcrumb">
              <span>Competitions</span>
              <span className="sep">/</span>
              <span className="current">{competition.title}</span>
            </div>
            <div className="competition-type-chip large">{typeLabel(competition.type)}</div>
            <h1>{competition.title}</h1>
            <p>{competition.summary}</p>
          </div>
          <div className="competition-detail-side">
            <div className="competition-stat-panel">
              <div className="competition-stat-row">
                <span>Tasks</span>
                <strong>{competition.task_count}</strong>
              </div>
              <div className="competition-stat-row">
                <span>Tests</span>
                <strong>{competition.total_tests}</strong>
              </div>
              <div className="competition-stat-row">
                <span>Access</span>
                <strong>{competition.is_public ? "Public" : "Competition"}</strong>
              </div>
            </div>
            {competition.downloads?.full_bundle ? (
              <a className="btn-outline competition-download-btn" href={competition.downloads.full_bundle}>
                <DownloadOutlined /> Download Competition Pack
              </a>
            ) : null}
          </div>
        </section>

        <section className="task-table-wrap competition-task-table-wrap">
          <table className="task-table">
            <thead>
              <tr>
                <th style={{ width: "90px" }}>ID</th>
                <th>Task</th>
                <th style={{ width: "110px" }}>Modules</th>
                <th style={{ width: "110px" }}>Tests</th>
                <th style={{ width: competition.is_public ? "400px" : "120px" }}>
                  {competition.is_public ? "Downloads" : "Status"}
                </th>
              </tr>
            </thead>
            <tbody>
              {competition.tasks.map((task) => (
                <tr key={task.id}>
                  <td className="task-id">{task.id}</td>
                  <td>
                    <div className="task-name">
                      <Link className="inline-link" to={`/requirements/${task.id}`}>
                        {task.title}
                      </Link>
                      <span className="sub">{task.summary}</span>
                    </div>
                  </td>
                  <td>{task.module_count}</td>
                  <td>{task.total_tests}</td>
                  <td>
                    {competition.is_public && task.public_downloads ? (
                      <div className="competition-download-group">
                        {task.public_downloads.requirement_document ? (
                          <a className="btn-download" href={task.public_downloads.requirement_document}>
                            Requirements
                          </a>
                        ) : null}
                        {task.public_downloads.prerequisites_document ? (
                          <a className="btn-download" href={task.public_downloads.prerequisites_document}>
                            Prerequisites
                          </a>
                        ) : null}
                        {task.public_downloads.tests_bundle ? (
                          <a className="btn-download" href={task.public_downloads.tests_bundle}>
                            Tests
                          </a>
                        ) : null}
                        {task.public_downloads.demo_bundle ? (
                          <a className="btn-download" href={task.public_downloads.demo_bundle}>
                            Demo
                          </a>
                        ) : null}
                        {task.public_downloads.full_bundle ? (
                          <a className="btn-download" href={task.public_downloads.full_bundle}>
                            Full Pack
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <span className="status-dot completed">Ready</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
