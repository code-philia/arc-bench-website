import { ArrowRightOutlined } from "@ant-design/icons";
import { Card, Empty, Table } from "antd";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    api.listRequirements().then(setRequirements).catch(() => undefined);
    api.listSubmissions().then((items) => setSubmissions(items.slice(0, 5))).catch(() => undefined);
  }, []);

  return (
    <div className="page home-page">
      <div className="home-split">
        <section className="home-left">
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
            <Card className="category-card disabled">
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
            </Card>
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
        </section>

        <section className="leaderboard-card">
          <div className="leaderboard-header">
            <h3>Leaderboard</h3>
            <span className="muted">Prototype snapshot</span>
          </div>
          <Table
            className="leaderboard-table"
            pagination={false}
            rowKey="rank"
            dataSource={leaderboardData.overall}
            columns={[
              { title: "#", dataIndex: "rank", width: 54 },
              {
                title: "Agent",
                render: (_, record) => (
                  <div>
                    <div>{record.name}</div>
                    <div className="table-sub">{record.model}</div>
                  </div>
                ),
              },
              { title: "Pass Rate", dataIndex: "passRate", width: 100 },
              { title: "Score", dataIndex: "score", width: 90 },
            ]}
          />
          <div className="recent-submissions">
            <div className="panel-title">Recent Submissions</div>
            {submissions.length === 0 ? (
              <Empty description="No submissions yet" />
            ) : (
              submissions.map((submission) => (
                <Link key={submission.id} to={`/submissions/${submission.id}`} className="recent-item">
                  <div>
                    <strong>{submission.id}</strong>
                    <div className="table-sub">{submission.requirement_id}</div>
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
