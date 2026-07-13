import { InfoCircleOutlined, RightOutlined, StarFilled, TrophyFilled } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import type { CompetitionSummary } from "../lib/types";

type LeaderboardTrack = "all" | "web" | "mobile" | "kernel";

type PlaceholderLeaderboardRow = {
  username: string;
  model_name: string | null;
  track: LeaderboardTrack;
  avg_pass_rate: number;
  total_token_millions: number | null;
  avg_runtime_seconds: number | null;
  submission_count: number;
  rank: number;
};

function competitionTypeLabel(type: string) {
  if (type === "web") return "WEB";
  if (type === "mobile" || type === "android") return "MOBILE";
  if (type === "mixed") return "MIXED";
  return type.toUpperCase();
}

function competitionAccent(type: string) {
  if (type === "web") return "web";
  if (type === "mobile" || type === "android") return "mobile";
  if (type === "mixed") return "mixed";
  return "web";
}

function bankMetaLabel(taskCount: number) {
  return `${taskCount} TASK${taskCount === 1 ? "" : "S"}`;
}

function formatRuntime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(remainder).padStart(2, "0")}s`;
}

function renderRankDisplay(rank: number) {
  if (rank > 3) {
    return <span className="competition-rank-plain">{rank}</span>;
  }

  return (
    <span className={`competition-rank-badge rank-${rank}`}>
      <span className="competition-rank-badge-number">{rank}</span>
      {rank === 1 ? <StarFilled /> : <TrophyFilled />}
    </span>
  );
}

export default function RequirementsPage() {
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTrack, setActiveTrack] = useState<LeaderboardTrack>("all");

  useEffect(() => {
    api
      .listCompetitions()
      .then(setCompetitions)
      .catch(() => setCompetitions([]))
      .finally(() => setLoading(false));
  }, []);

  const displayRows = useMemo(() => {
    const rows: PlaceholderLeaderboardRow[] = [{
        username: "-",
        model_name: null,
        track: activeTrack,
        avg_pass_rate: NaN,
        total_token_millions: null,
        avg_runtime_seconds: null,
        submission_count: 0,
        rank: 1,
      }];
    const targetRowCount = 5;
    const nextRankStart = rows.length + 1;
    for (let rank = nextRankStart; rank <= targetRowCount; rank += 1) {
      rows.push({
        username: "-",
        model_name: null,
        track: activeTrack,
        avg_pass_rate: NaN,
        total_token_millions: null,
        avg_runtime_seconds: null,
        submission_count: 0,
        rank,
      });
    }
    return rows;
  }, [activeTrack]);
  const competitionsViewAllHref = competitions[0] ? `/competitions/${competitions[0].id}` : "/competitions/web";

  return (
    <div className="page library-page competition-home-page">
      <div className="competition-shell competition-home-shell">
        <div className="breadcrumb competition-home-breadcrumb">
          <span>Competition</span>
          <span className="sep">/</span>
          <span className="current">Home</span>
        </div>

        <div className="competition-home-grid">
          <section className="competition-heroes-panel">
            <div className="competition-heroes-header compact">
              <div className="competition-panel-kicker">
                <TrophyFilled /> Hero Board
              </div>
            </div>

            <div className="competition-hero-backdrop competition-hero-backdrop-top" aria-hidden="true">
              <div className="competition-empty-confetti dot-one" />
              <div className="competition-empty-confetti dot-two" />
              <div className="competition-empty-podium">
                <div className="competition-empty-podium-step left" />
                <div className="competition-empty-podium-step center">
                  <StarFilled />
                </div>
                <div className="competition-empty-podium-step right" />
              </div>
              <div className="competition-empty-laurel left">*</div>
              <div className="competition-empty-laurel right">*</div>
            </div>

            <div className="competition-heroes-controls compact">
              <div className="competition-heroes-heading-block">
                <div className="leaderboard-segmented" role="tablist" aria-label="Leaderboard track filter">
                  {[
                    { key: "all", label: "All" },
                    { key: "web", label: "Web" },
                    { key: "mobile", label: "Mobile" },
                    { key: "kernel", label: "Kernel" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`leaderboard-segment ${activeTrack === item.key ? "active" : ""}`}
                      onClick={() => setActiveTrack(item.key as LeaderboardTrack)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="competition-hero-summary compact">
                <span className="summary-label">Current leader</span>
                <strong>-</strong>
                <span className="competition-hero-summary-model">
                  No data yet <RightOutlined />
                </span>
              </div>
            </div>

            <div className="competition-home-table-shell">
              <table className="competition-home-table">
                <thead>
                  <tr>
                    <th style={{ width: "96px" }}>Rank</th>
                    <th style={{ width: "168px" }}>User</th>
                    <th style={{ width: "240px" }}>Model</th>
                    <th style={{ width: "156px" }}>
                      <span className="competition-table-heading-inline">
                        Avg. Pass Rate <InfoCircleOutlined />
                      </span>
                    </th>
                    <th style={{ width: "168px" }}>Total Token</th>
                    <th style={{ width: "176px" }}>Runtime</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr
                      key={`${row.rank}-${row.username}-${row.model_name ?? "none"}`}
                    >
                      <td className="leaderboard-rank-cell">{renderRankDisplay(row.rank)}</td>
                      <td>
                        <div className="competition-home-user-cell">
                          <strong>{row.username}</strong>
                        </div>
                      </td>
                      <td>{row.model_name ?? "-"}</td>
                      <td>{Number.isFinite(row.avg_pass_rate) ? `${row.avg_pass_rate.toFixed(1)}%` : "-"}</td>
                      <td>{row.total_token_millions == null ? "-" : `${row.total_token_millions.toFixed(1)}M`}</td>
                      <td>{row.avg_runtime_seconds == null ? "-" : formatRuntime(row.avg_runtime_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="competition-bank-panel">
            <div className="competition-bank-shell">
              <div className="competition-bank-header">
                <div className="competition-bank-title">Competition Bank</div>
                <Link className="competition-bank-view-all" to={competitionsViewAllHref}>
                  View all <RightOutlined />
                </Link>
              </div>

              {loading ? (
                <div className="loading-state competition-bank-state">Loading competitions...</div>
              ) : competitions.length === 0 ? (
                <div className="empty-state competition-bank-state">No competitions available.</div>
              ) : (
                <div className="competition-bank-list">
                  {competitions.map((competition) => (
                    <Link
                      key={competition.id}
                      to={`/competitions/${competition.id}`}
                      className={`competition-bank-item ${competitionAccent(competition.type)}`}
                    >
                      <div className="competition-bank-item-copy">
                        <div className={`playground-bank-badge ${competitionAccent(competition.type)}`}>
                          {competitionTypeLabel(competition.type)}
                        </div>
                        <h2>{competition.title}</h2>
                        <p>{competition.summary}</p>
                      </div>
                      <div className="competition-bank-item-meta">
                        <span>{bankMetaLabel(competition.task_count)}</span>
                        <RightOutlined />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
