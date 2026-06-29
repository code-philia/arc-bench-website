import { message } from "antd";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export default function ProfilePage() {
  const { user, isLoading, updateProfile } = useAuth();
  const [githubEmail, setGithubEmail] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setGithubEmail(user?.github_email ?? "");
    setGithubUsername(user?.github_username ?? "");
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
      </div>
    </div>
  );
}
