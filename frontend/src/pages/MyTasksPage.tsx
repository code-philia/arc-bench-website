import { FileTextOutlined, PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { UserTaskSummary } from "../lib/types";

function typeLabel(type: string) {
  if (type === "web") return "Web";
  if (type === "mobile") return "Mobile";
  if (type === "kernel") return "Kernel";
  if (type === "mixed") return "Mixed";
  if (type === "cli") return "CLI";
  return type;
}

export default function MyTasksPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [tasks, setTasks] = useState<UserTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }
    api
      .listMyTasks()
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [user]);

  const stats = useMemo(() => {
    return {
      count: tasks.length,
      nodes: tasks.reduce((sum, task) => sum + task.node_count, 0),
      atomic: tasks.reduce((sum, task) => sum + task.atomic_count, 0),
    };
  }, [tasks]);

  if (!isLoading && !user) {
    return (
      <div className="page centered">
        <div className="empty-state">Login to view your personal tasks.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page centered">
        <div className="loading-state">Loading your tasks...</div>
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
              <span className="current">My Tasks</span>
            </div>
            <div className="competition-type-chip large">Personal Bank</div>
            <h1>My Tasks</h1>
            <p>Task requirements that you created from the Playground authoring flow.</p>
          </div>
          <div className="competition-detail-side">
            <div className="competition-stat-panel">
              <div className="competition-stat-row">
                <span>Tasks</span>
                <strong>{stats.count}</strong>
              </div>
              <div className="competition-stat-row">
                <span>Total Nodes</span>
                <strong>{stats.nodes}</strong>
              </div>
              <div className="competition-stat-row">
                <span>Atomic Items</span>
                <strong>{stats.atomic}</strong>
              </div>
            </div>
            <Link className="btn-outline competition-download-btn" to="/playground/create-task">
              <PlusOutlined /> Create New Task
            </Link>
          </div>
        </section>

        <section className="task-table-wrap competition-task-table-wrap">
          {tasks.length === 0 ? (
            <div className="empty-state">No custom tasks yet.</div>
          ) : (
            <table className="task-table">
              <thead>
                <tr>
                  <th style={{ width: "180px" }}>ID</th>
                  <th>Task</th>
                  <th style={{ width: "120px" }}>Type</th>
                  <th style={{ width: "110px" }}>Nodes</th>
                  <th style={{ width: "110px" }}>Atomic</th>
                  <th style={{ width: "160px" }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} onClick={() => navigate(`/playground/my-tasks/${task.id}`)}>
                    <td className="task-id">{task.id}</td>
                    <td>
                      <div className="task-name">
                        <Link className="inline-link" to={`/playground/my-tasks/${task.id}`}>
                          {task.title}
                        </Link>
                        <span className="sub">{task.summary || "No summary provided."}</span>
                      </div>
                    </td>
                    <td>
                      <span className="model-chip">{typeLabel(task.task_type)}</span>
                    </td>
                    <td>{task.node_count}</td>
                    <td>{task.atomic_count}</td>
                    <td>{new Date(task.updated_at).toLocaleDateString()}</td>
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
