import { DownloadOutlined, RightOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { api } from "../lib/api";
import type { BenchmarkDetail, RequirementSummary } from "../lib/types";
import { QUICK_START_REQUIREMENT_ID, QUICK_START_TASK_TYPE } from "../quickstart/constants";
import { useQuickStart } from "../quickstart/QuickStartContext";

type PlaygroundTaskType = "web" | "mobile" | "kernel" | "mixed";

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

function taskAccentClass(category: string) {
  if (category === "android") return "mobile";
  if (category === "web" || category === "mobile" || category === "kernel" || category === "mixed") return category;
  return "mixed";
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
    <div className="page library-page">
      <div className="competition-shell">
        <section className="competition-detail-hero">
          <div className="competition-detail-copy">
            <div className="breadcrumb">
              {isCompetitionRoute ? (
                <>
                  <span>Competition</span>
                  <span className="sep">/</span>
                  <span>Task Bank</span>
                  <span className="sep">/</span>
                  <span className="current">{typeLabel(taskType)}</span>
                </>
              ) : isBenchmarkRoute ? (
                <>
                  <span>Playground</span>
                  <span className="sep">/</span>
                  <span>ARC-Bench</span>
                  <span className="sep">/</span>
                  <span className="current">{typeLabel(taskType)}</span>
                </>
              ) : (
                <>
                  <span>Playground</span>
                  <span className="sep">/</span>
                  <span>Task Bank</span>
                  <span className="sep">/</span>
                  <span className="current">{typeLabel(taskType)}</span>
                </>
              )}
            </div>
            <div className="competition-type-chip large">{typeChipLabel(taskType)}</div>
            <h1>{isBenchmarkRoute ? `ARC-Bench / ${typeLabel(taskType)}` : typeLabel(taskType)}</h1>
            <p>{isBenchmarkRoute ? (benchmark?.summary ?? typeSummary(taskType, tasks.length)) : typeSummaryForSource(taskType, tasks.length, isCompetitionRoute)}</p>
          </div>
          <div className="competition-detail-side">
            <div className="competition-stat-panel">
              <div className="competition-stat-row">
                <span>Tasks</span>
                <strong>{tasks.length}</strong>
              </div>
              <div className="competition-stat-row">
                <span>Tests</span>
                <strong>{totalTests}</strong>
              </div>
              <div className="competition-stat-row">
                <span>Source</span>
                <strong>{isBenchmarkRoute ? "arc-bench" : sourceLabel(isCompetitionRoute)}</strong>
              </div>
            </div>
            {isBenchmarkRoute && benchmark?.downloads?.track_bundle ? (
              <a className="btn-outline competition-download-btn" href={benchmark.downloads.track_bundle}>
                Download Bundle
              </a>
            ) : null}
          </div>
        </section>

        <section className="task-table-wrap competition-task-table-wrap">
          {orderedTasks.length === 0 ? (
            <div className="empty-state">No tasks available for this type yet.</div>
          ) : (
            <table className="task-table task-resource-table">
              <thead>
                <tr>
                  <th style={{ width: "156px" }}>ID</th>
                  <th>Task</th>
                  <th style={{ width: "120px" }}>Category</th>
                  <th style={{ width: "110px" }}>REQs</th>
                  <th style={{ width: "100px" }}>Tests</th>
                  {isBenchmarkRoute ? <th style={{ width: "92px" }}>Download</th> : null}
                  <th style={{ width: "52px" }}>
                    <span className="visually-hidden">Open task</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderedTasks.map((task, index) => {
                  const taskHref = isCompetitionRoute
                    ? `/requirements/${task.id}`
                    : isBenchmarkRoute
                      ? `/playground/arc-bench/${taskType}/${task.id}`
                      : `/playground/task-bank/${taskType}/${task.id}`;

                  return (
                    <tr
                      key={task.id}
                      className={`task-resource-row ${taskAccentClass(task.category)}`}
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
                      <td className="task-id">{task.display_id}</td>
                      <td>
                        <div className="task-name">
                          <Link className="inline-link" to={taskHref}>
                            {task.title}
                          </Link>
                          <span className="sub">{task.summary}</span>
                        </div>
                      </td>
                      <td>
                        <span className="model-chip">{task.category}</span>
                      </td>
                      <td>{task.module_count}</td>
                      <td>{task.total_tests}</td>
                      {isBenchmarkRoute ? (
                        <td onClick={(event) => event.stopPropagation()}>
                          {hasBenchmarkDownload(task) && task.downloads?.task_bundle ? (
                            <a
                              className="benchmark-task-download-button"
                              href={task.downloads.task_bundle}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Download ${task.title}`}
                            >
                              <DownloadOutlined />
                              <span>ZIP</span>
                            </a>
                          ) : (
                            <span className="benchmark-task-download-button disabled">N/A</span>
                          )}
                        </td>
                      ) : null}
                      <td>
                        <span className="task-row-action" aria-hidden="true">
                          <RightOutlined />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
