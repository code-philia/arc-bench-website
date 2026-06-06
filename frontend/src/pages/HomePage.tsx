import { ArrowRightOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { RequirementSummary, SubmissionSummary } from "../lib/types";

type BoardTab = "all" | "web" | "android";
type SortKey =
  | "avgRequirementRate"
  | "maxPassRate"
  | "minRequirementRate"
  | "avgTokenUsage"
  | "totalTokenUsage";

type LeaderboardRecord = {
  id: string;
  name: string;
  provider: string;
  model: string;
  avgRequirementRate: number;
  maxPassRate: number;
  minRequirementRate: number;
  avgTokenUsage: number;
  totalTokenUsage: number;
};

const leaderboardData: Record<BoardTab, LeaderboardRecord[]> = {
  all: [
    {
      id: "claude-code",
      name: "Claude Code",
      provider: "Anthropic",
      model: "claude-sonnet-4",
      avgRequirementRate: 86.7,
      maxPassRate: 96.8,
      minRequirementRate: 71.3,
      avgTokenUsage: 3.9,
      totalTokenUsage: 468.2,
    },
    {
      id: "gpt-codex",
      name: "GPT Codex",
      provider: "OpenAI",
      model: "gpt-4.1",
      avgRequirementRate: 84.9,
      maxPassRate: 95.1,
      minRequirementRate: 69.8,
      avgTokenUsage: 4.2,
      totalTokenUsage: 491.5,
    },
    {
      id: "gemini-cli",
      name: "Gemini CLI",
      provider: "Google",
      model: "gemini-2.5-pro",
      avgRequirementRate: 82.4,
      maxPassRate: 92.6,
      minRequirementRate: 66.4,
      avgTokenUsage: 3.5,
      totalTokenUsage: 430.8,
    },
    {
      id: "cursor-agent",
      name: "Cursor Agent",
      provider: "Cursor",
      model: "cursor-small",
      avgRequirementRate: 80.1,
      maxPassRate: 90.5,
      minRequirementRate: 62.7,
      avgTokenUsage: 2.8,
      totalTokenUsage: 398.6,
    },
    {
      id: "deepseek-agent",
      name: "DeepSeek Agent",
      provider: "DeepSeek",
      model: "deepseek-v3",
      avgRequirementRate: 77.8,
      maxPassRate: 88.9,
      minRequirementRate: 58.1,
      avgTokenUsage: 2.6,
      totalTokenUsage: 351.9,
    },
  ],
  web: [
    {
      id: "claude-code-web",
      name: "Claude Code",
      provider: "Anthropic",
      model: "claude-sonnet-4",
      avgRequirementRate: 88.5,
      maxPassRate: 97.3,
      minRequirementRate: 74.9,
      avgTokenUsage: 4.1,
      totalTokenUsage: 282.4,
    },
    {
      id: "gpt-codex-web",
      name: "GPT Codex",
      provider: "OpenAI",
      model: "gpt-4.1",
      avgRequirementRate: 87.1,
      maxPassRate: 96.2,
      minRequirementRate: 72.1,
      avgTokenUsage: 4.5,
      totalTokenUsage: 301.2,
    },
    {
      id: "gemini-cli-web",
      name: "Gemini CLI",
      provider: "Google",
      model: "gemini-2.5-pro",
      avgRequirementRate: 84.2,
      maxPassRate: 93.8,
      minRequirementRate: 68.5,
      avgTokenUsage: 3.8,
      totalTokenUsage: 266.5,
    },
    {
      id: "cursor-agent-web",
      name: "Cursor Agent",
      provider: "Cursor",
      model: "cursor-small",
      avgRequirementRate: 81.6,
      maxPassRate: 91.7,
      minRequirementRate: 63.4,
      avgTokenUsage: 3.1,
      totalTokenUsage: 244.9,
    },
  ],
  android: [
    {
      id: "gpt-codex-android",
      name: "GPT Codex",
      provider: "OpenAI",
      model: "gpt-4.1",
      avgRequirementRate: 83.2,
      maxPassRate: 93.4,
      minRequirementRate: 67.2,
      avgTokenUsage: 3.7,
      totalTokenUsage: 190.3,
    },
    {
      id: "claude-code-android",
      name: "Claude Code",
      provider: "Anthropic",
      model: "claude-sonnet-4",
      avgRequirementRate: 81.9,
      maxPassRate: 91.4,
      minRequirementRate: 65.1,
      avgTokenUsage: 3.4,
      totalTokenUsage: 185.8,
    },
    {
      id: "deepseek-agent-android",
      name: "DeepSeek Agent",
      provider: "DeepSeek",
      model: "deepseek-v3",
      avgRequirementRate: 79.3,
      maxPassRate: 89.6,
      minRequirementRate: 60.8,
      avgTokenUsage: 2.5,
      totalTokenUsage: 160.2,
    },
    {
      id: "kimi-agent-android",
      name: "Kimi Agent",
      provider: "Moonshot",
      model: "kimi-k2",
      avgRequirementRate: 76.4,
      maxPassRate: 86.1,
      minRequirementRate: 57.9,
      avgTokenUsage: 2.2,
      totalTokenUsage: 149.7,
    },
  ],
};

const boardTabs: Array<{ key: BoardTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "web", label: "Web" },
  { key: "android", label: "Android" },
];

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "avgRequirementRate", label: "Average Requirement Coverage" },
  { key: "maxPassRate", label: "Best Pass Rate" },
  { key: "minRequirementRate", label: "Lowest Requirement Coverage" },
  { key: "avgTokenUsage", label: "Average Token Usage (M)" },
  { key: "totalTokenUsage", label: "Total Token Usage (M)" },
];

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatToken(value: number) {
  return `${value.toFixed(1)}M`;
}

function submissionTitle(submission: SubmissionSummary) {
  return submission.display_name || submission.id;
}

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [activeTab, setActiveTab] = useState<BoardTab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("avgRequirementRate");

  const rankedRecords = useMemo(() => {
    return [...leaderboardData[activeTab]].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [activeTab, sortKey]);

  const topRecord = rankedRecords[0];

  useEffect(() => {
    api.listRequirements().then(setRequirements).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) {
      setSubmissions([]);
      return;
    }
    api.listSubmissions().then((items) => setSubmissions(items.slice(0, 6))).catch(() => setSubmissions([]));
  }, [user]);

  return (
    <div className="page home-page">
      <div className="home-layout">
        <section className="home-hero-panel">
          <div className="home-split home-split-wide">
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
                    <div className="category-icon web">W</div>
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
                    <div className="category-icon android">A</div>
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

            <section className="leaderboard-card leaderboard-card-clean">
              <div className="leaderboard-clean-header">
                <div>
                  <div className="leaderboard-clean-title">Leaderboard</div>
                  <div className="leaderboard-clean-subtitle">
                    Mock data is used for now to preview the leaderboard layout, tabs, and sorting.
                  </div>
                </div>
                <div className="leaderboard-clean-summary">
                  <span className="summary-label">Current Leader</span>
                  <strong>{topRecord?.name ?? "-"}</strong>
                </div>
              </div>

              <div className="leaderboard-controls">
                <div className="leaderboard-segmented" role="tablist" aria-label="Leaderboard scope tabs">
                  {boardTabs.map((tab) => (
                    <button
                      key={tab.key}
                      className={`leaderboard-segment ${activeTab === tab.key ? "active" : ""}`}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <label className="leaderboard-sorter">
                  <span>Sort By</span>
                  <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                    {sortOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="leaderboard-table-wrap">
                <table className="leaderboard-table leaderboard-table-clean">
                  <thead>
                    <tr>
                      <th style={{ width: "72px" }}>Rank</th>
                      <th>Model</th>
                      <th style={{ width: "138px" }}>Avg. Coverage</th>
                      <th style={{ width: "138px" }}>Best Pass Rate</th>
                      <th style={{ width: "138px" }}>Min. Coverage</th>
                      <th style={{ width: "128px" }}>Avg. Tokens (M)</th>
                      <th style={{ width: "128px" }}>Total Tokens (M)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedRecords.map((record, index) => (
                      <tr key={record.id}>
                        <td className="leaderboard-rank-cell">{index + 1}</td>
                        <td>
                          <div className="leaderboard-model-cell">
                            <div className="leaderboard-model-name">{record.name}</div>
                            <div className="leaderboard-model-meta">
                              {record.provider} | {record.model}
                            </div>
                          </div>
                        </td>
                        <td className={sortKey === "avgRequirementRate" ? "leaderboard-metric-active" : ""}>
                          {formatPercent(record.avgRequirementRate)}
                        </td>
                        <td className={sortKey === "maxPassRate" ? "leaderboard-metric-active" : ""}>
                          {formatPercent(record.maxPassRate)}
                        </td>
                        <td className={sortKey === "minRequirementRate" ? "leaderboard-metric-active" : ""}>
                          {formatPercent(record.minRequirementRate)}
                        </td>
                        <td className={sortKey === "avgTokenUsage" ? "leaderboard-metric-active" : ""}>
                          {formatToken(record.avgTokenUsage)}
                        </td>
                        <td className={sortKey === "totalTokenUsage" ? "leaderboard-metric-active" : ""}>
                          {formatToken(record.totalTokenUsage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>

        <section className="home-recent-panel">
          <div className="home-section-header">
            <div>
              <div className="leaderboard-clean-title">Recent Submissions</div>
              <div className="leaderboard-clean-subtitle">
                {user
                  ? "Latest runs from your account, with custom submission names when provided."
                  : "Login to see your recent runs and private submission history."}
              </div>
            </div>
            <Link className="inline-link" to={user ? "/requirements" : "/login"}>
              {user ? "Browse competitions" : "Login"}
            </Link>
          </div>

          {!user && !isLoading ? (
            <div className="empty-state">Login to view your submission history.</div>
          ) : submissions.length === 0 ? (
            <div className="empty-state">No submissions yet.</div>
          ) : (
            <div className="recent-list-grid">
              {submissions.map((submission) => (
                <Link key={submission.id} to={`/submissions/${submission.id}`} className="recent-card">
                  <div className="recent-card-top">
                    <div>
                      <div className="recent-card-title">{submissionTitle(submission)}</div>
                      <div className="recent-card-subtitle">{submission.id}</div>
                    </div>
                    <div
                      className={`test-badge ${submission.status === "PASSED" ? "pass" : submission.status === "FAILED" ? "fail" : "pending"}`}
                    >
                      {submission.status}
                    </div>
                  </div>
                  <div className="recent-card-meta">
                    <span>{submission.requirement_id}</span>
                    <span>{submission.runtime}</span>
                    <span>{new Date(submission.created_at).toLocaleString()}</span>
                  </div>
                  <div className="recent-card-score-row">
                    <span className="recent-card-score-label">Score</span>
                    <span className="recent-card-score-value">
                      {submission.score == null ? "--" : submission.score.toFixed(1)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
