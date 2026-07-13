import { FileTextOutlined, GlobalOutlined, PlayCircleOutlined, RightOutlined, StarOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { BenchmarkSummary, RequirementSummary } from "../lib/types";
import { useQuickStart } from "../quickstart/QuickStartContext";

type TaskCategory = "web" | "mobile" | "kernel" | "mixed";

type TaskBankItem = {
  key: TaskCategory;
  title: string;
  description: string;
  badge: string;
  tone: string;
  href: string;
  disabled?: boolean;
};

const taskBankItems: TaskBankItem[] = [
  {
    key: "web",
    title: "Web Applications",
    description: "Full-stack web tasks backed by executable Playwright suites",
    badge: "WEB",
    tone: "web",
    href: "/playground/task-bank/web",
  },
  {
    key: "mobile",
    title: "Mobile Applications",
    description: "Coming task packs for mobile agent evaluation workflows",
    badge: "MOBILE",
    tone: "mobile",
    href: "/playground/task-bank/mobile",
  },
  {
    key: "kernel",
    title: "Kernel Operators",
    description: "Planned system-level task tracks for operator-style agents",
    badge: "KERNEL",
    tone: "kernel",
    href: "/playground/task-bank/kernel",
  },
  {
    key: "mixed",
    title: "My Tasks",
    description: "Tasks created by yourself",
    badge: "MIXED",
    tone: "mixed",
    href: "/playground/my-tasks",
  },
];

export default function PlaygroundPage() {
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [benchmarkLoading, setBenchmarkLoading] = useState(true);
  const { start } = useQuickStart();
  const { user } = useAuth();

  useEffect(() => {
    api
      .listRequirements()
      .then(setRequirements)
      .catch(() => setRequirements([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api
      .listBenchmarks()
      .then(setBenchmarks)
      .catch(() => setBenchmarks([]))
      .finally(() => setBenchmarkLoading(false));
  }, []);

  const webTaskCount = useMemo(() => requirements.filter((item) => item.category === "web").length, [requirements]);
  const welcomeName = useMemo(() => {
    const username = user?.username?.trim();
    if (username) {
      return username;
    }
    const emailPrefix = user?.email?.split("@")[0]?.trim();
    return emailPrefix || "Builder";
  }, [user?.email, user?.username]);
  const benchmarkItems = useMemo(
    () =>
      benchmarks.filter((item) => item.type === "web" || item.type === "mobile").map((item) => ({
        ...item,
        href: `/playground/arc-bench/${item.type === "android" ? "mobile" : item.type}`,
        badge: item.type === "web" ? "WEB" : "MOBILE",
        tone: item.type === "web" ? "web" : "mobile",
        meta: item.type === "web" ? "Playwright" : "Android / Mobile",
      })),
    [benchmarks],
  );
  const benchmarkBrowseHref = benchmarkItems[0]?.href ?? "/playground/arc-bench/web";

  return (
    <div className="page playground-page playground-home-page">
      <div className="playground-shell playground-home-shell">
        <div className="breadcrumb playground-breadcrumb">
          <span>Playground</span>
          <span className="sep">/</span>
          <span className="current">Home</span>
        </div>

        <div className="playground-home-grid">
          <section className="playground-home-hero" aria-label="Playground quick actions">
            <div className="playground-home-welcome">
              <h1>Welcome back, {welcomeName}!</h1>
              <p>Build, test, and benchmark your AI agents.</p>
            </div>

            <div className="playground-actions">
              <button type="button" className="playground-entry-card playground-entry-card-quick" onClick={start}>
                <div className="playground-entry-card-icon playground">
                  <PlayCircleOutlined />
                </div>
                <div className="playground-entry-card-copy">
                  <div className="playground-entry-kicker">Interactive drafting</div>
                  <h2>Quick Start</h2>
                  <p>Learn about requirement trees, upload your agent, and run the benchmark workflow end to end.</p>
                </div>
              </button>

              <Link to="/playground/create-task" className="playground-entry-card playground-entry-card-create">
                <div className="playground-entry-card-icon research">
                  <FileTextOutlined />
                </div>
                <div className="playground-entry-card-copy">
                  <div className="playground-entry-kicker">Custom task authoring</div>
                  <h2>Create Task</h2>
                  <p>Design your own app requirements and upload project material for future task generation workflows.</p>
                </div>
              </Link>
            </div>
          </section>

          <aside className="playground-bank" aria-label="Task bank">
            <div className="playground-bank-shell">
              <div className="playground-bank-head">
                <div className="playground-bank-title">Task Bank</div>
                <Link className="playground-bank-view-all" to="/playground/task-bank/web">
                  View all
                </Link>
              </div>
              <div className="playground-bank-list">
                {taskBankItems.map((item) => {
                  const countText = item.key === "web" && !loading ? `${webTaskCount} tasks` : null;

                  if (item.disabled) {
                    return (
                      <div key={item.key} className={`playground-bank-item is-disabled ${item.tone}`} aria-disabled="true">
                        <div className="playground-bank-item-copy">
                          <div className={`playground-bank-badge ${item.tone}`}>{item.badge}</div>
                          <h2>{item.title}</h2>
                          <p>{item.description}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.key}
                      to={item.href}
                      className={`playground-bank-item ${item.tone}`}
                      data-quickstart-id={item.key === "web" ? "quickstart-task-type-web" : undefined}
                    >
                      <div className="playground-bank-item-copy">
                        <div className={`playground-bank-badge ${item.tone}`}>{item.badge}</div>
                        <h2>{item.title}</h2>
                        <p>{item.description}</p>
                      </div>
                      <div className="playground-bank-meta">
                        <span>{countText ?? "Browse"}</span>
                        <RightOutlined />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        <section className="playground-benchmark-section" aria-label="ARC-Bench">
          <div className="playground-benchmark-header">
            <div className="playground-benchmark-summary">
              <div className="playground-benchmark-summary-icon" aria-hidden="true">
                <StarOutlined />
              </div>
              <div className="playground-benchmark-summary-copy">
                <div className="playground-benchmark-title">ARC-BENCH</div>
                <p className="playground-benchmark-copy">
                  Public benchmark tracks from 'arc-bench', packaged with requirement documents, tests, references, and starter project context.
                </p>
              </div>
            </div>
            <Link className="playground-bank-view-all" to={benchmarkBrowseHref}>
              View all benchmarks
            </Link>
          </div>
          <div className="playground-benchmark-card-grid">
            {benchmarkLoading ? (
              <div className="loading-state competition-bank-state">Loading ARC-Bench tracks...</div>
            ) : benchmarkItems.length === 0 ? (
              <div className="empty-state competition-bank-state">No ARC-Bench tracks available.</div>
            ) : (
              benchmarkItems.map((item) => (
                <Link key={item.id} to={item.href} className={`playground-benchmark-card ${item.tone}`}>
                  <div className={`playground-benchmark-card-icon ${item.tone}`} aria-hidden="true">
                    <GlobalOutlined />
                  </div>
                  <div className="playground-benchmark-card-main">
                    <div className="playground-benchmark-card-repo">
                      <span className="playground-benchmark-card-namespace">arc-bench</span>
                      <span className="playground-benchmark-card-slash">/</span>
                      <span className="playground-benchmark-card-name">{item.title}</span>
                    </div>
                    <div className="playground-benchmark-card-tags">
                      <span className={`playground-bank-badge ${item.tone}`}>{item.badge}</span>
                      <span className="playground-benchmark-tag">{item.meta}</span>
                      <span className="playground-benchmark-tag">benchmark</span>
                    </div>
                    <p className="playground-benchmark-card-summary">{item.summary}</p>
                    <div className="playground-benchmark-card-meta">
                      <span>{item.task_count} tasks</span>
                      <span className="playground-benchmark-meta-sep">|</span>
                      <span>{item.total_tests} tests</span>
                      <span className="playground-benchmark-meta-sep">|</span>
                      <span>Browse</span>
                      <div className="playground-bank-meta">
                        <RightOutlined />
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
