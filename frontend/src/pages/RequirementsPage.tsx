import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import type { RequirementSummary } from "../lib/types";

type PublicPlaceholderTask = Pick<
  RequirementSummary,
  "id" | "title" | "summary" | "total_tests" | "module_count"
> & {
  category?: string;
};

const placeholderTasks: PublicPlaceholderTask[] = [
  {
    id: "W-001",
    title: "E-Commerce Dashboard",
    summary: "Multimodal spec with wireframes.",
    total_tests: 42,
    module_count: 4,
  },
  {
    id: "A-001",
    title: "Notes App",
    summary: "Jetpack Compose CRUD benchmark.",
    total_tests: 28,
    module_count: 3,
  },
];

export default function RequirementsPage() {
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [category, setCategory] = useState("web");

  useEffect(() => {
    api.listRequirements().then(setRequirements).catch(() => undefined);
  }, []);

  const rows = category === "web" ? requirements : [];

  return (
    <div className="page library-page">
      <div className="library-header">
        <h2>Task Library</h2>
        <div className="tabs">
          {[
            { label: "🌐 Web Apps", value: "web" },
            { label: "📱 Android Apps", value: "android" },
          ].map((option) => (
            <button
              key={option.value}
              className={`tab${category === option.value ? " active" : ""}`}
              type="button"
              onClick={() => setCategory(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="task-table-wrap">
        <table className="task-table">
          <thead>
            <tr>
              <th style={{ width: "76px" }}>#</th>
              <th>Task</th>
              <th style={{ width: "100px" }}>Modules</th>
              <th style={{ width: "100px" }}>Tests</th>
              <th style={{ width: "120px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((record) => (
              <tr key={record.id} onClick={() => navigate(`/requirements/${record.id}`)}>
                <td className="task-id">{record.id}</td>
                <td>
                  <div className="task-name">
                    {record.title}
                    <span className="sub">
                      {record.test_runner} · {record.category}
                    </span>
                  </div>
                </td>
                <td>{record.module_count}</td>
                <td>{record.total_tests}</td>
                <td>
                  <span className="status-dot completed">Ready</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="public-tasks-section">
        <h3>Public Tasks</h3>
        {[...requirements, ...placeholderTasks].map((task) => {
          const realTask = "category" in task;
          return (
            <div key={task.id} className="public-task-card">
              <div className="public-task-header">
                <h4>{task.title}</h4>
                <span className="task-id-badge">{task.id}</span>
              </div>
              <p className="public-task-desc">{task.summary}</p>
              <div className="public-task-stats">
                <span>
                  Tests: <strong>{task.total_tests}</strong>
                </span>
                <span>
                  Modules: <strong>{task.module_count}</strong>
                </span>
                <span>
                  Category: <strong>{realTask ? task.category : "prototype"}</strong>
                </span>
              </div>
              <div className="public-task-downloads">
                {realTask ? (
                  <button
                    className="btn-download"
                    type="button"
                    onClick={() => navigate(`/requirements/${task.id}`)}
                  >
                    Open Requirement
                  </button>
                ) : (
                  <button className="btn-download" type="button" disabled>
                    Coming Soon
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
