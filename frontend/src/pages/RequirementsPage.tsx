import { Button, Card, Segmented, Table } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import type { RequirementSummary } from "../lib/types";

const placeholderTasks = [
  { id: "W-001", title: "E-Commerce Dashboard", summary: "Multimodal spec with wireframes.", total_tests: 42, module_count: 4 },
  { id: "A-001", title: "Notes App", summary: "Jetpack Compose CRUD benchmark.", total_tests: 28, module_count: 3 },
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
        <div>
          <h2>Task Library</h2>
          <p className="muted">Real requirements are discovered from `arc-bench/webapp` on backend startup.</p>
        </div>
        <Segmented
          options={[
            { label: "🌐 Web Apps", value: "web" },
            { label: "📱 Android Apps", value: "android" },
          ]}
          value={category}
          onChange={(value) => setCategory(String(value))}
        />
      </div>

      <div className="task-table-wrap">
        <Table
          rowKey="id"
          dataSource={rows}
          pagination={false}
          onRow={(record) => ({
            onClick: () => navigate(`/requirements/${record.id}`),
          })}
          columns={[
            { title: "#", dataIndex: "id", width: 90 },
            {
              title: "Task",
              render: (_, record) => (
                <div>
                  <div>{record.title}</div>
                  <div className="table-sub">
                    {record.test_runner} · {record.total_tests} tests
                  </div>
                </div>
              ),
            },
            { title: "Modules", dataIndex: "module_count", width: 100 },
            { title: "Tests", dataIndex: "total_tests", width: 100 },
            { title: "Category", dataIndex: "category", width: 120 },
          ]}
        />
      </div>

      <section className="public-tasks-section">
        <h3>Public Tasks</h3>
        {[...requirements, ...placeholderTasks].map((task) => {
          const realTask = "category" in task;
          return (
            <Card key={task.id} className="public-task-card">
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
                  <Button type="default" onClick={() => navigate(`/requirements/${task.id}`)}>
                    Open Requirement
                  </Button>
                ) : (
                  <Button disabled>Coming Soon</Button>
                )}
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
