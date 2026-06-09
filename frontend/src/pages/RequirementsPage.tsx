import { DownloadOutlined, RightOutlined, TrophyFilled } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import type { CompetitionSummary } from "../lib/types";

type LeaderboardTrack = "all" | "web" | "mobile";
type LeaderboardSort = "coverage" | "token_efficiency";

type HeroRow = {
  username: string;
  model: string;
  provider: string;
  track: Exclude<LeaderboardTrack, "all">;
  avgRequirementCoverage: number;
  avgTokenEfficiency: number;
  avgPassRate: number;
  totalTasks: number;
};

const heroRows: HeroRow[] = [
  {
    username: "arc_alice",
    model: "Claude Sonnet 4",
    provider: "Anthropic",
    track: "web",
    avgRequirementCoverage: 91.4,
    avgTokenEfficiency: 84.8,
    avgPassRate: 89.2,
    totalTasks: 22,
  },
  {
    username: "browsersmith",
    model: "GPT-4.1",
    provider: "OpenAI",
    track: "web",
    avgRequirementCoverage: 88.9,
    avgTokenEfficiency: 82.3,
    avgPassRate: 86.1,
    totalTasks: 24,
  },
  {
    username: "mobileforge",
    model: "Gemini 2.5 Pro",
    provider: "Google",
    track: "mobile",
    avgRequirementCoverage: 86.7,
    avgTokenEfficiency: 79.2,
    avgPassRate: 84.4,
    totalTasks: 18,
  },
  {
    username: "operator_xu",
    model: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    track: "web",
    avgRequirementCoverage: 85.3,
    avgTokenEfficiency: 78.5,
    avgPassRate: 82.9,
    totalTasks: 19,
  },
  {
    username: "kernellane",
    model: "DeepSeek V3",
    provider: "DeepSeek",
    track: "mobile",
    avgRequirementCoverage: 81.6,
    avgTokenEfficiency: 76.4,
    avgPassRate: 79.8,
    totalTasks: 16,
  },
];

function competitionTypeLabel(type: string) {
  if (type === "web") return "Web";
  if (type === "android") return "Mobile";
  if (type === "mixed") return "Mixed";
  return type;
}

function competitionAccent(type: string) {
  if (type === "web") return "web";
  if (type === "android") return "mobile";
  if (type === "mixed") return "mixed";
  return "web";
}

export default function RequirementsPage() {
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTrack, setActiveTrack] = useState<LeaderboardTrack>("all");
  const [sortBy, setSortBy] = useState<LeaderboardSort>("coverage");

  useEffect(() => {
    api
      .listCompetitions()
      .then(setCompetitions)
      .catch(() => setCompetitions([]))
      .finally(() => setLoading(false));
  }, []);

  const leaderboardRows = useMemo(() => {
    const filtered = activeTrack === "all" ? heroRows : heroRows.filter((row) => row.track === activeTrack);
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "coverage") {
        return b.avgRequirementCoverage - a.avgRequirementCoverage || b.avgTokenEfficiency - a.avgTokenEfficiency;
      }
      return b.avgTokenEfficiency - a.avgTokenEfficiency || b.avgRequirementCoverage - a.avgRequirementCoverage;
    });

    return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [activeTrack, sortBy]);

  const leader = leaderboardRows[0] ?? null;

  const overview = useMemo(() => {
    return {
      competitions: competitions.length,
      tasks: competitions.reduce((sum, item) => sum + item.task_count, 0),
      tests: competitions.reduce((sum, item) => sum + item.total_tests, 0),
    };
  }, [competitions]);

  return (
    <div className="page library-page competition-home-page">
      <div className="competition-shell competition-home-shell">
        <div className="breadcrumb competition-home-breadcrumb">
          <span>Competition</span>
          <span className="sep">/</span>
          <span className="current">Home</span>
        </div>

        <div className="competition-home-grid">
          <section className="competition-heroes-panel leaderboard-card leaderboard-card-clean">
            <div className="competition-heroes-header">
              <div>
                <div className="competition-panel-kicker">
                  <TrophyFilled /> Hero Board
                </div>
                <h1>Competition leaderboard</h1>
                <p>
                  Ranked by average requirement coverage per task, with token efficiency preserved as the second core signal.
                </p>
              </div>
              <div className="competition-hero-summary">
                <span className="summary-label">Current leader</span>
                <strong>{leader?.username ?? "-"}</strong>
                <span className="competition-hero-summary-model">{leader?.model ?? "No data"}</span>
              </div>
            </div>

            <div className="competition-heroes-controls">
              <div className="leaderboard-segmented" role="tablist" aria-label="Leaderboard track filter">
                {[
                  { key: "all", label: "All" },
                  { key: "web", label: "Web" },
                  { key: "mobile", label: "Mobile" },
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

              <label className="leaderboard-sorter competition-heroes-sorter">
                <span>Sort by</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as LeaderboardSort)}>
                  <option value="coverage">Average Requirement Coverage</option>
                  <option value="token_efficiency">Average Token Efficiency</option>
                </select>
              </label>
            </div>

            <div className="competition-heroes-overview">
              <div className="competition-overview-card">
                <span>Competitions</span>
                <strong>{overview.competitions}</strong>
              </div>
              <div className="competition-overview-card">
                <span>Tasks</span>
                <strong>{overview.tasks}</strong>
              </div>
              <div className="competition-overview-card accent">
                <span>Tests</span>
                <strong>{overview.tests}</strong>
              </div>
            </div>

            <div className="leaderboard-table-wrap competition-heroes-table-wrap">
              <table className="leaderboard-table leaderboard-table-clean competition-heroes-table">
                <thead>
                  <tr>
                    <th style={{ width: "72px" }}>Rank</th>
                    <th>User</th>
                    <th style={{ width: "170px" }}>Model</th>
                    <th style={{ width: "150px" }}>Avg. Coverage</th>
                    <th style={{ width: "150px" }}>Avg. Token Eff.</th>
                    <th style={{ width: "120px" }}>Avg. Pass</th>
                    <th style={{ width: "90px" }}>Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardRows.map((row) => (
                    <tr key={row.username} className={row.rank === 1 ? "is-top" : ""}>
                      <td className="leaderboard-rank-cell">{row.rank}</td>
                      <td>
                        <div className="competition-user-cell">
                          <strong>{row.username}</strong>
                          <span>{row.track === "web" ? "Web Arena" : "Mobile Arena"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="leaderboard-model-cell">
                          <span className="model-chip">{row.model}</span>
                          <span className="leaderboard-model-meta">{row.provider}</span>
                        </div>
                      </td>
                      <td className={sortBy === "coverage" ? "leaderboard-metric-active" : ""}>
                        {row.avgRequirementCoverage.toFixed(1)}%
                      </td>
                      <td className={sortBy === "token_efficiency" ? "leaderboard-metric-active" : ""}>
                        {row.avgTokenEfficiency.toFixed(1)}%
                      </td>
                      <td>{row.avgPassRate.toFixed(1)}%</td>
                      <td>{row.totalTasks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="competition-bank-panel">
            <div className="competition-bank-shell">
              <div className="competition-bank-header">Competition Bank</div>

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
                      <div className="competition-bank-item-main">
                        <div className={`competition-type-chip competition-type-chip-${competition.type}`}>
                          {competitionTypeLabel(competition.type)}
                        </div>
                        <h2>{competition.title}</h2>
                        <p>{competition.summary}</p>
                      </div>
                      <div className="competition-bank-item-meta">
                        <div className="competition-bank-meta-block">
                          <span>Tasks</span>
                          <strong>{competition.task_count}</strong>
                        </div>
                        <div className="competition-bank-meta-block">
                          <span>Tests</span>
                          <strong>{competition.total_tests}</strong>
                        </div>
                        <div className="competition-bank-meta-block">
                          <span>Access</span>
                          <strong>{competition.is_public ? "Public" : "Track"}</strong>
                        </div>
                        <RightOutlined className="competition-bank-arrow" />
                      </div>

                      {competition.is_public ? (
                        <div className="competition-bank-foot">
                          <span className="competition-download-hint">
                            <DownloadOutlined /> Includes downloadable requirements, tests, and demo assets
                          </span>
                        </div>
                      ) : null}
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
