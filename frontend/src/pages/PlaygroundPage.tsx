import { FileTextOutlined, PlayCircleOutlined, RightOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import type { RequirementSummary } from "../lib/types";
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
  const [loading, setLoading] = useState(true);
  const { start } = useQuickStart();

  useEffect(() => {
    api
      .listRequirements()
      .then(setRequirements)
      .catch(() => setRequirements([]))
      .finally(() => setLoading(false));
  }, []);

  const webTaskCount = useMemo(() => requirements.filter((item) => item.category === "web").length, [requirements]);

  return (
    <div className="page playground-page">
      <div className="playground-shell">
        <div className="breadcrumb playground-breadcrumb">
          <span>Playground</span>
          <span className="sep">/</span>
          <span className="current">Home</span>
        </div>

        <div className="playground-home-grid">
          <section className="playground-actions" aria-label="Playground quick actions">
            <button type="button" className="playground-entry-card home-surface-card playground active is-static" onClick={start}>
              <div className="home-surface-main">
                <div className="home-surface-icon playground">
                  <PlayCircleOutlined />
                </div>
                <div className="home-surface-text playground-entry-text">
                  <div className="home-surface-eyebrow">Interactive drafting</div>
                  <h2>Quick Start</h2>
                </div>
                <div className="home-surface-arrow" aria-hidden="true">
                  <RightOutlined />
                </div>
              </div>

              <div className="home-surface-support playground-entry-support">
                <p>Learn about requirement tree, upload your agent, and run the benchmark workflow end to end.</p>
              </div>
            </button>

            <Link to="/playground/create-task" className="playground-entry-card home-surface-card research active">
              <div className="home-surface-main">
                <div className="home-surface-icon research">
                  <FileTextOutlined />
                </div>
                <div className="home-surface-text playground-entry-text">
                  <div className="home-surface-eyebrow">Custom task authoring</div>
                  <h2>Create Task</h2>
                </div>
                <div className="home-surface-arrow" aria-hidden="true">
                  <RightOutlined />
                </div>
              </div>

              <div className="home-surface-support playground-entry-support">
                <p>Design your own app requirements and upload project material for future task generation workflows.</p>
              </div>
            </Link>
          </section>

          <aside className="playground-bank" aria-label="Task bank">
            <div className="playground-bank-shell">
              <div className="playground-bank-title">Task Bank</div>
              <div data-quickstart-id="playground-task-bank-anchor" className="quickstart-bank-anchor" aria-hidden="true" />
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
      </div>
    </div>
  );
}
