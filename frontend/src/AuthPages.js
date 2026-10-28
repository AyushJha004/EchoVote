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
        padding: "12px 16px",
        borderRadius: 10,
        fontSize: 15,
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
          <EcgLine style={{ height: 180, width: "100%", margin: "32px 0" }} />
          <blockquote style={s.asideQuote}>
            "Eight models, one reading. Every beat accounted for."
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
            <input type="checkbox" style={{ accentColor: "var(--lp-primary)", width: 18, height: 18 }} /> Remember me
          </label>
        </div>

        <button type="submit" style={s.submitBtn} className="lp-glow" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>
        <p style={s.forgotNote}>
          Forgot your password? Contact your administrator to have it reset.
        </p>
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
            style={{ accentColor: "var(--lp-primary)", marginTop: 2, width: 18, height: 18, flexShrink: 0 }}
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
    padding: 56,
    borderRight: "1px solid var(--lp-border)",
    overflow: "hidden",
  },
  asideMono: {
    fontSize: 14,
    fontFamily: "monospace",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "var(--lp-accent)",
  },
  asideQuote: {
    fontSize: 38,
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: "-0.02em",
    color: "var(--lp-fg)",
    fontStyle: "normal",
  },
  asideDisclaimer: { fontSize: 14, fontFamily: "monospace", color: "var(--lp-muted)" },
  formSection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
  },
  formInner: { width: "100%", maxWidth: 520 },
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
    width: 36,
    height: 36,
    borderRadius: 6,
    background: "var(--lp-primary)",
    color: "#fff",
  },
  logoText: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: "var(--lp-fg)",
  },
  formTitle: {
    fontSize: 46,
    fontWeight: 700,
    letterSpacing: "-0.04em",
    color: "var(--lp-fg)",
  },
  formSub: { marginTop: 10, color: "var(--lp-muted)", fontSize: 18 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 7 },
  fieldLabel: { fontSize: 16, fontWeight: 600, color: "var(--lp-fg)" },
  fieldInput: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid var(--lp-border)",
    background: "var(--lp-card)",
    padding: "14px 16px",
    fontSize: 17,
    color: "var(--lp-fg)",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  fieldError: { fontSize: 14, color: "#e05a4e", marginTop: 2 },
  rememberRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 16,
  },
  checkLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    fontSize: 16,
    color: "var(--lp-muted)",
    cursor: "pointer",
  },
  forgotNote: { margin: 0, textAlign: "center", fontSize: 15, color: "var(--lp-muted)" },
  submitBtn: {
    width: "100%",
    background: "var(--lp-primary)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "15px",
    fontSize: 18,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
    opacity: 1,
    transition: "opacity 0.2s",
  },
  formFooter: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 16,
    color: "var(--lp-muted)",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "var(--lp-primary)",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
    padding: 0,
  },
};
