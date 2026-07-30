import { DeleteOutlined, DownloadOutlined, FileZipOutlined, RightOutlined, TrophyOutlined } from "@ant-design/icons";
import { message, Modal } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
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

export default function CompetitionDetailPage() {
  const { competitionId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [taskScores, setTaskScores] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"create" | "history">("create");
  const [runtime, setRuntime] = useState("python");
  const [agentSource, setAgentSource] = useState<AgentSource>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [modelName, setModelName] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    const detail = await api.getCompetition(competitionId);
    setCompetition(detail);
    if (!user) {
      setSubmissions([]);
      setTaskScores(new Map());
      return;
    }
    const all = await api.listSubmissions();
    const agentId = `${competitionId}--__agent__`;
    setSubmissions(all.filter((submission) => submission.requirement_id === agentId));
    const scores = new Map<string, number>();
    all.filter((submission) => detail.tasks.some((task) => task.id === submission.requirement_id))
      .forEach((submission) => {
        if (submission.score != null) scores.set(
          submission.requirement_id,
          Math.max(scores.get(submission.requirement_id) ?? 0, submission.score),
        );
      });
    setTaskScores(scores);
  };

  useEffect(() => {
    setLoading(true);
    refresh().catch((error) => {
      setCompetition(null);
      message.error((error as Error).message);
    }).finally(() => setLoading(false));
  }, [competitionId, user]);

  const canCreate = agentSource !== "upload" || Boolean(file);
  const templateUrl = `/api/competitions/${competitionId}/starter-agent?language=${runtime}`;
  const flow = useMemo(() => [
    "Save an agent submission here. Its code snapshot is shared by every task in this competition.",
    "Open a task from the board and select Run latest submission to evaluate that agent against the task.",
    "Open a run from the task page to inspect progress, logs, test results, evidence, and live preview.",
    "Return here to download a saved agent archive, delete an unused submission, or create a newer version.",
  ], []);

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
      await api.createSubmission({ competitionId, runtime, file: agentSource === "upload" ? file : null, agentSource, displayName, modelName, catalog: "competition" });
      setFile(null);
      setDisplayName("");
      setModelName("");
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
            <span className="competition-status"><TrophyOutlined /> {competition.status === "open" ? "Open for submissions" : "Upcoming"}</span>
            <span>{competition.id.toUpperCase()}</span>
          </div>
          <h1>{competition.title}</h1>
          <div className="competition-stat-row"><span><strong>{competition.task_count}</strong> tasks</span><span><strong>{competition.total_tests}</strong> public tests</span></div>
        </section>

        <div className="competition-reading-layout">
          <main className="competition-description">
            <p className="competition-introduction">{competition.summary}</p>
            <section>
              <h2>About this competition</h2>
              <p>{competition.notice}</p>
            </section>
            <section>
              <h2>How to compete</h2>
              <ol>{flow.map((item, index) => <li key={item}><span>{index + 1}</span><p>{item}</p></li>)}</ol>
            </section>
            <section>
              <h2>Competition notes</h2>
              <ul>{competition.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
            </section>
            <section className="competition-side-tasks">
              <header><h2>Tasks</h2><span>{competition.task_count}</span></header>
              {competition.tasks.length === 0 ? (
                <div className="competition-empty">Tasks have not been published yet.</div>
              ) : (
                <div className="competition-side-task-list">
                  {competition.tasks.map((task) => (
                    <Link key={task.id} to={`/competitions/${competition.id}/tasks/${task.id}`} className="competition-side-task-row">
                      <div><code>{task.display_id}</code><h3>{task.title}</h3></div>
                      <strong>{taskScores.has(task.id) ? taskScores.get(task.id)?.toFixed(1) : "--"}</strong>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </main>

          <aside className="competition-sidebar">
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
                  <a className="btn-outline competition-download-btn submission-download-btn" href={templateUrl}><DownloadOutlined /> Download Agent Template</a>
                  <label className="upload-zone"><input className="visually-hidden" type="file" accept=".zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><div className="upload-icon"><FileZipOutlined /></div><div className="upload-text">{file ? file.name : "Drop your agent code here"}</div><div className="upload-hint">Keep the runtime entrypoint at the ZIP root.</div></label>
                </>}
                <div className="env-selector">{["python", "javascript", "typescript"].map((item) => <button key={item} disabled={agentSource !== "upload" && item !== "python"} className={`env-option${runtime === item ? " active" : ""}`} onClick={() => setRuntime(item)}>{item === "python" ? "Python" : item === "javascript" ? "JavaScript" : "TypeScript"}</button>)}</div>
                <label className="field-stack"><span>Submission name</span><input className="text-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Optional" /></label>
                <label className="field-stack"><span>Model name</span><input className="text-input" value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="Optional" /></label>
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
