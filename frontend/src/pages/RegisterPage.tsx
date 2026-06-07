import { message } from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

const PASSWORD_REQUIREMENT_TEXT = "Password must be 8-128 characters.";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8 || password.length > 128) {
      message.error(PASSWORD_REQUIREMENT_TEXT);
      return;
    }
    setSubmitting(true);
    try {
      await register({ email, username, password });
      message.success("Account created successfully.");
      navigate("/", { replace: true });
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <div className="auth-copy">
          <div className="competition-eyebrow">Account</div>
          <h1>Register</h1>
          <p>Create an account to keep your submissions private and attached to your own history.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="register-email">
            Email
          </label>
          <input
            id="register-email"
            className="text-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label className="field-label" htmlFor="register-username">
            Username
          </label>
          <input
            id="register-username"
            className="text-input"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />

          <label className="field-label" htmlFor="register-password">
            Password
          </label>
          <input
            id="register-password"
            className="text-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <p className="field-hint">{PASSWORD_REQUIREMENT_TEXT}</p>

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Register"}
          </button>
        </form>
        <div className="auth-footnote">
          <span>Already have an account?</span>
          <Link className="inline-link" to="/login">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
