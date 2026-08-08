import {
  CalendarOutlined,
  CloudUploadOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  RightOutlined,
  StarFilled,
  TrophyFilled,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import type { CompetitionLeaderboardEntry, CompetitionSummary } from "../lib/types";

const workflowNodes = [
  { label: "Upload agent", copy: "Add your runnable agent package.", icon: <CloudUploadOutlined /> },
  { label: "Compile requirements", copy: "Turn the brief into runnable modules.", icon: <DeploymentUnitOutlined /> },
  { label: "Run mixed tasks", copy: "Evaluate against both task packs.", icon: <ExperimentOutlined /> },
  { label: "Inspect output", copy: "Review evidence and results.", icon: <PlayCircleOutlined /> },
];

const leaderboardPlaceholders = Array.from({ length: 5 }, (_, index) => ({
  username: `Participant ${String(index + 1).padStart(2, "0")}`,
}));

function rankDisplay(rank: number) {
  if (rank > 3) return <span className="competition-rank-plain">{rank}</span>;
  return <span className={`competition-rank-badge rank-${rank}`}><span>{rank}</span>{rank === 1 ? <StarFilled /> : <TrophyFilled />}</span>;
}

function formatCompetitionDate(value?: string | null) {
  if (!value) return "TBD";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCompetitionRange(start?: string | null, end?: string | null, includeYear = false) {
  if (!start || !end) return "TBD";
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
  return `${formatter.format(new Date(`${start}T00:00:00`))} - ${formatter.format(new Date(`${end}T00:00:00`))}`;
}

function formatRuntime(value?: number | null) {
  if (value == null) return "-";
  return value < 60 ? `${value}s` : `${Math.round(value / 60)}m`;
}

function formatTokenMillions(value?: number | null) {
  return value == null ? "-" : `${value.toFixed(2)}M`;
}

function statusLabel(status: string) {
  if (status === "open") return "OPEN";
  if (status === "upcoming") return "UPCOMING";
  if (status === "closed" || status === "ended") return "ENDED";
  return status.toUpperCase();
}

export default function RequirementsPage() {
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [activeCompetitionId, setActiveCompetitionId] = useState("");

  useEffect(() => {
    api
      .listCompetitions()
      .then((items) => {
        setCompetitions(items);
        setActiveCompetitionId((current) => current || items[0]?.id || "");
      })
      .catch(() => setCompetitions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeCompetitionId) {
      setLeaderboard([]);
      return;
    }

    setLeaderboardLoading(true);
    api
      .getCompetitionLeaderboard(activeCompetitionId)
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]))
      .finally(() => setLeaderboardLoading(false));
  }, [activeCompetitionId]);

  const activeCompetition = useMemo(
    () => competitions.find((item) => item.id === activeCompetitionId) ?? competitions[0] ?? null,
    [activeCompetitionId, competitions],
  );

  const currentLeader = leaderboard[0];

  return (
    <div className="page competition-home-page">
      <div className="competition-container">
        <section className="competition-hero">
          <div className="competition-hero-copy">
            <h1>Competitions</h1>
            <p>
              Upload an agent, compile long-form requirements, and evaluate runnable systems across software engineering and data-workspace tasks.
            </p>
            <div className="competition-hero-cta">
              <span>Try it first?</span>
              <Link to="/playground">Go to playground <RightOutlined /></Link>
            </div>
          </div>
          <div className="competition-workflow-diagram" aria-label="Agent competition workflow">
            {workflowNodes.map((node, index) => (
                <div key={node.label} className="competition-workflow-step">
                  <span className="competition-workflow-icon">{node.icon}</span>
                  <div>
                    <em>{String(index + 1).padStart(2, "0")}</em>
                  <strong>{node.label}</strong>
                    <small>{node.copy}</small>
                  </div>
                </div>
            ))}
          </div>
        </section>

        <div className="competition-home-grid">
          <section className="competition-leaderboard competition-leaderboard-main">
            <div className="competition-leaderboard-header">
              <div>
                <div className="competition-eyebrow">Rankings</div>
                <h2>Leaderboard</h2>
              </div>
              <label className="competition-select-shell">
                <span>Competition</span>
                <select
                  value={activeCompetitionId}
                  onChange={(event) => setActiveCompetitionId(event.target.value)}
                  disabled={competitions.length === 0}
                  aria-label="Leaderboard competition filter"
                >
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>
                      {competition.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="competition-leaderboard-controls">
              <div className="competition-leaderboard-range">
                <span>{activeCompetition?.title ?? "No competition selected"}</span>
                {activeCompetition ? (
                  <strong>{formatCompetitionDate(activeCompetition.starts_at)} - {formatCompetitionDate(activeCompetition.ends_at)}</strong>
                ) : null}
              </div>
              <div className="competition-leader-summary">
                <span>Current leader</span>
                <strong>{currentLeader?.username ?? "-"}</strong>
                <span>{currentLeader ? `${currentLeader.avg_pass_rate.toFixed(1)} avg pass` : "No data yet"} <RightOutlined /></span>
              </div>
            </div>
            <div className="competition-table-wrap">
              <table className="competition-ranking-table">
                <thead>
                  <tr><th>Rank</th><th>User</th><th>Model</th><th><span>Avg. Pass Rate <InfoCircleOutlined /></span></th><th>Total Token</th><th>Runtime</th></tr>
                </thead>
                <tbody>
                  {leaderboardLoading ? (
                    <tr><td colSpan={6}>Loading leaderboard...</td></tr>
                  ) : leaderboard.length === 0 ? (
                    leaderboardPlaceholders.map((row, index) => (
                      <tr key={row.username} className="competition-placeholder-row">
                        <td>{rankDisplay(index + 1)}</td>
                        <td><strong>{row.username}</strong></td>
                        <td>—</td><td>—</td><td>—</td><td>—</td>
                      </tr>
                    ))
                  ) : leaderboard.map((row, index) => (
                    <tr key={`${row.username}-${row.model_name ?? "model"}-${index}`}>
                      <td>{rankDisplay(index + 1)}</td>
                      <td><strong>{row.username}</strong></td>
                      <td>{row.model_name ?? "-"}</td>
                      <td>{row.avg_pass_rate.toFixed(1)}</td>
                      <td>{formatTokenMillions(row.total_token_millions)}</td>
                      <td>{formatRuntime(row.avg_runtime_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="competition-bank">
            <div className="competition-section-heading">
              <div>
                <div className="competition-eyebrow">Open & upcoming</div>
                <h2>Current competitions</h2>
              </div>
              <span>{competitions.length} available</span>
            </div>
            {loading ? (
              <div className="competition-empty">Loading competitions...</div>
            ) : competitions.length === 0 ? (
              <div className="competition-empty">No competitions have been created yet.</div>
            ) : (
              <div className="competition-card-grid">
                {competitions.map((competition) => (
                  <Link key={competition.id} to={`/competitions/${competition.id}`} className="competition-card">
                    <div className="competition-card-topline">
                      <span className="competition-stage"><TrophyFilled aria-hidden="true" /> {statusLabel(competition.status)}</span>
                    </div>
                    <h3>{competition.title}</h3>
                    <p>{competition.summary}</p>
                    <div className="competition-card-dates" aria-label="Competition dates">
                      <span><CalendarOutlined aria-hidden="true" /> {formatCompetitionRange(competition.starts_at, competition.ends_at)}</span>
                    </div>
                    <div className="competition-card-footer">
                      <span>{competition.task_count} tasks | {competition.total_tests} tests</span>
                      <RightOutlined aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
