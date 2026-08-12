import { CheckCircleOutlined, DeleteOutlined, EditOutlined, RightOutlined, TrophyOutlined } from "@ant-design/icons";
import { message, Modal } from "antd";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { AgentSubmissionSummary, SubmissionSummary } from "../lib/types";

function formatDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt) return "-";
  const elapsed = Math.max(0, Math.round(((finishedAt ? new Date(finishedAt) : new Date()).getTime() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(elapsed / 60);
  return minutes > 0 ? `${minutes}m ${elapsed % 60}s` : `${elapsed}s`;
}

function submissionTaskLabel(requirementId: string | null) {
  if (!requirementId) return "No task selected";
  return requirementId.endsWith("--__agent__")
    ? `${requirementId.slice(0, -"--__agent__".length)} · Agent snapshot`
    : requirementId;
}

function isCompetitionSnapshot(submission: AgentSubmissionSummary) {
  return submission.catalog === "competition";
}

function competitionLabel(submission: AgentSubmissionSummary) {
  return submission.competition_id || "competition";
}

function recordStatusTone(status: string) {
  if (status === "PASSED") return "pass";
  if (status === "FAILED" || status === "CANCELLED") return "fail";
  if (status === "RUNNING") return "info";
  return "pending";
}

export default function ProfilePage() {
  const { user, isLoading, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [githubEmail, setGithubEmail] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<AgentSubmissionSummary[]>([]);
  const [runs, setRuns] = useState<SubmissionSummary[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [activeRecordView, setActiveRecordView] = useState<"submissions" | "competitions">("submissions");
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    setGithubEmail(user?.github_email ?? "");
    setGithubUsername(user?.github_username ?? "");
  }, [user]);

  const refreshSubmissions = async () => {
    if (!user) {
      setSubmissions([]);
      setSubmissionsLoading(false);
      return;
    }
    setSubmissionsLoading(true);
    try {
      const [savedSubmissions, runRecords] = await Promise.all([api.listSubmissions(), api.listRuns()]);
      setSubmissions(savedSubmissions);
      setRuns(runRecords);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    void refreshSubmissions();
  }, [user]);

  if (!isLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return (
      <div className="page centered">
        <div className="loading-state">Loading profile...</div>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await updateProfile({
        github_email: githubEmail.trim() || null,
        github_username: githubUsername.trim() || null,
      });
      setEditingProfile(false);
      message.success("Profile updated.");
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSubmission = (submission: AgentSubmissionSummary) => {
    Modal.confirm({
      title: "Delete this submission?",
      content: "This permanently removes the submission record and its runtime directory. Competition task runs created from a saved agent remain available.",
      okText: "Delete submission",
      okButtonProps: { danger: true },
      onOk: async () => {
        await api.deleteSubmission(submission.id);
        await refreshSubmissions();
        message.success("Submission deleted.");
      },
    });
  };

  const runRecords = submissions.filter((submission) => !isCompetitionSnapshot(submission));
  const competitionEntries = submissions.filter(isCompetitionSnapshot);
  const visibleRecords = activeRecordView === "submissions" ? runRecords : competitionEntries;
  const passedRuns = runs.filter((run) => run.status === "PASSED").length;
  const openLatestRun = (submission: AgentSubmissionSummary) => {
    const latestRun = runs.find((run) => run.submission_id === submission.id);
    if (!latestRun) {
      message.info("This submission has not been run yet.");
      return;
    }
    navigate(`/runs/${latestRun.id}`);
  };

  const openCompetitionSubmission = (submission: AgentSubmissionSummary) => {
    if (!submission.competition_id) {
      message.error("This submission is not linked to a competition.");
      return;
    }
    navigate(`/competitions/${submission.competition_id}?tab=history`);
  };

  return (
    <div className="page profile-page">
      <div className="profile-layout">
        <aside className="profile-sidebar">
          <section className="profile-person-card">
            <div className="profile-avatar-badge">{user.username.slice(0, 2).toUpperCase()}</div>
            <div className="profile-identity-block"><h1>{user.username}</h1><p>{user.email}</p></div>
            <div className="profile-member-since">Member since {new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short" })}</div>
            <button type="button" className="profile-edit-trigger" onClick={() => setEditingProfile((visible) => !visible)}><EditOutlined /> {editingProfile ? "Close editor" : "Edit profile"}</button>
          </section>

          <section className="profile-contact-card">
            <h2>Account details</h2>
            <div><span>GitHub username</span><strong>{user.github_username || "Not set"}</strong></div>
            <div><span>GitHub email</span><strong>{user.github_email || "Not set"}</strong></div>
          </section>

          {editingProfile ? <section className="profile-editor-card">
            <h2>Edit profile</h2>
            <form className="profile-form" onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="profile-github-username">GitHub username<input id="profile-github-username" className="text-input" value={githubUsername} onChange={(event) => setGithubUsername(event.target.value)} placeholder="your-github-name" /></label>
              <label className="field-label" htmlFor="profile-github-email">GitHub email<input id="profile-github-email" className="text-input" type="email" autoComplete="email" value={githubEmail} onChange={(event) => setGithubEmail(event.target.value)} placeholder="you@example.com" /></label>
              <button className="btn-primary" type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save changes"}</button>
            </form>
          </section> : null}
        </aside>

        <main className="profile-main">
          <section className="profile-activity-overview">
            <div><span>Total records</span><strong>{submissions.length}</strong></div>
            <div><span>Passed runs</span><strong><CheckCircleOutlined /> {passedRuns}</strong></div>
            <div><span>Competition entries</span><strong><TrophyOutlined /> {competitionEntries.length}</strong></div>
          </section>

          <section className="profile-records-card">
            <header className="profile-records-header">
              <div><h2>Activity records</h2><p>Open a record for its full detail, or remove it when you no longer need it.</p></div>
              <div className="profile-record-tabs" role="tablist"><button type="button" role="tab" aria-selected={activeRecordView === "submissions"} className={activeRecordView === "submissions" ? "active" : ""} onClick={() => setActiveRecordView("submissions")}>Submissions <span>{runRecords.length}</span></button><button type="button" role="tab" aria-selected={activeRecordView === "competitions"} className={activeRecordView === "competitions" ? "active" : ""} onClick={() => setActiveRecordView("competitions")}>Competition entries <span>{competitionEntries.length}</span></button></div>
            </header>
            {submissionsLoading ? <div className="profile-records-empty">Loading activity records...</div>
              : visibleRecords.length === 0 ? <div className="profile-records-empty">{activeRecordView === "submissions" ? "No submission runs yet." : "No competition entries yet."}</div>
                : <div className="profile-record-list">{visibleRecords.map((submission) => <article key={submission.id} className={`profile-record-row${isCompetitionSnapshot(submission) ? " profile-record-row--competition" : ""}`} onClick={() => isCompetitionSnapshot(submission) ? openCompetitionSubmission(submission) : openLatestRun(submission)}>
                  <div className="profile-record-main">{isCompetitionSnapshot(submission) ? <span className="profile-record-competition">Competition · {competitionLabel(submission)}</span> : null}<strong>{submission.display_name || (isCompetitionSnapshot(submission) ? "Untitled submission" : submission.id)}</strong><span>{isCompetitionSnapshot(submission) ? "Saved agent submission" : submissionTaskLabel(submission.requirement_id)} · {submission.runtime}</span></div>
                  <span className="test-badge pending">SAVED</span>
                  <time>{new Date(submission.created_at).toLocaleString()}</time>
                  <span className="profile-record-duration">{runs.filter((run) => run.submission_id === submission.id).length} runs</span>
                  <div className="profile-submission-actions"><button type="button" className="profile-submission-open" onClick={(event) => { event.stopPropagation(); isCompetitionSnapshot(submission) ? openCompetitionSubmission(submission) : openLatestRun(submission); }}>{isCompetitionSnapshot(submission) ? "Open submission" : "Open run"} <RightOutlined /></button><button type="button" className="profile-submission-delete" aria-label={`Delete ${submission.display_name || submission.id}`} title="Delete record" onClick={(event) => { event.stopPropagation(); deleteSubmission(submission); }}><DeleteOutlined /></button></div>
                </article>)}</div>}
          </section>
        </main>
      </div>
    </div>
  );
}
