import { DeleteOutlined, HistoryOutlined, PlayCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import MarkdownTocDocument from "../components/requirements/MarkdownTocDocument";
import TestSuiteViewer from "../components/requirements/TestSuiteViewer";
import { api } from "../lib/api";
import { parseTaskTreeYaml } from "../lib/taskTree";
import type { AgentSubmissionSummary, RequirementDetail, RequirementTestFile, SubmissionSummary } from "../lib/types";

function statusClass(status: string) {
  if (status === "PASSED") return "pass";
  if (status === "FAILED") return "fail";
  return "pending";
}

function formatSubmissionTime(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? "Time unavailable" : timestamp.toLocaleString();
}

export default function CompetitionTaskPage() {
  const { competitionId = "", requirementId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<RequirementDetail | null>(null);
  const [testFiles, setTestFiles] = useState<RequirementTestFile[]>([]);
  const [savedSubmissions, setSavedSubmissions] = useState<AgentSubmissionSummary[]>([]);
  const [runs, setRuns] = useState<SubmissionSummary[]>([]);
  const [activeDoc, setActiveDoc] = useState<"readme" | "tests">("readme");
  const [panelTab, setPanelTab] = useState<"run" | "history">("run");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [runSelectionMode, setRunSelectionMode] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getRequirement(requirementId, "competition"),
      api.getRequirementTests(requirementId, "competition"),
      user ? Promise.all([api.listSubmissions(), api.listRuns(requirementId)]) : Promise.resolve([[], []]),
    ]).then(([detail, tests, [records, runRecords]]) => {
      setTask(detail);
      setTestFiles(tests.files);
      setSavedSubmissions(records.filter((record) => record.competition_id === competitionId));
      setRuns(runRecords);
    }).catch((error) => {
      setTask(null);
      setTestFiles([]);
      message.error((error as Error).message);
    }).finally(() => setLoading(false));
  }, [competitionId, requirementId, user]);

  const currentMarkdown = useMemo(() => task?.requirements_markdown ?? "", [task]);
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
      const created = await api.createRun(latestSubmission.id, requirementId);
      await api.startSubmission(created.run.id);
      message.success("A new run was created from the latest saved submission.");
      navigate(`/runs/${created.run.id}`);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const refreshRuns = async () => {
    if (!user) {
      setRuns([]);
      return;
    }
    setRuns(await api.listRuns(requirementId));
  };

  const deleteSelectedRuns = async () => {
    if (selectedRunIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedRunIds.length} selected run${selectedRunIds.length === 1 ? "" : "s"}? Their runtime directories will be permanently removed.`)) return;
    try {
      const result = await api.deleteRuns(selectedRunIds);
      const skippedIds = result.skipped.map((item) => item.id);
      setSelectedRunIds(skippedIds);
      setRunSelectionMode(skippedIds.length > 0);
      await refreshRuns();
      if (result.deleted_ids.length > 0) {
        message.success(`${result.deleted_ids.length} selected run${result.deleted_ids.length === 1 ? "" : "s"} deleted.`);
      }
      if (result.skipped.length > 0) {
        message.warning(`${result.skipped.length} run${result.skipped.length === 1 ? "" : "s"} could not be deleted and remain selected.`);
      }
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const toggleRunSelection = (runId: string) => {
    setSelectedRunIds((current) => current.includes(runId) ? current.filter((id) => id !== runId) : [...current, runId]);
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
            <button type="button" className={`doc-tab${activeDoc === "tests" ? " active" : ""}`} onClick={() => setActiveDoc("tests")}>tests</button>
          </div>
          {activeDoc === "readme" ? <MarkdownTocDocument
            markdown={currentMarkdown}
            assetsBaseUrl={task.assets_base_url}
            referencesBaseUrl={task.references_base_url}
            tocTree={tocTree}
            bodyClassName="playground-readme-body"
            tocClassName="playground-readme-toc"
            scrollClassName="playground-readme-scroll"
          /> : <div className="playground-readme-scroll test-suite-scroll"><TestSuiteViewer files={testFiles} /></div>}
        </section>

        <aside className="action-panel action-panel-locked">
          <div className={`action-section action-section-locked${panelTab === "history" ? " action-section--history" : ""}`}>
            <div className="detail-tabs submission-tabs-shell">
              <div className="tabs submission-tabs">
                <button type="button" className={`tab${panelTab === "run" ? " active" : ""}`} onClick={() => { setPanelTab("run"); setRunSelectionMode(false); setSelectedRunIds([]); }}>Run</button>
                <button type="button" className={`tab${panelTab === "history" ? " active" : ""}`} onClick={() => setPanelTab("history")}>Run history</button>
              </div>
            </div>

            {panelTab === "run" ? (
              <>
                <div className="submission-subsection">
                  <div className="submission-subsection-title">Latest saved submission</div>
                  {latestSubmission ? (
                    <div className="competition-latest-submission">
                      <div className="competition-latest-submission-topline">
                        <span className="competition-latest-submission-status">Ready to run</span>
                        <time dateTime={latestSubmission.created_at}>{formatSubmissionTime(latestSubmission.created_at)}</time>
                      </div>
                      <div className="competition-latest-submission-name">{latestSubmission.display_name || latestSubmission.id}</div>
                      <div className="competition-latest-submission-meta">
                        <span className="competition-latest-submission-label">Model</span>
                        {latestSubmission.model_name ? <span className="model-chip">{latestSubmission.model_name}</span> : <span>Not specified</span>}
                      </div>
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
                : <div className="submission-history-area"><div className="submission-history-toolbar">{runSelectionMode ? <><label><input type="checkbox" checked={runs.length > 0 && selectedRunIds.length === runs.length} onChange={(event) => setSelectedRunIds(event.target.checked ? runs.map((run) => run.id) : [])} /> Select all</label><div className="history-selection-actions"><button type="button" className="history-select-button" onClick={() => { setRunSelectionMode(false); setSelectedRunIds([]); }}>Cancel</button><button type="button" className="history-bulk-delete" disabled={selectedRunIds.length === 0} onClick={() => void deleteSelectedRuns()}><DeleteOutlined /> Delete selected{selectedRunIds.length ? ` (${selectedRunIds.length})` : ""}</button></div></> : <button type="button" className="history-select-button" onClick={() => setRunSelectionMode(true)}>Select</button>}</div><div className="submission-history-table-wrap"><table className="task-table compact"><thead><tr>{runSelectionMode ? <th style={{ width: "36px" }} aria-label="Select" /> : null}<th>Run</th><th style={{ width: "100px" }}>Score</th><th style={{ width: "100px" }}>Status</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} onClick={() => navigate(`/runs/${run.id}`)}>{runSelectionMode ? <td onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedRunIds.includes(run.id)} onChange={() => toggleRunSelection(run.id)} aria-label={`Select ${run.display_name || run.id}`} /></td> : null}<td><Link className="inline-link" to={`/runs/${run.id}`}>{run.display_name || run.id}</Link><div className="table-sub mono-sub">{new Date(run.created_at).toLocaleString()}</div></td><td>{run.score == null ? "--" : run.score.toFixed(1)}</td><td><span className={`test-badge ${statusClass(run.status)}`}>{run.status}</span></td></tr>)}</tbody></table></div></div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
