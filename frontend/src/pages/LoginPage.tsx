import { message } from "antd";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { getLoginErrorMessage } from "../lib/authErrors";
import { getHackathonSupabaseClient } from "../lib/hackathonAuth";

type LoginFieldErrors = {
  email?: string;
  password?: string;
};

type LoginProvider = "arcbench" | "hackathon";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithHackathon } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [provider, setProvider] = useState<LoginProvider>("arcbench");
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from || "/";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
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
      if (provider === "hackathon") {
        const supabase = getHackathonSupabaseClient();
        if (!supabase) {
          throw new Error("Hackathon sign-in is not configured.");
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error || !data.session?.access_token) {
          throw new Error(error?.message || "Hackathon sign-in failed.");
        }
        await loginWithHackathon(data.session.access_token);
      } else {
        await login({ email, password });
      }
      message.success("Signed in successfully.");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const errorMessage = provider === "hackathon"
        ? getHackathonLoginErrorMessage(error)
        : getLoginErrorMessage(error);
      message.error(errorMessage);
      if (provider === "hackathon") {
        setSubmitError(errorMessage);
      }
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
          <p>{provider === "hackathon" ? "Use your Hackathon account to enter the Hackathon competition." : "Sign in to submit agents, track your runs, and view your submission history."}</p>
        </div>
        <div className="auth-provider-switch" role="tablist" aria-label="Account type">
          <button
            type="button"
            role="tab"
            aria-selected={provider === "arcbench"}
            className={provider === "arcbench" ? "is-active" : undefined}
            onClick={() => { setProvider("arcbench"); setFieldErrors({}); setSubmitError(""); }}
          >
            ARC-Bench account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={provider === "hackathon"}
            className={provider === "hackathon" ? "is-active" : undefined}
            onClick={() => { setProvider("hackathon"); setFieldErrors({}); setSubmitError(""); }}
          >
            Hackathon account
          </button>
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
              setSubmitError("");
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
              setSubmitError("");
            }}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
          />
          {fieldErrors.password ? <p id="login-password-error" className="field-error">{fieldErrors.password}</p> : null}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Signing In..." : provider === "hackathon" ? "Sign in with Hackathon" : "Login"}
          </button>
          {provider === "hackathon" && submitError ? <p className="auth-submit-error" role="alert">{submitError}</p> : null}
        </form>
        {provider === "hackathon" ? (
          <p className="auth-provider-note">Hackathon registration and password recovery are managed on the Hackathon website.</p>
        ) : (
          <div className="auth-footnote">
            <span>Need an account?</span>
            <Link className="inline-link" to="/register">
              Register
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function getHackathonLoginErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message.toLowerCase() : "";
  if (detail.includes("email before opening") || detail.includes("email not confirmed")) {
    return "Confirm your Hackathon email before signing in.";
  }
  if (detail.includes("invalid login") || detail.includes("invalid credentials")) {
    return "No Hackathon account was found for this email, or the password is incorrect.";
  }
  return "Hackathon sign-in failed. Please try again.";
}
