import { HistoryOutlined, PlayCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import MarkdownTocDocument from "../components/requirements/MarkdownTocDocument";
import { api } from "../lib/api";
import { parseTaskTreeYaml } from "../lib/taskTree";
import type { RequirementDetail, SubmissionSummary } from "../lib/types";

function statusClass(status: string) {
  if (status === "PASSED") return "pass";
  if (status === "FAILED") return "fail";
  return "pending";
}

export default function CompetitionTaskPage() {
  const { competitionId = "", requirementId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<RequirementDetail | null>(null);
  const [savedSubmissions, setSavedSubmissions] = useState<SubmissionSummary[]>([]);
  const [runs, setRuns] = useState<SubmissionSummary[]>([]);
  const [activeDoc, setActiveDoc] = useState<"readme" | "prerequisites">("readme");
  const [panelTab, setPanelTab] = useState<"run" | "history">("run");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getRequirement(requirementId, "competition"),
      user ? api.listSubmissions() : Promise.resolve([]),
    ]).then(([detail, records]) => {
      setTask(detail);
      setSavedSubmissions(records.filter((record) => record.requirement_id === `${competitionId}--__agent__`));
      setRuns(records.filter((record) => record.requirement_id === requirementId));
    }).catch((error) => {
      setTask(null);
      message.error((error as Error).message);
    }).finally(() => setLoading(false));
  }, [competitionId, requirementId, user]);

  const currentMarkdown = useMemo(
    () => activeDoc === "readme" ? task?.requirements_markdown ?? "" : task?.prerequisites_markdown ?? "",
    [activeDoc, task],
  );
  const tocTree = useMemo(() => {
    if (activeDoc !== "readme" || !task?.requirements_yaml?.trim()) return null;
    try {
      return parseTaskTreeYaml(task.requirements_yaml);
    } catch {
      return null;
    }
  }, [activeDoc, task?.requirements_yaml]);
  const latestSubmission = savedSubmissions[0];
  const activeRun = runs.find((run) => ["PENDING", "RUNNING", "PAUSE_REQUESTED", "RESUME_REQUESTED"].includes(run.status));

  const runLatestSubmission = async () => {
    if (!latestSubmission) return;
    try {
      setStarting(true);
      const created = await api.rerunSubmission(latestSubmission.id, requirementId);
      await api.startSubmission(created.submission.id);
      message.success("A new run was created from the latest saved submission.");
      navigate(`/runs/${created.submission.id}`);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <div className="page centered"><div className="loading-state">Loading task...</div></div>;
  if (!task) return <div className="page centered"><div className="empty-state">Task not found.</div></div>;

  return (
    <div className="page detail-page detail-page-locked competition-task-page">
      <div className="detail-layout detail-layout-locked">
        <section className="readme-panel">
          <div className="readme-header">
            <div className="breadcrumb">
              <span>Competition</span>
              <span className="sep">/</span>
              <Link to={`/competitions/${competitionId}`}>{competitionId}</Link>
              <span className="sep">/</span>
              <span className="current">{task.display_id} - {task.title}</span>
            </div>
          </div>
          <div className="doc-tabs">
            <button type="button" className={`doc-tab${activeDoc === "readme" ? " active" : ""}`} onClick={() => setActiveDoc("readme")}>README.md</button>
            <button type="button" className={`doc-tab${activeDoc === "prerequisites" ? " active" : ""}`} onClick={() => setActiveDoc("prerequisites")}>prerequisites.md</button>
          </div>
          <MarkdownTocDocument
            markdown={currentMarkdown}
            assetsBaseUrl={task.assets_base_url}
            referencesBaseUrl={task.references_base_url}
            tocTree={tocTree}
            bodyClassName="playground-readme-body"
            tocClassName="playground-readme-toc"
            scrollClassName="playground-readme-scroll"
          />
        </section>

        <aside className="action-panel action-panel-locked">
          <div className="action-section action-section-locked">
            <div className="detail-tabs submission-tabs-shell">
              <div className="tabs submission-tabs">
                <button type="button" className={`tab${panelTab === "run" ? " active" : ""}`} onClick={() => setPanelTab("run")}>Run</button>
                <button type="button" className={`tab${panelTab === "history" ? " active" : ""}`} onClick={() => setPanelTab("history")}>Run history</button>
              </div>
            </div>

            {panelTab === "run" ? (
              <>
                <div className="submission-subsection">
                  <div className="submission-subsection-title">Latest saved submission</div>
                  {latestSubmission ? (
                    <div className="submission-summary-card">
                      <div className="submission-summary-top">
                        <div><div className="submission-summary-name">{latestSubmission.display_name || latestSubmission.id}</div><div className="submission-summary-meta">{latestSubmission.model_name ? <span className="model-chip">{latestSubmission.model_name}</span> : <span>Model not specified</span>}</div></div>
                        <span className="test-badge pending">READY</span>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-[var(--text-dim)]">This agent snapshot will be copied into a new isolated run for {task.display_id}.</div>
                    </div>
                  ) : <div className="empty-state compact">No saved submission is available for this competition.</div>}
                </div>
                <div className="submission-subsection">
                  <div className="submission-subsection-title">Execution</div>
                  {activeRun ? <Link to={`/runs/${activeRun.id}`} className="submission-summary-card block"><div className="submission-summary-top"><div><div className="submission-summary-name">A run is in progress</div><div className="submission-summary-meta">{activeRun.display_name || activeRun.id}</div></div><span className={`test-badge ${statusClass(activeRun.status)}`}>{activeRun.status}</span></div><div className="mt-3 text-sm font-semibold text-[var(--accent)]">Open run details</div></Link> : <div className="empty-state compact">No task run is in progress.</div>}
                  <button className="btn-primary mt-3" type="button" disabled={!user || !latestSubmission || starting} onClick={() => void runLatestSubmission()}><PlayCircleOutlined /> {starting ? "Creating run..." : "Run latest submission"}</button>
                  <Link className="btn-outline create-task-side-link mt-2" to={`/competitions/${competitionId}`}><PlusOutlined /> Create new submission</Link>
                  {!user ? <div className="inline-alert">Sign in to run a saved agent submission.</div> : null}
                </div>
              </>
            ) : !user ? <div className="empty-state compact">Sign in to view task run history.</div>
              : runs.length === 0 ? <div className="empty-state compact">No task runs yet.</div>
                : <table className="task-table compact"><thead><tr><th>Run</th><th style={{ width: "100px" }}>Score</th><th style={{ width: "100px" }}>Status</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} onClick={() => navigate(`/runs/${run.id}`)}><td><Link className="inline-link" to={`/runs/${run.id}`}>{run.display_name || run.id}</Link><div className="table-sub mono-sub">{new Date(run.created_at).toLocaleString()}</div></td><td>{run.score == null ? "--" : run.score.toFixed(1)}</td><td><span className={`test-badge ${statusClass(run.status)}`}>{run.status}</span></td></tr>)}</tbody></table>}
          </div>
        </aside>
      </div>
    </div>
  );
}
