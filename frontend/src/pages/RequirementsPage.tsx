import { DownloadOutlined, RightOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import type { CompetitionSummary } from "../lib/types";

function competitionTypeLabel(type: string) {
  if (type === "web") return "Web";
  if (type === "android") return "Android";
  if (type === "mixed") return "Mixed";
  return type;
}

export default function RequirementsPage() {
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listCompetitions()
      .then(setCompetitions)
      .catch(() => setCompetitions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page library-page">
      <div className="competition-shell">
        <section className="competition-hero">
          <div>
            <div className="competition-eyebrow">Competition Directory</div>
            <h1>Competitions</h1>
            <p>
              Choose a competition track first, then inspect its task set, benchmark coverage, and any
              downloadable public materials.
            </p>
          </div>
          <div className="competition-hero-stats">
            <div className="competition-stat">
              <span className="competition-stat-value">{competitions.length}</span>
              <span className="competition-stat-label">Competitions</span>
            </div>
            <div className="competition-stat">
              <span className="competition-stat-value">
                {competitions.reduce((sum, item) => sum + item.task_count, 0)}
              </span>
              <span className="competition-stat-label">Tasks</span>
            </div>
            <div className="competition-stat">
              <span className="competition-stat-value">
                {competitions.reduce((sum, item) => sum + item.total_tests, 0)}
              </span>
              <span className="competition-stat-label">Tests</span>
            </div>
          </div>
        </section>

        <section className="competition-list-section">
          <div className="home-section-header">
            <div>
              <div className="leaderboard-clean-title">Available Competitions</div>
              <div className="leaderboard-clean-subtitle">
                Public benchmark material is grouped as its own mixed competition.
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">Loading competitions...</div>
          ) : competitions.length === 0 ? (
            <div className="empty-state">No competitions available.</div>
          ) : (
            <div className="competition-list-grid">
              {competitions.map((competition) => (
                <Link
                  key={competition.id}
                  to={`/competitions/${competition.id}`}
                  className={`competition-card competition-card-${competition.type}`}
                >
                  <div className="competition-card-top">
                    <div>
                      <div className="competition-type-chip">{competitionTypeLabel(competition.type)}</div>
                      <h3>{competition.title}</h3>
                    </div>
                    <RightOutlined className="competition-card-arrow" />
                  </div>
                  <p className="competition-card-summary">{competition.summary}</p>
                  <div className="competition-card-meta">
                    <span>
                      <strong>{competition.task_count}</strong> tasks
                    </span>
                    <span>
                      <strong>{competition.total_tests}</strong> tests
                    </span>
                    <span>{competition.is_public ? "Public pack" : "Competition track"}</span>
                  </div>
                  {competition.is_public ? (
                    <div className="competition-card-foot">
                      <span className="competition-download-hint">
                        <DownloadOutlined /> Downloadable requirements, tests, and demo assets
                      </span>
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
