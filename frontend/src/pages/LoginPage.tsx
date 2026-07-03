import { message } from "antd";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { getLoginErrorMessage } from "../lib/authErrors";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from || "/";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login({ email, password });
      message.success("Signed in successfully.");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      message.error(getLoginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <div className="auth-copy">
          <div className="competition-eyebrow">Account</div>
          <h1>Login</h1>
          <p>Sign in to submit agents, track your runs, and view your submission history.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="text-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label className="field-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="text-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Signing In..." : "Login"}
          </button>
        </form>
        <div className="auth-footnote">
          <span>Need an account?</span>
          <Link className="inline-link" to="/register">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
