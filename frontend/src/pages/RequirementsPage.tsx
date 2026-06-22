import { RightOutlined, TrophyFilled } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import type { CompetitionSummary } from "../lib/types";

type LeaderboardTrack = "all" | "web" | "mobile" | "kernel";

type HeroRow = {
  username: string;
  model: string;
  track: Exclude<LeaderboardTrack, "all">;
  totalTotalM: number;
  runtimeSeconds: number;
  avgPassRate: number;
};

const heroRows: HeroRow[] = [
  { username: "arc_alice", model: "Claude Sonnet 4", track: "web", totalTotalM: 842.6, runtimeSeconds: 33215, avgPassRate: 89.2 },
  { username: "browsersmith", model: "GPT-4.1", track: "web", totalTotalM: 801.4, runtimeSeconds: 30108, avgPassRate: 86.1 },
  { username: "mobileforge", model: "Gemini 2.5 Pro", track: "mobile", totalTotalM: 765.9, runtimeSeconds: 38842, avgPassRate: 84.4 },
  { username: "kernel_lane", model: "DeepSeek V3", track: "kernel", totalTotalM: 789.3, runtimeSeconds: 42736, avgPassRate: 85.2 },
  { username: "operator_xu", model: "Claude 3.5 Sonnet", track: "web", totalTotalM: 733.7, runtimeSeconds: 29561, avgPassRate: 82.9 },
  { username: "mobilepilot", model: "Gemini Flash", track: "mobile", totalTotalM: 698.2, runtimeSeconds: 27429, avgPassRate: 79.8 },
  { username: "ops_nova", model: "Qwen 3 Coder", track: "kernel", totalTotalM: 672.5, runtimeSeconds: 44105, avgPassRate: 77.5 },
];

const rankBadges = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

function competitionTypeLabel(type: string) {
  if (type === "web") return "WEB";
  if (type === "android") return "MOBILE";
  if (type === "mixed") return "MIXED";
  return type.toUpperCase();
}

function competitionAccent(type: string) {
  if (type === "web") return "web";
  if (type === "android") return "mobile";
  if (type === "mixed") return "mixed";
  return "web";
}

function bankMetaLabel(type: string) {
  if (type === "web") return "Web Arena";
  if (type === "android") return "Mobile Arena";
  if (type === "mixed") return "Mixed Track";
  return "Browse";
}

function formatRuntime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(remainder).padStart(2, "0")}s`;
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

  const leaderboardRows = useMemo(() => {
    const filtered = activeTrack === "all" ? heroRows : heroRows.filter((row) => row.track === activeTrack);
    const sorted = [...filtered].sort((a, b) => {
      return b.avgPassRate - a.avgPassRate || b.totalTotalM - a.totalTotalM;
    });
    return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [activeTrack]);

  const leader = leaderboardRows[0] ?? null;

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
            <div className="competition-heroes-header compact">
              <div className="competition-heroes-heading-block">
                <div className="competition-panel-kicker">
                  <TrophyFilled /> Hero Board
                </div>
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
                <strong>{leader?.username ?? "-"}</strong>
                <span className="competition-hero-summary-model">{leader?.model ?? "No data"}</span>
              </div>
            </div>

            <div className="leaderboard-table-wrap competition-heroes-table-wrap">
              <table className="leaderboard-table leaderboard-table-clean competition-heroes-table compact">
                <thead>
                  <tr>
                    <th style={{ width: "84px" }}>Rank</th>
                    <th style={{ width: "168px" }}>User</th>
                    <th style={{ width: "240px" }}>Model</th>
                    <th style={{ width: "156px" }}>Avg. Pass Rate</th>
                    <th style={{ width: "168px" }}>TOTAL TOKEN</th>
                    <th style={{ width: "176px" }}>RUNTIME</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardRows.map((row) => (
                    <tr key={`${row.username}-${row.model}`} className={row.rank === 1 ? "is-top" : ""}>
                      <td className="leaderboard-rank-cell">
                        {row.rank <= 3 ? (
                          <span className={`competition-rank-badge rank-${row.rank}`}>{rankBadges[row.rank - 1]}</span>
                        ) : (
                          row.rank
                        )}
                      </td>
                      <td>
                        <div className="competition-user-cell compact">
                          <strong>{row.username}</strong>
                        </div>
                      </td>
                      <td>
                        <div className="leaderboard-model-cell compact">
                          <span className="model-chip">{row.model}</span>
                        </div>
                      </td>
                      <td>{row.avgPassRate.toFixed(1)}%</td>
                      <td>{row.totalTotalM.toFixed(1)}M</td>
                      <td>{formatRuntime(row.runtimeSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="competition-bank-panel playground-bank">
            <div className="playground-bank-shell competition-bank-shell-compact">
              <div className="playground-bank-title">Competition Bank</div>

              {loading ? (
                <div className="loading-state competition-bank-state">Loading competitions...</div>
              ) : competitions.length === 0 ? (
                <div className="empty-state competition-bank-state">No competitions available.</div>
              ) : (
                <div className="playground-bank-list">
                  {competitions.map((competition) => (
                    <Link
                      key={competition.id}
                      to={`/competitions/${competition.id}`}
                      className={`playground-bank-item ${competitionAccent(competition.type)}`}
                    >
                      <div className="playground-bank-item-copy">
                        <div className={`playground-bank-badge ${competitionAccent(competition.type)}`}>
                          {competitionTypeLabel(competition.type)}
                        </div>
                        <h2>{competition.title}</h2>
                        <p>{competition.summary}</p>
                      </div>
                      <div className="playground-bank-meta">
                        <span>{bankMetaLabel(competition.type)}</span>
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
