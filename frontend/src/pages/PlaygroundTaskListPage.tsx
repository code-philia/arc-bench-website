import { DownloadOutlined, RightOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { api } from "../lib/api";
import type { BenchmarkDetail, RequirementSummary } from "../lib/types";
import { QUICK_START_REQUIREMENT_ID, QUICK_START_TASK_TYPE } from "../quickstart/constants";
import { useQuickStart } from "../quickstart/QuickStartContext";

type PlaygroundTaskType = "web" | "mobile" | "kernel" | "mixed";

const taskToneClasses: Record<string, { badge: string; row: string }> = {
  web: {
    badge: "bg-[var(--accent-glow)] text-[var(--accent)]",
    row: "hover:border-[var(--accent)]",
  },
  mobile: {
    badge: "bg-[var(--warn-glow)] text-[var(--warn)]",
    row: "hover:border-[var(--warn)]",
  },
  android: {
    badge: "bg-[var(--warn-glow)] text-[var(--warn)]",
    row: "hover:border-[var(--warn)]",
  },
  kernel: {
    badge: "bg-[var(--fail-glow)] text-[var(--fail)]",
    row: "hover:border-[var(--fail)]",
  },
  mixed: {
    badge: "bg-[var(--bg-elevated)] text-[var(--text-dim)]",
    row: "hover:border-[var(--border-light)]",
  },
};

function typeLabel(type: PlaygroundTaskType) {
  if (type === "web") return "Web Applications";
  if (type === "mobile") return "Mobile Applications";
  if (type === "kernel") return "Kernel Operators";
  return "Mixed Tasks";
}

function typeChipLabel(type: PlaygroundTaskType) {
  if (type === "web") return "Web";
  if (type === "mobile") return "Mobile";
  if (type === "kernel") return "Kernel";
  return "Mixed";
}

function typeSummary(type: PlaygroundTaskType, taskCount: number) {
  if (type === "web") {
    return `Interactive benchmark tasks discovered from arc-bench for the web track, with ${taskCount} task${taskCount === 1 ? "" : "s"} currently available.`;
  }
  if (type === "mobile") {
    return `Mobile benchmark tasks discovered from arc-bench, with ${taskCount} task${taskCount === 1 ? "" : "s"} currently available.`;
  }
  if (type === "kernel") {
    return `Kernel and operator style tasks discovered from arc-bench, with ${taskCount} task${taskCount === 1 ? "" : "s"} currently available.`;
  }
  return `Mixed benchmark tasks discovered from arc-bench, with ${taskCount} task${taskCount === 1 ? "" : "s"} currently available.`;
}

function sourceLabel(isCompetitionRoute: boolean) {
  return isCompetitionRoute ? "arc-bench" : "arc-bench-playground";
}

function typeSummaryForSource(type: PlaygroundTaskType, taskCount: number, isCompetitionRoute: boolean) {
  const source = sourceLabel(isCompetitionRoute);
  if (type === "web") {
    return `Interactive benchmark tasks discovered from ${source} for the web track, with ${taskCount} task${taskCount === 1 ? "" : "s"} currently available.`;
  }
  if (type === "mobile") {
    return `Mobile benchmark tasks discovered from ${source}, with ${taskCount} task${taskCount === 1 ? "" : "s"} currently available.`;
  }
  if (type === "kernel") {
    return `Kernel and operator style tasks discovered from ${source}, with ${taskCount} task${taskCount === 1 ? "" : "s"} currently available.`;
  }
  return `Mixed benchmark tasks discovered from ${source}, with ${taskCount} task${taskCount === 1 ? "" : "s"} currently available.`;
}

function normalizeTaskType(value: string): PlaygroundTaskType | null {
  if (value === "web" || value === "mobile" || value === "kernel" || value === "mixed") {
    return value;
  }
  return null;
}

function hasBenchmarkDownload(task: RequirementSummary): task is BenchmarkDetail["tasks"][number] {
  return "downloads" in task;
}

function toneFor(category: string) {
  return taskToneClasses[category] ?? taskToneClasses.mixed;
}

export default function PlaygroundTaskListPage() {
  const { taskType: rawTaskType = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isCompetitionRoute = location.pathname.startsWith("/competitions/");
  const isBenchmarkRoute = location.pathname.startsWith("/playground/arc-bench/");
  const taskType = normalizeTaskType(isCompetitionRoute ? rawTaskType || "web" : rawTaskType);
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const quickStart = useQuickStart();

  useEffect(() => {
    quickStart.syncStepForRoute();
  }, [quickStart, taskType]);

  useEffect(() => {
    if (!taskType) {
      setLoading(false);
      setRequirements([]);
      return;
    }

    if (isBenchmarkRoute && taskType) {
      api
        .getBenchmark(taskType)
        .then((detail) => {
          setBenchmark(detail);
          setRequirements(detail.tasks);
        })
        .catch(() => {
          setBenchmark(null);
          setRequirements([]);
        })
        .finally(() => setLoading(false));
      return;
    }

    api
      .listRequirements(isCompetitionRoute ? "competition" : "playground")
      .then((items) => {
        setBenchmark(null);
        setRequirements(items);
      })
      .catch(() => setRequirements([]))
      .finally(() => setLoading(false));
  }, [isBenchmarkRoute, isCompetitionRoute, taskType]);

  const tasks = useMemo(() => {
    if (!taskType) {
      return [];
    }

    if (taskType === "mobile") {
      return requirements.filter((item) => item.category === "android" || item.category === "mobile");
    }

    if (taskType === "mixed") {
      return requirements;
    }

    return requirements.filter((item) => item.category === taskType);
  }, [requirements, taskType]);

  const orderedTasks = useMemo(() => {
    if (isBenchmarkRoute) {
      return tasks;
    }
    if (taskType !== QUICK_START_TASK_TYPE) {
      return tasks;
    }
    const priority = tasks.find((task) => task.id === QUICK_START_REQUIREMENT_ID);
    if (!priority) {
      return tasks;
    }
    return [priority, ...tasks.filter((task) => task.id !== QUICK_START_REQUIREMENT_ID)];
  }, [isBenchmarkRoute, taskType, tasks]);

  const totalTests = useMemo(() => orderedTasks.reduce((sum, task) => sum + task.total_tests, 0), [orderedTasks]);
  const rowGridClassName = isBenchmarkRoute
    ? "lg:grid-cols-[132px_minmax(0,1fr)_110px_86px_86px_96px_34px]"
    : "lg:grid-cols-[132px_minmax(0,1fr)_110px_86px_86px_34px]";

  if (!taskType) {
    return (
      <div className="page centered">
        <div className="empty-state">Task type not found.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page centered">
        <div className="loading-state">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="page bg-[var(--bg-deep)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-6 lg:px-8">
        <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
            {isCompetitionRoute ? (
              <>
                <span>Competition</span>
                <span className="text-[var(--border-light)]">/</span>
                <span>Task Bank</span>
                <span className="text-[var(--border-light)]">/</span>
                <span className="font-medium text-[var(--text)]">{typeLabel(taskType)}</span>
              </>
            ) : isBenchmarkRoute ? (
              <>
                <span>Playground</span>
                <span className="text-[var(--border-light)]">/</span>
                <span>ARC-Bench</span>
                <span className="text-[var(--border-light)]">/</span>
                <span className="font-medium text-[var(--text)]">{typeLabel(taskType)}</span>
              </>
            ) : (
              <>
                <span>Playground</span>
                <span className="text-[var(--border-light)]">/</span>
                <span>Task Bank</span>
                <span className="text-[var(--border-light)]">/</span>
                <span className="font-medium text-[var(--text)]">{typeLabel(taskType)}</span>
              </>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneFor(taskType).badge}`}>
                {typeChipLabel(taskType)}
              </div>
              <h1 className="mt-4 text-3xl font-semibold leading-tight text-[var(--text)] sm:text-4xl">
                {isBenchmarkRoute ? `ARC-Bench / ${typeLabel(taskType)}` : typeLabel(taskType)}
              </h1>
              <p className="mt-3 max-w-[760px] text-sm leading-6 text-[var(--text-dim)]">
                {isBenchmarkRoute
                  ? (benchmark?.summary ?? typeSummary(taskType, tasks.length))
                  : typeSummaryForSource(taskType, tasks.length, isCompetitionRoute)}
              </p>
            </div>

            <aside className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-[var(--bg)] px-4 py-3">
                  <span className="text-[var(--text-dim)]">Tasks</span>
                  <strong className="text-lg font-semibold text-[var(--text)]">{tasks.length}</strong>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[var(--bg)] px-4 py-3">
                  <span className="text-[var(--text-dim)]">Tests</span>
                  <strong className="text-lg font-semibold text-[var(--text)]">{totalTests}</strong>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[var(--bg)] px-4 py-3">
                  <span className="text-[var(--text-dim)]">Source</span>
                  <strong className="text-sm font-semibold text-[var(--text)]">
                    {isBenchmarkRoute ? "arc-bench" : sourceLabel(isCompetitionRoute)}
                  </strong>
                </div>
              </div>
              {isBenchmarkRoute && benchmark?.downloads?.track_bundle ? (
                <a
                  className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  href={benchmark.downloads.track_bundle}
                >
                  Download Bundle
                </a>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          {orderedTasks.length === 0 ? (
            <div className="m-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5 text-sm text-[var(--text-dim)]">
              No tasks available for this type yet.
            </div>
          ) : (
            <div className="bg-[var(--bg)]">
              <div
                className={`hidden gap-3 border-b border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-xs font-semibold uppercase text-[var(--text-muted)] lg:grid ${rowGridClassName}`}
              >
                <span>ID</span>
                <span>Task</span>
                <span>Category</span>
                <span>REQs</span>
                <span>Tests</span>
                {isBenchmarkRoute ? <span>Download</span> : null}
                <span />
              </div>

              {orderedTasks.map((task, index) => {
                const taskHref = isCompetitionRoute
                  ? `/requirements/${task.id}`
                  : isBenchmarkRoute
                    ? `/playground/arc-bench/${taskType}/${task.id}`
                    : `/playground/task-bank/${taskType}/${task.id}`;
                const tone = toneFor(task.category);

                return (
                  <div
                    key={task.id}
                    className={`group grid cursor-pointer gap-3 border-b border-[var(--td-border)] bg-[var(--bg)] px-4 py-3 text-sm transition duration-200 last:border-b-0 hover:bg-[var(--bg-elevated)] ${rowGridClassName}`}
                    data-quickstart-id={index === 0 ? "quickstart-task-item" : undefined}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(taskHref)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(taskHref);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">{task.display_id}</span>
                    </div>

                    <div className="min-w-0">
                      <Link
                        className="font-semibold text-[var(--text)] hover:text-[var(--accent)]"
                        to={taskHref}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {task.title}
                      </Link>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-dim)]">{task.summary}</span>
                    </div>

                    <div className="flex items-center">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                        {task.category}
                      </span>
                    </div>
                    <div className="flex items-center text-sm font-medium text-[var(--text-dim)]">{task.module_count}</div>
                    <div className="flex items-center text-sm font-medium text-[var(--text-dim)]">{task.total_tests}</div>

                    {isBenchmarkRoute ? (
                      <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
                        {hasBenchmarkDownload(task) && task.downloads?.task_bundle ? (
                          <a
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            href={task.downloads.task_bundle}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Download ${task.title}`}
                          >
                            <DownloadOutlined />
                            <span>ZIP</span>
                          </a>
                        ) : (
                          <span className="inline-flex h-8 items-center rounded-full bg-[var(--bg)] px-3 text-xs text-[var(--text-muted)]">
                            N/A
                          </span>
                        )}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-end text-[var(--text-muted)] group-hover:text-[var(--text)]">
                      <RightOutlined className="transition group-hover:translate-x-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
