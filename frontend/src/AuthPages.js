import React, { useState } from "react";

const API = process.env.REACT_APP_API_BASE || "";

// ── Shared sub-components ────────────────────────────────────────────────────

function EcgLine({ style }) {
  const d =
    "M0 60 H120 L135 60 L145 50 L155 60 H200 L210 70 L222 8 L236 104 L248 60 H300 L320 44 L345 60 H460 L475 60 L485 50 L495 60 H540 L550 70 L562 8 L576 104 L588 60 H640 L660 44 L685 60 H800";
  return (
    <svg viewBox="0 0 800 120" preserveAspectRatio="none" style={style} aria-hidden>
      <path d={d} fill="none" stroke="var(--lp-border)" strokeWidth="2" />
      <path
        d={d}
        fill="none"
        stroke="var(--lp-primary)"
        strokeWidth="2.5"
        className="ecg-trace"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Logo({ onClick }) {
  return (
    <button onClick={onClick} style={s.logoBtn}>
      <span style={s.logoIcon}>
        <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M2 12h5l2-5 4 10 2-5h7" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </span>
      <span style={s.logoText}>EchoVote</span>
    </button>
  );
}

function Field({ label, error, ...props }) {
  return (
    <label style={s.fieldWrap}>
      <span style={s.fieldLabel}>{label}</span>
      <input
        {...props}
        style={{
          ...s.fieldInput,
          ...(error ? { borderColor: "#e05a4e", boxShadow: "0 0 0 3px rgba(224,90,78,0.15)" } : {}),
        }}
      />
      {error && <span style={s.fieldError}>{error}</span>}
    </label>
  );
}

/** Feedback banner (error or success) */
function Banner({ type, message }) {
  if (!message) return null;
  const isError = type === "error";
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        background: isError ? "rgba(224,90,78,0.12)" : "rgba(15,157,138,0.12)",
        border: `1px solid ${isError ? "#e05a4e" : "#0f9d8a"}`,
        color: isError ? "#e05a4e" : "#2cc2ab",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <span style={{ flexShrink: 0 }}>{isError ? "❌" : "✅"}</span>
      {message}
    </div>
  );
}

function AuthShell({ title, subtitle, children, footer, onLogoClick }) {
  return (
    <div style={s.shell}>
      <aside style={s.aside} className="lp-ecg-grid">
        <Logo onClick={onLogoClick} />
        <div>
          <p style={s.asideMono}>Lead II · 25 mm/s</p>
          <EcgLine style={{ height: 128, width: "100%", margin: "24px 0" }} />
          <blockquote style={s.asideQuote}>
            "Two models, one reading. Every beat accounted for."
          </blockquote>
        </div>
        <p style={s.asideDisclaimer}>For research &amp; clinical decision support only.</p>
      </aside>

      <section style={s.formSection}>
        <div style={s.formInner}>
          <div style={{ marginBottom: 8 }}>
            <Logo onClick={onLogoClick} />
          </div>
          <h1 style={s.formTitle}>{title}</h1>
          <p style={s.formSub}>{subtitle}</p>
          <div style={{ marginTop: 32 }}>{children}</div>
          {footer && <p style={s.formFooter}>{footer}</p>}
        </div>
      </section>
    </div>
  );
}

// ── Login Page ────────────────────────────────────────────────────────────────

export function LoginPage({ onLogin, onSignup, onLogoClick }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null); // { type, message }
  const [showReset, setShowReset] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Show the exact error from the server (e.g. "Incorrect password.")
        setBanner({ type: "error", message: data.detail || "Login failed." });
      } else {
        onLogin(data.user);
      }
    } catch {
      setBanner({ type: "error", message: "Could not reach the server. Is the backend running?" });
    } finally {
      setLoading(false);
    }
  };

  if (showReset) {
    return (
      <ResetPasswordPage
        onBack={() => setShowReset(false)}
        onLogoClick={onLogoClick}
        onLogin={() => setShowReset(false)}
      />
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue your analyses."
      onLogoClick={onLogoClick}
      footer={
        <>
          New here?{" "}
          <button onClick={onSignup} style={s.linkBtn}>
            Create an account
          </button>
        </>
      }
    >
      <form style={s.form} onSubmit={handleSubmit}>
        <Banner type={banner?.type} message={banner?.message} />

        <Field
          label="Username or Email"
          type="text"
          placeholder="you@hospital.org or dr_rao"
          required
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div style={s.rememberRow}>
          <label style={s.checkLabel}>
            <input type="checkbox" style={{ accentColor: "var(--lp-primary)" }} /> Remember me
          </label>
          <button
            type="button"
            style={s.forgotLink}
            onClick={() => setShowReset(true)}
          >
            Forgot password?
          </button>
        </div>

        <button type="submit" style={s.submitBtn} className="lp-glow" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}

// ── Sign-up Page ──────────────────────────────────────────────────────────────

export function SignupPage({ onSignup, onLogin, onLogoClick }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    if (password.length < 6) {
      setBanner({ type: "error", message: "Password must be at least 6 characters." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username || name, email, password, org }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", message: data.detail || "Registration failed." });
      } else {
        onSignup(data.user);
      }
    } catch {
      setBanner({ type: "error", message: "Could not reach the server. Is the backend running?" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start reading ECGs with AI in minutes."
      onLogoClick={onLogoClick}
      footer={
        <>
          Already have an account?{" "}
          <button onClick={onLogin} style={s.linkBtn}>
            Log in
          </button>
        </>
      }
    >
      <form style={s.form} onSubmit={handleSubmit}>
        <Banner type={banner?.type} message={banner?.message} />

        <Field
          label="Full name"
          placeholder="Dr. Asha Rao"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label="Username"
          placeholder="dr_rao (used to log in)"
          required
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Field
          label="Email"
          type="email"
          placeholder="you@hospital.org"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Organisation (optional)"
          placeholder="Hospital or lab"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          placeholder="At least 6 characters"
          minLength={6}
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label style={s.checkLabel}>
          <input
            type="checkbox"
            style={{ accentColor: "var(--lp-primary)", marginTop: 2 }}
            required
          />
          I understand EchoVote is for decision support, not diagnosis.
        </label>
        <button type="submit" style={s.submitBtn} className="lp-glow" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}

// ── Reset Password Page ───────────────────────────────────────────────────────

function ResetPasswordPage({ onBack, onLogoClick }) {
  const [identifier, setIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);

    if (newPassword.length < 6) {
      setBanner({ type: "error", message: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setBanner({ type: "error", message: "Passwords do not match." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", message: data.detail || "Reset failed." });
      } else {
        setDone(true);
        setBanner({ type: "success", message: data.message || "Password reset successfully." });
      }
    } catch {
      setBanner({ type: "error", message: "Could not reach the server. Is the backend running?" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your username or email and choose a new password."
      onLogoClick={onLogoClick}
    >
      <form style={s.form} onSubmit={handleSubmit}>
        <Banner type={banner?.type} message={banner?.message} />

        {!done ? (
          <>
            <Field
              label="Username or Email"
              type="text"
              placeholder="you@hospital.org or dr_rao"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <Field
              label="New Password"
              type="password"
              placeholder="At least 6 characters"
              minLength={6}
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Field
              label="Confirm New Password"
              type="password"
              placeholder="Repeat new password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button type="submit" style={s.submitBtn} className="lp-glow" disabled={loading}>
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </>
        ) : (
          <button
            type="button"
            style={{ ...s.submitBtn, marginTop: 8 }}
            className="lp-glow"
            onClick={onBack}
          >
            ← Back to Login
          </button>
        )}

        {!done && (
          <p style={{ textAlign: "center", marginTop: 12 }}>
            <button type="button" style={s.linkBtn} onClick={onBack}>
              ← Back to Login
            </button>
          </p>
        )}
      </form>
    </AuthShell>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  shell: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    minHeight: "100vh",
    background: "var(--lp-bg)",
    color: "var(--lp-fg)",
    fontFamily: "'Manrope', 'Inter Tight', system-ui, sans-serif",
  },
  aside: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: 40,
    borderRight: "1px solid var(--lp-border)",
    overflow: "hidden",
  },
  asideMono: {
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "var(--lp-accent)",
  },
  asideQuote: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: "-0.02em",
    color: "var(--lp-fg)",
    fontStyle: "normal",
  },
  asideDisclaimer: { fontSize: 11, fontFamily: "monospace", color: "var(--lp-muted)" },
  formSection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
  },
  formInner: { width: "100%", maxWidth: 380 },
  logoBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--lp-fg)",
    marginBottom: 32,
  },
  logoIcon: {
    display: "grid",
    placeItems: "center",
    width: 32,
    height: 32,
    borderRadius: 6,
    background: "var(--lp-primary)",
    color: "#fff",
  },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: "var(--lp-fg)",
  },
  formTitle: {
    fontSize: 36,
    fontWeight: 700,
    letterSpacing: "-0.04em",
    color: "var(--lp-fg)",
  },
  formSub: { marginTop: 8, color: "var(--lp-muted)", fontSize: 15 },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 14, fontWeight: 500, color: "var(--lp-fg)" },
  fieldInput: {
    width: "100%",
    borderRadius: 6,
    border: "1px solid var(--lp-border)",
    background: "var(--lp-card)",
    padding: "10px 12px",
    fontSize: 14,
    color: "var(--lp-fg)",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  fieldError: { fontSize: 12, color: "#e05a4e", marginTop: 2 },
  rememberRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 14,
  },
  checkLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 14,
    color: "var(--lp-muted)",
    cursor: "pointer",
  },
  forgotLink: {
    background: "none",
    border: "none",
    color: "var(--lp-primary)",
    textDecoration: "none",
    fontSize: 14,
    cursor: "pointer",
    padding: 0,
  },
  submitBtn: {
    width: "100%",
    background: "var(--lp-primary)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "11px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
    opacity: 1,
    transition: "opacity 0.2s",
  },
  formFooter: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 14,
    color: "var(--lp-muted)",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "var(--lp-primary)",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
    padding: 0,
  },
};
