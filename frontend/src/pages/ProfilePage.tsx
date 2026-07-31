import { DeleteOutlined, RightOutlined } from "@ant-design/icons";
import { message, Modal } from "antd";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { SubmissionSummary } from "../lib/types";

function formatDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt) return "-";
  const elapsed = Math.max(0, Math.round(((finishedAt ? new Date(finishedAt) : new Date()).getTime() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(elapsed / 60);
  return minutes > 0 ? `${minutes}m ${elapsed % 60}s` : `${elapsed}s`;
}

function submissionTaskLabel(requirementId: string) {
  return requirementId.endsWith("--__agent__")
    ? `${requirementId.slice(0, -"--__agent__".length)} · Agent snapshot`
    : requirementId;
}

export default function ProfilePage() {
  const { user, isLoading, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [githubEmail, setGithubEmail] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);

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
      setSubmissions(await api.listSubmissions());
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
      message.success("Profile updated.");
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSubmission = (submission: SubmissionSummary) => {
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

  return (
    <div className="page profile-page">
      <div className="profile-shell">
        <section className="profile-summary-card">
          <div className="profile-avatar-badge">{user.username.slice(0, 2).toUpperCase()}</div>
          <div className="profile-identity-block">
            <h1>{user.username}</h1>
            <p>{user.email}</p>
          </div>
          <div className="profile-summary-grid">
            <div className="profile-summary-item">
              <span>Username</span>
              <strong>{user.username}</strong>
            </div>
            <div className="profile-summary-item">
              <span>Email</span>
              <strong>{user.email}</strong>
            </div>
            <div className="profile-summary-item">
              <span>GitHub Username</span>
              <strong>{user.github_username || "Not set"}</strong>
            </div>
            <div className="profile-summary-item">
              <span>GitHub Email</span>
              <strong>{user.github_email || "Not set"}</strong>
            </div>
          </div>
        </section>

        <section className="profile-settings-card">
          <div className="profile-settings-head">
            <div className="competition-eyebrow">Profile</div>
            <h2>Edit Profile</h2>
            <p>Manage the public-facing account information used across your submissions and workspace activity.</p>
          </div>
          <form className="profile-form" onSubmit={handleSubmit}>
            <div className="profile-form-grid">
              <div className="profile-field-card">
                <label className="field-label" htmlFor="profile-username">
                  Username
                </label>
                <input id="profile-username" className="text-input" type="text" value={user.username} disabled />
                <p className="field-hint">Current ArcBench account name.</p>
              </div>

              <div className="profile-field-card">
                <label className="field-label" htmlFor="profile-email">
                  Email
                </label>
                <input id="profile-email" className="text-input" type="email" value={user.email} disabled />
                <p className="field-hint">Current ArcBench account email.</p>
              </div>

              <div className="profile-field-card">
                <label className="field-label" htmlFor="profile-github-username">
                  GitHub Username
                </label>
                <input
                  id="profile-github-username"
                  className="text-input"
                  type="text"
                  value={githubUsername}
                  onChange={(event) => setGithubUsername(event.target.value)}
                  placeholder="your-github-name"
                />
                <p className="field-hint">Used as your git username during workspace commits.</p>
              </div>

              <div className="profile-field-card">
                <label className="field-label" htmlFor="profile-github-email">
                  GitHub Email
                </label>
                <input
                  id="profile-github-email"
                  className="text-input"
                  type="email"
                  autoComplete="email"
                  value={githubEmail}
                  onChange={(event) => setGithubEmail(event.target.value)}
                  placeholder="you@example.com"
                />
                <p className="field-hint">Used as your git email during workspace commits.</p>
              </div>
            </div>

            <div className="profile-form-actions">
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        </section>

        <section className="profile-submissions-card">
          <div className="profile-submissions-head">
            <div>
              <div className="competition-eyebrow">Submission records</div>
              <h2>My submissions</h2>
              <p>Open a run to inspect its result, or permanently remove an archived submission you no longer need.</p>
            </div>
            <span>{submissions.length}</span>
          </div>
          {submissionsLoading ? <div className="profile-submissions-empty">Loading submission records...</div>
            : submissions.length === 0 ? <div className="profile-submissions-empty">No submissions yet. Start a Playground run or save a Competition agent to see it here.</div>
              : <div className="profile-submissions-table-wrap"><table className="profile-submissions-table"><thead><tr><th>Submission</th><th>Task</th><th>Status</th><th>Created</th><th>Duration</th><th aria-label="Actions" /></tr></thead><tbody>
                {submissions.map((submission) => <tr key={submission.id} onClick={() => navigate(`/runs/${submission.id}`)}>
                  <td><strong>{submission.display_name || submission.id}</strong>{submission.display_name ? <code>{submission.id}</code> : null}</td>
                  <td><span>{submissionTaskLabel(submission.requirement_id)}</span><small>{submission.runtime}</small></td>
                  <td><span className={`test-badge ${submission.status === "PASSED" ? "pass" : submission.status === "FAILED" ? "fail" : "pending"}`}>{submission.status}</span></td>
                  <td>{new Date(submission.created_at).toLocaleString()}</td>
                  <td>{formatDuration(submission.started_at, submission.finished_at)}</td>
                  <td><div className="profile-submission-actions"><button type="button" className="profile-submission-open" onClick={(event) => { event.stopPropagation(); navigate(`/runs/${submission.id}`); }}>Open <RightOutlined /></button><button type="button" className="profile-submission-delete" aria-label={`Delete ${submission.display_name || submission.id}`} title="Delete submission" onClick={(event) => { event.stopPropagation(); deleteSubmission(submission); }}><DeleteOutlined /></button></div></td>
                </tr>)}
              </tbody></table></div>}
        </section>
      </div>
    </div>
  );
}
