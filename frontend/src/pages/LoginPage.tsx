import { message } from "antd";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { getLoginErrorMessage } from "../lib/authErrors";

type LoginFieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from || "/";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: LoginFieldErrors = {};
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await login({ email, password });
      message.success("Signed in successfully.");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const errorMessage = getLoginErrorMessage(error);
      message.error(errorMessage);
      if (errorMessage === "User not found.") {
        setFieldErrors({ email: errorMessage });
      } else if (errorMessage === "Incorrect password.") {
        setFieldErrors({ password: errorMessage });
      } else if (errorMessage === "Email is required.") {
        setFieldErrors({ email: errorMessage });
      } else if (errorMessage === "Password is required.") {
        setFieldErrors({ password: errorMessage });
      }
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
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          />
          {fieldErrors.email ? <p id="login-email-error" className="field-error">{fieldErrors.email}</p> : null}

          <label className="field-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="text-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
          />
          {fieldErrors.password ? <p id="login-password-error" className="field-error">{fieldErrors.password}</p> : null}

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
