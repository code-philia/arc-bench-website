import { message } from "antd";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { getRegisterErrorMessage } from "../lib/authErrors";

const PASSWORD_REQUIREMENT_TEXT = "Password must be 8-128 characters.";
const USERNAME_REQUIREMENT_TEXT = "Username must be 3-32 characters and use letters, numbers, `_`, or `-`.";

type RegisterFieldErrors = {
  email?: string;
  username?: string;
  password?: string;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isInternalBeta, setIsInternalBeta] = useState(false);
  const [internalBetaCode, setInternalBetaCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from || "/";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: RegisterFieldErrors = {};
    if (!email.trim().includes("@")) {
      nextErrors.email = "Email must include @.";
    }
    if (!username.trim()) {
      nextErrors.username = "Username is required.";
    }
    if (password.length < 8 || password.length > 128) {
      nextErrors.password = "Password does not meet the requirements.";
    }
    if (isInternalBeta && !internalBetaCode.trim()) {
      nextErrors.password = "Enter your internal beta invitation code.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await register({ email, username, password, internal_beta_code: isInternalBeta ? internalBetaCode.trim() : null });
      message.success("Account created successfully.");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const errorMessage = getRegisterErrorMessage(error);
      message.error(errorMessage);
      const lower = errorMessage.toLowerCase();
      if (lower.includes("email")) {
        setFieldErrors({ email: errorMessage.replace(/^Registration failed\. /, "") });
      } else if (lower.includes("username")) {
        setFieldErrors({ username: errorMessage.replace(/^Registration failed\. /, "") });
      } else if (lower.includes("password")) {
        setFieldErrors({ password: errorMessage.replace(/^Registration failed\. /, "") });
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
            placeholder="you@example.com"
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
          />
          {fieldErrors.email ? <p id="register-email-error" className="field-error">{fieldErrors.email}</p> : null}

          <label className="field-label" htmlFor="register-username">
            Username
          </label>
          <input
            id="register-username"
            className="text-input"
            type="text"
            autoComplete="username"
            value={username}
            placeholder="letters, numbers, _ or -"
            onChange={(event) => {
              setUsername(event.target.value);
              setFieldErrors((current) => ({ ...current, username: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={fieldErrors.username ? "register-username-error" : "register-username-hint"}
          />
          {fieldErrors.username ? <p id="register-username-error" className="field-error">{fieldErrors.username}</p> : <p id="register-username-hint" className="field-hint">{USERNAME_REQUIREMENT_TEXT}</p>}

          <label className="field-label" htmlFor="register-password">
            Password
          </label>
          <label className="auth-beta-choice">
            <input type="checkbox" checked={isInternalBeta} onChange={(event) => setIsInternalBeta(event.target.checked)} />
            <span>I have an internal beta invitation code</span>
          </label>
          {isInternalBeta ? <label className="field-label" htmlFor="register-beta-code">
            Internal beta invitation code
            <input id="register-beta-code" className="text-input" value={internalBetaCode} onChange={(event) => setInternalBetaCode(event.target.value)} autoComplete="off" placeholder="ARC-BETA-CODE" />
          </label> : null}
          <input
            id="register-password"
            className="text-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={password}
            placeholder="8-128 characters"
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "register-password-error" : "register-password-hint"}
          />
          {fieldErrors.password ? <p id="register-password-error" className="field-error">{fieldErrors.password}</p> : <p id="register-password-hint" className="field-hint">{PASSWORD_REQUIREMENT_TEXT}</p>}

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
