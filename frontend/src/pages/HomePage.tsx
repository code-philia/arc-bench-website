import { ArrowRightOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import type { RequirementSummary, SubmissionSummary } from "../lib/types";

const leaderboardData = {
  overall: [
    { rank: 1, name: "Claude Code", model: "claude-sonnet-4", score: 93.2, passRate: "109/117" },
    { rank: 2, name: "GPT Codex", model: "gpt-4.1", score: 89.7, passRate: "105/117" },
    { rank: 3, name: "Gemini CLI", model: "gemini-2.5-pro", score: 85.5, passRate: "100/117" },
    { rank: 4, name: "Cursor Agent", model: "cursor-small", score: 82.1, passRate: "96/117" },
  ],
};

export default function HomePage() {
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const topScore = leaderboardData.overall[0]?.score ?? 0;

  useEffect(() => {
    api.listRequirements().then(setRequirements).catch(() => undefined);
    api.listSubmissions().then((items) => setSubmissions(items.slice(0, 5))).catch(() => undefined);
  }, []);

  return (
    <div className="page home-page">
      <div className="home-split">
        <section className="home-left">
          <div className="home-copy">
            <div className="home-kicker">
              <span className="home-kicker-label">Evaluation Surface</span>
              <span className="home-kicker-copy">Executable specs, runner traces, and benchmark scoring.</span>
            </div>
            <div className="home-badge">
              <span className="dot" />
              Benchmark v2.4 Live
            </div>
            <div className="home-brand">
              <div className="mark">A</div>
              <div className="home-brand-text">
                <h1>
                  Arc<span className="gradient">Bench</span>
                </h1>
                <div className="tagline">Agent Benchmark Platform</div>
              </div>
            </div>
            <p className="home-desc">
              Upload your AI agent, run it against real-world application benchmarks, and inspect
              the exact test outcomes, logs, and scoring.
            </p>
            <div className="home-proof-strip">
              <div className="proof-item">
                <span className="proof-key">Specs</span>
                <span className="proof-value">Markdown requirements + references</span>
              </div>
              <div className="proof-item">
                <span className="proof-key">Runner</span>
                <span className="proof-value">Deterministic execution pipeline</span>
              </div>
              <div className="proof-item">
                <span className="proof-key">Review</span>
                <span className="proof-value">Step logs, scores, and artifacts</span>
              </div>
            </div>
          </div>

          <div className="home-panels">
            <div className="categories">
              <Link className="category-card" to="/requirements">
                <div className="category-icon web">🌐</div>
                <div>
                  <h3>Web Applications</h3>
                  <p className="desc">
                    Benchmark agents on full-stack web tasks backed by executable Playwright suites.
                  </p>
                  <div className="category-meta">
                    <span>
                      <span className="num">{requirements.length}</span> tasks
                    </span>
                    <span>
                      <span className="num">{submissions.length}</span> recent submissions
                    </span>
                  </div>
                </div>
                <ArrowRightOutlined />
              </Link>
              <div className="category-card disabled">
                <div className="category-icon android">📱</div>
                <div>
                  <h3>Android Applications</h3>
                  <p className="desc">
                    Placeholder inventory preserved from the prototype; execution pipeline comes later.
                  </p>
                  <div className="category-meta">
                    <span>
                      <span className="num">12</span> tasks
                    </span>
                    <span>
                      <span className="num">189</span> submissions
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="home-stats">
              <div className="home-stat">
                <div className="val">{requirements.length || 1}</div>
                <div className="lbl">Tasks</div>
              </div>
              <div className="home-stat">
                <div className="val">{submissions.length}</div>
                <div className="lbl">Recent Runs</div>
              </div>
              <div className="home-stat">
                <div className="val">1</div>
                <div className="lbl">Live Runner</div>
              </div>
              <div className="home-stat">
                <div className="val">2</div>
                <div className="lbl">Runtimes</div>
              </div>
            </div>
          </div>
        </section>

        <section className="leaderboard-card">
          <div className="terminal-bar">
            <div className="terminal-lights">
              <span />
              <span />
              <span />
            </div>
            <div className="terminal-path">arcbench://leaderboard/live</div>
            <div className="terminal-state">LIVE</div>
          </div>
          <div className="leaderboard-header">
            <div>
              <h3>Leaderboard</h3>
              <div className="leaderboard-subtitle">Terminal snapshot of current benchmark leaders.</div>
            </div>
            <div className="leaderboard-tabs">
              <button className="lb-tab active" type="button">
                Overall
              </button>
              <button className="lb-tab" type="button">
                Web
              </button>
              <button className="lb-tab" type="button">
                Android
              </button>
            </div>
          </div>
          <div className="leaderboard-overview">
            <div className="overview-block">
              <span className="overview-label">Top Score</span>
              <span className="overview-value">{topScore.toFixed(1)}</span>
            </div>
            <div className="overview-block">
              <span className="overview-label">Active Board</span>
              <span className="overview-value">{leaderboardData.overall.length} agents</span>
            </div>
            <div className="overview-block">
              <span className="overview-label">Spec Size</span>
              <span className="overview-value">117 checks</span>
            </div>
          </div>
          <table className="leaderboard-table leaderboard-table-terminal">
            <thead>
              <tr>
                <th style={{ width: "36px" }}>#</th>
                <th>Agent</th>
                <th style={{ width: "86px" }}>Pass Rate</th>
                <th style={{ width: "92px" }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.overall.map((record) => (
                <tr key={record.rank} className={record.rank === 1 ? "is-top" : ""}>
                  <td className="rank">{String(record.rank).padStart(2, "0")}</td>
                  <td>
                    <div className="leaderboard-agent">
                      {record.name}
                      <span className="sub">$ {record.model}</span>
                    </div>
                  </td>
                  <td className="pass-rate high">{record.passRate}</td>
                  <td className="leaderboard-score">{record.score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="recent-submissions">
            <div className="panel-title">Recent Submissions</div>
            {submissions.length === 0 ? (
              <div className="empty-state">No submissions yet.</div>
            ) : (
              submissions.map((submission) => (
                <Link key={submission.id} to={`/submissions/${submission.id}`} className="recent-item">
                  <div>
                    <strong>{submission.id}</strong>
                    <div className="table-sub">
                      {submission.requirement_id} · {submission.runtime}
                    </div>
                  </div>
                  <div className={`status-dot ${submission.status.toLowerCase()}`}>{submission.status}</div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
