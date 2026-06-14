import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../lib/api";
import type { RequirementSummary } from "../lib/types";

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

function normalizeTaskType(value: string): PlaygroundTaskType | null {
  if (value === "web" || value === "mobile" || value === "kernel" || value === "mixed") {
    return value;
  }
  return null;
}

export default function PlaygroundTaskListPage() {
  const { taskType: rawTaskType = "" } = useParams();
  const navigate = useNavigate();
  const taskType = normalizeTaskType(rawTaskType);
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskType) {
      setLoading(false);
      setRequirements([]);
      return;
    }

    api
      .listRequirements()
      .then(setRequirements)
      .catch(() => setRequirements([]))
      .finally(() => setLoading(false));
  }, [taskType]);

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

  const totalTests = useMemo(() => tasks.reduce((sum, task) => sum + task.total_tests, 0), [tasks]);

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
              <span>Playground</span>
              <span className="sep">/</span>
              <span>Task Bank</span>
              <span className="sep">/</span>
              <span className="current">{typeLabel(taskType)}</span>
            </div>
            <div className="competition-type-chip large">{typeChipLabel(taskType)}</div>
            <h1>{typeLabel(taskType)}</h1>
            <p>{typeSummary(taskType, tasks.length)}</p>
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
                <strong>arc-bench</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="task-table-wrap competition-task-table-wrap">
          {tasks.length === 0 ? (
            <div className="empty-state">No tasks available for this type yet.</div>
          ) : (
            <table className="task-table">
              <thead>
                <tr>
                  <th style={{ width: "120px" }}>ID</th>
                  <th>Task</th>
                  <th style={{ width: "120px" }}>Category</th>
                  <th style={{ width: "110px" }}>Modules</th>
                  <th style={{ width: "100px" }}>Tests</th>
                  <th style={{ width: "120px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} onClick={() => navigate(`/playground/task-bank/${taskType}/${task.id}`)}>
                    <td className="task-id">{task.id}</td>
                    <td>
                      <div className="task-name">
                        <Link className="inline-link" to={`/playground/task-bank/${taskType}/${task.id}`}>
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
                    <td>
                      <span className="status-dot completed">Ready</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
