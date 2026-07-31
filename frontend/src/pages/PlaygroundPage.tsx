import { FileTextOutlined, GlobalOutlined, PlayCircleOutlined, RightOutlined, StarOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GithubOutlined } from "@ant-design/icons";

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

const toneClasses: Record<string, { badge: string; icon: string; border: string }> = {
  web: {
    badge: "bg-[var(--accent-glow)] text-[var(--accent)]",
    icon: "bg-[var(--accent-glow)] text-[var(--accent)]",
    border: "hover:border-[var(--accent)]",
  },
  mobile: {
    badge: "bg-[var(--warn-glow)] text-[var(--warn)]",
    icon: "bg-[var(--warn-glow)] text-[var(--warn)]",
    border: "hover:border-[var(--warn)]",
  },
  kernel: {
    badge: "bg-[var(--fail-glow)] text-[var(--fail)]",
    icon: "bg-[var(--fail-glow)] text-[var(--fail)]",
    border: "hover:border-[var(--fail)]",
  },
  mixed: {
    badge: "bg-[var(--bg-elevated)] text-[var(--text-dim)]",
    icon: "bg-[var(--bg-elevated)] text-[var(--text)]",
    border: "hover:border-[var(--border-light)]",
  },
};

function toneFor(tone: string) {
  return toneClasses[tone] ?? toneClasses.web;
}

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
    <div className="page landing-page playground-home-page bg-[var(--bg-deep)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-6 lg:px-8">
        <div className="mb-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>Playground</span>
          <span className="text-[var(--border-light)]">/</span>
          <span className="font-medium text-[var(--text)]">Home</span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="landing-hero landing-card tone-mint rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:p-6">
            <div className="space-y-5">
              <div>
                <div className="text-xs font-semibold uppercase text-[var(--accent)]">Agent engineering workspace</div>
                <h1 className="mt-3 text-3xl font-semibold leading-tight text-[var(--text)] sm:text-4xl">
                  Welcome back, {welcomeName}!
                </h1>
                <p className="mt-3 max-w-[620px] text-sm leading-6 text-[var(--text-dim)]">
                  Build requirements, run agents, and inspect traceable benchmark evidence in one production workflow.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  className="landing-card tone-mint group rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent-glow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  onClick={start}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-glow)] text-lg text-[var(--accent)]">
                      <PlayCircleOutlined />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase text-[var(--text-muted)]">Interactive drafting</span>
                      <span className="mt-1 block text-lg font-semibold text-[var(--text)]">Quick Start</span>
                      <span className="mt-2 block text-sm leading-6 text-[var(--text-dim)]">
                        Learn about requirement trees, upload your agent, and run the benchmark workflow end to end.
                      </span>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">
                        Start guided flow <RightOutlined className="transition group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </div>
                </button>

                <Link
                  to="/playground/create-task"
                  className="landing-card tone-amber group rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-light)] hover:bg-[var(--bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg)] text-lg text-[var(--text)]">
                      <FileTextOutlined />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase text-[var(--text-muted)]">Custom task authoring</span>
                      <span className="mt-1 block text-lg font-semibold text-[var(--text)]">Create Task</span>
                      <span className="mt-2 block text-sm leading-6 text-[var(--text-dim)]">
                        Design your own app requirements and upload project material for future task generation workflows.
                      </span>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">
                        Open editor <RightOutlined className="transition group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          <aside className="landing-card tone-sky rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]" aria-label="Task bank">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold text-[var(--text)]">Task Bank</div>
              <Link className="text-sm font-medium text-[var(--text-dim)] hover:text-[var(--accent)]" to="/playground/task-bank/web">
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {taskBankItems.map((item) => {
                const countText = item.key === "web" && !loading ? `${webTaskCount} tasks` : null;
                const tone = toneFor(item.tone);
                const itemClassName = [
                  "group flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 transition duration-200",
                  tone.border,
                  item.disabled ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5 hover:bg-[var(--bg-hover)]",
                ].join(" ");

                if (item.disabled) {
                  return (
                    <div key={item.key} className={itemClassName} aria-disabled="true">
                      <div className="min-w-0">
                        <div className={`mb-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                          {item.badge}
                        </div>
                        <h2 className="text-sm font-semibold text-[var(--text)]">{item.title}</h2>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{item.description}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    className={itemClassName}
                    data-quickstart-id={item.key === "web" ? "quickstart-task-type-web" : undefined}
                  >
                    <div className="min-w-0">
                      <div className={`mb-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                        {item.badge}
                      </div>
                      <h2 className="text-sm font-semibold text-[var(--text)]">{item.title}</h2>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{item.description}</p>
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--text-dim)] group-hover:text-[var(--text)]">
                      <span>{countText ?? "Browse"}</span>
                      <RightOutlined />
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>

        <section className="landing-card tone-amber mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)]" aria-label="ARC-Bench">
          <div className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--warn-glow)] text-[var(--warn)]" aria-hidden="true">
                <StarOutlined />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">ARC-BENCH</div>
                <p className="mt-1 max-w-[760px] text-sm leading-6 text-[var(--text-dim)]">
                  Public benchmark tracks from arc-bench, packaged with requirement documents, tests, references, and starter project context.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-grad-end)]" to={benchmarkBrowseHref}>
                View all benchmarks
              </Link>
              <a
                className="inline-flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-dim)] transition hover:border-[var(--border-light)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                href="https://github.com/code-philia/ARC.git"
                target="_blank"
                rel="noreferrer"
                aria-label="Open ARC GitHub repository"
              >
                <GithubOutlined />
                GitHub repo
              </a>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {benchmarkLoading ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5 text-sm text-[var(--text-dim)]">
                Loading ARC-Bench tracks...
              </div>
            ) : benchmarkItems.length === 0 ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5 text-sm text-[var(--text-dim)]">
                No ARC-Bench tracks available.
              </div>
            ) : (
              benchmarkItems.map((item) => {
                const tone = toneFor(item.tone);

                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    className={`group rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--bg-hover)] ${tone.border}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${tone.icon}`} aria-hidden="true">
                        <GlobalOutlined />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-[var(--text)]">
                          <span className="text-[var(--text-dim)]">arc-bench</span>
                          <span className="text-[var(--text-muted)]">/</span>
                          <span>{item.title}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>{item.badge}</span>
                          <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--text-dim)]">{item.meta}</span>
                          <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--text-dim)]">benchmark</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--text-dim)]">{item.summary}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                          <span>{item.task_count} tasks</span>
                          <span>|</span>
                          <span>{item.total_tests} tests</span>
                          <span>|</span>
                          <span>Browse</span>
                          <RightOutlined className="transition group-hover:translate-x-0.5 group-hover:text-[var(--text)]" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
