import { InfoCircleOutlined, RightOutlined, StarFilled, TrophyFilled } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import type { CompetitionSummary } from "../lib/types";

type LeaderboardTrack = "all" | "web" | "mobile" | "kernel";

function rankDisplay(rank: number) {
  if (rank > 3) return <span className="competition-rank-plain">{rank}</span>;
  return <span className={`competition-rank-badge rank-${rank}`}><span>{rank}</span>{rank === 1 ? <StarFilled /> : <TrophyFilled />}</span>;
}

export default function RequirementsPage() {
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTrack, setActiveTrack] = useState<LeaderboardTrack>("all");

  useEffect(() => {
    api.listCompetitions().then(setCompetitions).catch(() => setCompetitions([])).finally(() => setLoading(false));
  }, []);

  const leaderboardRows = useMemo(() => Array.from({ length: 5 }, (_, index) => ({ rank: index + 1 })), [activeTrack]);

  return (
    <div className="page competition-home-page">
      <div className="competition-container">
        <section className="competition-hero">
          <div className="competition-hero-icon"><TrophyFilled /></div>
          <div><div className="competition-eyebrow">ArcBench Arena</div><h1>Competitions</h1><p>Save one agent submission, then run it against any published task in a competition.</p></div>
        </section>

        <div className="competition-home-grid">
          <section className="competition-leaderboard competition-leaderboard-main">
            <div className="competition-leaderboard-header">
              <div className="competition-eyebrow">Hero board</div>
              <h2>Leaderboard</h2>
            </div>
            <div className="competition-leaderboard-controls">
              <div className="competition-track-filter" role="tablist" aria-label="Leaderboard track filter">
                {[
                  { key: "all", label: "All" },
                  { key: "web", label: "Web" },
                  { key: "mobile", label: "Mobile" },
                  { key: "kernel", label: "Kernel" },
                ].map((track) => <button key={track.key} type="button" className={activeTrack === track.key ? "active" : ""} onClick={() => setActiveTrack(track.key as LeaderboardTrack)}>{track.label}</button>)}
              </div>
              <div className="competition-leader-summary"><span>Current leader</span><strong>-</strong><span>No data yet <RightOutlined /></span></div>
            </div>
            <div className="competition-table-wrap">
              <table className="competition-ranking-table">
                <thead><tr><th>Rank</th><th>User</th><th>Model</th><th><span>Avg. Pass Rate <InfoCircleOutlined /></span></th><th>Total Token</th><th>Runtime</th></tr></thead>
                <tbody>{leaderboardRows.map((row) => <tr key={row.rank}><td>{rankDisplay(row.rank)}</td><td><strong>-</strong></td><td>-</td><td>-</td><td>-</td><td>-</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <aside className="competition-bank">
            <div className="competition-section-heading"><div><div className="competition-eyebrow">Open & upcoming</div><h2>Competition bank</h2></div><span>{competitions.length} available</span></div>
            {loading ? <div className="competition-empty">Loading competitions...</div>
              : competitions.length === 0 ? <div className="competition-empty">No competitions have been created yet.</div>
                : <div className="competition-card-grid">
                  {competitions.map((competition) => <Link key={competition.id} to={`/competitions/${competition.id}`} className="competition-card">
                    <div className="competition-card-topline"><span className="competition-status">{competition.status === "open" ? "OPEN" : "UPCOMING"}</span><TrophyFilled aria-hidden="true" /></div>
                    <h3>{competition.title}</h3><p>{competition.summary}</p>
                    <div className="competition-card-footer"><span>{competition.task_count} tasks · {competition.total_tests} tests</span><RightOutlined aria-hidden="true" /></div>
                  </Link>)}
                </div>}
          </aside>
        </div>
      </div>
    </div>
  );
}
