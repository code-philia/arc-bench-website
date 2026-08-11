import { BulbOutlined, CalendarOutlined, DatabaseOutlined, DeleteOutlined, DownloadOutlined, FileZipOutlined, InfoCircleOutlined, RocketOutlined, RightOutlined, TrophyOutlined } from "@ant-design/icons";
import { message, Modal } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import AgentTemplateDialog from "../components/requirements/AgentTemplateDialog";
import { api } from "../lib/api";
import { DEFAULT_MODEL_NAME, MODEL_OPTIONS } from "../lib/models";
import type { CompetitionDetail, SubmissionSummary } from "../lib/types";

type AgentSource = "upload" | "builtin_arc_agent" | "builtin_octos_agent";

function download(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function statusClass(status: string) {
  return status === "READY"
    ? "bg-[var(--bg-elevated)] text-[var(--text)]"
    : "bg-[var(--bg-elevated)] text-[var(--text-dim)]";
}

function formatCompetitionRange(start?: string | null, end?: string | null) {
  if (!start || !end) return "Dates to be announced";
  const formatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
  return `${formatter.format(new Date(`${start}T00:00:00`))}\u2013${formatter.format(new Date(`${end}T00:00:00`))}`;
}

function taskOverview(taskId: string) {
  if (taskId.includes("github")) {
    return {
      label: "Software engineering · GitHub-style ERP",
      copy: "A simulated GitHub-style website for software-engineering workflows and ERP-like team operations. Build the collaboration system behind a development organization.",
      modules: "Accounts, organizations, teams, repositories, branches, issues, pull requests, permissions",
    };
  }

  return {
    label: "Data workspace · Google Sheets-style",
    copy: "A simulated Google Sheets-style website for data storage, presentation, and processing. Build a persistent workspace where people can organize and analyse tabular information.",
    modules: "Workbooks, worksheets, cells, formulas, data operations, filters, validation, pivot summaries",
  };
}

function competitionStatusLabel(status: string) {
  if (status === "open") return "Open for submissions";
  if (status === "ended") return "Archived event";
  return "Upcoming";
}

export default function CompetitionDetailPage() {
  const { competitionId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"create" | "history">("create");
  const [runtime, setRuntime] = useState("python");
  const [agentSource, setAgentSource] = useState<AgentSource>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [modelName, setModelName] = useState<string>(DEFAULT_MODEL_NAME);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    const detail = await api.getCompetition(competitionId);
    setCompetition(detail);
    if (!user) {
      setSubmissions([]);
      return;
    }
    const all = await api.listSubmissions();
    const agentId = `${competitionId}--__agent__`;
    setSubmissions(all.filter((submission) => submission.requirement_id === agentId));
  };

  useEffect(() => {
    setLoading(true);
    refresh().catch((error) => {
      setCompetition(null);
      message.error((error as Error).message);
    }).finally(() => setLoading(false));
  }, [competitionId, user]);

  const canCreate = agentSource !== "upload" || Boolean(file);
  const templateUrl = `/api/competitions/${competitionId}/starter-agent`;
  const flow = useMemo(() => competition?.flow ?? [], [competition?.flow]);
  const taskCards = useMemo(
    () => competition?.tasks.map((task) => ({
      task,
      overview: taskOverview(task.id),
    })) ?? [],
    [competition?.tasks],
  );

  const createSubmission = async () => {
    if (!user) {
      navigate("/login", { state: { from: `/competitions/${competitionId}` } });
      return;
    }
    if (!canCreate) {
      message.error("Choose an agent ZIP before saving the submission.");
      return;
    }
    try {
      setCreating(true);
      await api.createSubmission({
        competitionId,
        runtime,
        file: agentSource === "upload" ? file : null,
        agentSource,
        displayName,
        modelName,
        catalog: "competition",
      });
      setFile(null);
      setDisplayName("");
      setModelName(DEFAULT_MODEL_NAME);
      setTab("history");
      message.success("Agent submission saved. Open a task to run it.");
      await refresh();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const deleteSubmission = (submission: SubmissionSummary) => {
    Modal.confirm({
      title: "Delete this submission?",
      content: "The stored agent archive will be permanently removed. Existing task runs remain available.",
      okText: "Delete submission",
      okButtonProps: { danger: true },
      onOk: async () => {
        await api.deleteSubmission(submission.id);
        await refresh();
        message.success("Submission deleted.");
      },
    });
  };

  if (loading) return <div className="page centered"><div className="loading-state">Loading competition...</div></div>;
  if (!competition) return <div className="page centered"><div className="empty-state">Competition not found.</div></div>;

  return (
    <div className="page competition-detail-page">
      <div className="competition-container">
        <div className="competition-breadcrumb">
          <Link to="/requirements">Competition</Link><RightOutlined /><span>{competition.title}</span>
        </div>

        <section className="competition-detail-heading">
          <div className="competition-meta-row">
            <span className="competition-stage"><TrophyOutlined /> {competitionStatusLabel(competition.status)}</span>
            <span>{competition.id.toUpperCase()}</span>
          </div>
          <h1>{competition.title}</h1>
          <p className="competition-detail-date"><CalendarOutlined /> {formatCompetitionRange(competition.starts_at, competition.ends_at)}</p>
        </section>

        <div className="competition-reading-layout competition-hackathon-layout">
          <main className="competition-description competition-description-scroll">
            <section className="competition-story-block">
              <div className="competition-section-label competition-section-label--idea"><BulbOutlined /><span>Hackathon idea</span></div>
              <h2>Build a software factory for requirements.</h2>
              <p>
                Participants are expected to build an agent system, not a one-shot generation demo. The workflow breaks a large requirement
                into modules, delegates work, and keeps verification visible from start to finish.
              </p>
              <p>{competition.summary}</p>
            </section>

            <section className="competition-task-highlights" aria-labelledby="task-highlights-title">
              <div className="competition-section-heading">
                <div>
                  <div className="competition-section-label competition-section-label--tasks"><DatabaseOutlined /><span>Task introduction</span></div>
                  <h2 id="task-highlights-title">Two software task packs</h2>
                </div>
                <span>GitHub-style ERP and Google Sheets-style data work</span>
              </div>

              <div className="competition-task-briefs">
                {taskCards.map(({ task, overview }) => (
                  <article key={task.id} className="competition-task-brief">
                    <h3>{overview.label}</h3>
                    <p>{overview.copy}</p>
                    <p className="competition-task-brief-modules"><strong>Modules:</strong> {overview.modules}</p>
                  </article>
                ))}
              </div>
            </section>

            <section>
              <div className="competition-section-label competition-section-label--flow"><RocketOutlined /><span>How to compete</span></div>
              <ol className="competition-flow-list">
                {flow.map((item, index) => (
                  <li key={item}><span>{index + 1}</span><p>{item}</p></li>
                ))}
              </ol>
            </section>

            <section>
              <div className="competition-section-label competition-section-label--notes"><InfoCircleOutlined /><span>Competition notes</span></div>
              <ul className="competition-notes-list">
                {competition.rules.map((rule) => <li key={rule}>{rule}</li>)}
              </ul>
            </section>
          </main>

          <aside className="competition-sidebar">
            <section className="competition-side-tasks task-list-surface">
              <header><h2>Tasks</h2><span>{competition.task_count}</span></header>
              {competition.tasks.length === 0 ? (
                <div className="competition-empty">Tasks have not been published yet.</div>
              ) : (
                <div className="competition-task-list competition-task-list--compact">
                  {competition.tasks.map((task) => (
                    <Link key={task.id} to={`/competitions/${competition.id}/tasks/${task.id}`} className="competition-side-task-row competition-side-task-row--compact group">
                      <h3>{task.title}</h3>
                      <RightOutlined aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="competition-panel competition-submission-panel">
              <div className="competition-panel-tabs">
                <button type="button" className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>New submission</button>
                <button type="button" className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History ({submissions.length})</button>
              </div>
              {tab === "create" ? (
                <div className="competition-submission-form">
                  <div><h2>Save an agent snapshot</h2><p>This snapshot is shared by all competition tasks. Choose a task afterwards to run it.</p></div>
                  <div><div className="competition-field-label">Agent source</div><div className="agent-source-selector">
                    <button type="button" className={`agent-source-card${agentSource === "upload" ? " active" : ""}`} onClick={() => setAgentSource("upload")}><span className="agent-source-title">Upload .zip</span><span className="agent-source-copy">Use your own agent package.</span></button>
                    <button type="button" className={`agent-source-card${agentSource !== "upload" ? " active" : ""}`} onClick={() => { setAgentSource("builtin_arc_agent"); setRuntime("python"); }}><span className="agent-source-title">Built-in Agent</span><span className="agent-source-copy">Use ARC Agent or Octos Agent.</span></button>
                  </div></div>
                  {agentSource !== "upload" ? <div className="builtin-agent-selector" role="group" aria-label="Built-in agent type">
                    <button type="button" className={`builtin-agent-option${agentSource === "builtin_arc_agent" ? " active" : ""}`} onClick={() => setAgentSource("builtin_arc_agent")}><span>ARC Agent</span><small>Agentic Requirement Compiler</small></button>
                    <button type="button" className={`builtin-agent-option${agentSource === "builtin_octos_agent" ? " active" : ""}`} onClick={() => setAgentSource("builtin_octos_agent")}><span>Octos Agent</span><small>Your Own AI Assistant</small></button>
                  </div> : <>
                    <AgentTemplateDialog href={templateUrl} runtime={runtime} />
                    <label className="upload-zone"><input className="visually-hidden" type="file" accept=".zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><div className="upload-icon"><FileZipOutlined /></div><div className="upload-text">{file ? file.name : "Drop your agent code here"}</div><div className="upload-hint">Keep the runtime entrypoint at the ZIP root.</div></label>
                  </>}
                  <div className="env-selector">{["python", "javascript", "typescript"].map((item) => <button key={item} disabled={agentSource !== "upload" && item !== "python"} className={`env-option${runtime === item ? " active" : ""}`} onClick={() => setRuntime(item)}>{item === "python" ? "Python" : item === "javascript" ? "JavaScript" : "TypeScript"}</button>)}</div>
                  <label className="field-stack"><span>Submission name</span><input className="text-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Optional" /></label>
                  <label className="field-stack"><span>Model</span><select className="text-input" value={modelName} onChange={(event) => setModelName(event.target.value)}>{MODEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  <button type="button" onClick={() => void createSubmission()} disabled={creating || !canCreate} className="btn-primary w-full">{creating ? "Saving..." : "Save submission"}</button>
                </div>
              ) : (
                <div className="competition-submission-history">
                  {!user ? <div className="competition-empty">Sign in to manage your saved agent submissions.</div>
                    : submissions.length === 0 ? <div className="competition-empty">No saved agent submissions yet.</div>
                      : submissions.map((submission) => <div key={submission.id} className="competition-submission-row">
                        <h3>{submission.display_name || submission.id}</h3>
                        <div><span className={statusClass(submission.status)}>{submission.status}</span><span>{submission.model_name || "No model name"}</span><span>{submission.original_filename}</span></div>
                        <p><button onClick={() => api.downloadSubmissionArchive(submission.id).then(download).catch((error) => message.error(error.message))}><DownloadOutlined /> Download code</button><button className="danger" onClick={() => deleteSubmission(submission)}><DeleteOutlined /> Delete</button></p>
                      </div>)}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
