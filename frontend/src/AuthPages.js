import React from "react";

function EcgLine({ style }) {
  const d = "M0 60 H120 L135 60 L145 50 L155 60 H200 L210 70 L222 8 L236 104 L248 60 H300 L320 44 L345 60 H460 L475 60 L485 50 L495 60 H540 L550 70 L562 8 L576 104 L588 60 H640 L660 44 L685 60 H800";
  return (
    <svg viewBox="0 0 800 120" preserveAspectRatio="none" style={style} aria-hidden>
      <path d={d} fill="none" stroke="var(--lp-border)" strokeWidth="2" />
      <path d={d} fill="none" stroke="var(--lp-primary)" strokeWidth="2.5" className="ecg-trace" strokeLinejoin="round" />
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

function Field({ label, ...props }) {
  return (
    <label style={s.fieldWrap}>
      <span style={s.fieldLabel}>{label}</span>
      <input {...props} style={s.fieldInput} />
    </label>
  );
}

function AuthShell({ title, subtitle, children, footer, onLogoClick }) {
  return (
    <div style={s.shell}>
      {/* Left panel — hidden on small screens via inline media workaround */}
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
          <div style={{ marginBottom: 8 }}><Logo onClick={onLogoClick} /></div>
          <h1 style={s.formTitle}>{title}</h1>
          <p style={s.formSub}>{subtitle}</p>
          <div style={{ marginTop: 32 }}>{children}</div>
          <p style={s.formFooter}>{footer}</p>
        </div>
      </section>
    </div>
  );
}

export function LoginPage({ onLogin, onSignup, onLogoClick }) {
  const [email, setEmail] = React.useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    // Derive a display name from the email prefix (e.g. "dr.rao@..." → "Dr.rao")
    const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    onLogin({ name, org: "" });
  };
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue your analyses."
      onLogoClick={onLogoClick}
      footer={<>New here? <button onClick={onSignup} style={s.linkBtn}>Create an account</button></>}
    >
      <form style={s.form} onSubmit={handleSubmit}>
        <Field label="Email" type="email" placeholder="you@hospital.org" required value={email} onChange={e => setEmail(e.target.value)} />
        <Field label="Password" type="password" placeholder="••••••••" required />
        <div style={s.rememberRow}>
          <label style={s.checkLabel}>
            <input type="checkbox" style={{ accentColor: "var(--lp-primary)" }} /> Remember me
          </label>
          <a href="#" style={s.forgotLink}>Forgot password?</a>
        </div>
        <button type="submit" style={s.submitBtn} className="lp-glow">Log in</button>
      </form>
    </AuthShell>
  );
}

export function SignupPage({ onSignup, onLogin, onLogoClick }) {
  const [name, setName] = React.useState("");
  const [org, setOrg] = React.useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    onSignup({ name, org });
  };
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start reading ECGs with AI in minutes."
      onLogoClick={onLogoClick}
      footer={<>Already have an account? <button onClick={onLogin} style={s.linkBtn}>Log in</button></>}
    >
      <form style={s.form} onSubmit={handleSubmit}>
        <Field label="Full name" placeholder="Dr. Asha Rao" required value={name} onChange={e => setName(e.target.value)} />
        <Field label="Email" type="email" placeholder="you@hospital.org" required />
        <Field label="Organisation (optional)" placeholder="Hospital or lab" value={org} onChange={e => setOrg(e.target.value)} />
        <Field label="Password" type="password" placeholder="At least 8 characters" minLength={8} required />
        <label style={s.checkLabel}>
          <input type="checkbox" style={{ accentColor: "var(--lp-primary)", marginTop: 2 }} required />
          I understand EchoVote is for decision support, not diagnosis.
        </label>
        <button type="submit" style={s.submitBtn} className="lp-glow">Create account</button>
      </form>
    </AuthShell>
  );
}

const s = {
  shell: { display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh", background: "var(--lp-bg)", color: "var(--lp-fg)", fontFamily: "'Manrope', 'Inter Tight', system-ui, sans-serif" },
  aside: { display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 40, borderRight: "1px solid var(--lp-border)", overflow: "hidden" },
  asideMono: { fontSize: 11, fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--lp-accent)" },
  asideQuote: { fontSize: 28, fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.02em", color: "var(--lp-fg)", fontStyle: "normal" },
  asideDisclaimer: { fontSize: 11, fontFamily: "monospace", color: "var(--lp-muted)" },
  formSection: { display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" },
  formInner: { width: "100%", maxWidth: 360 },
  logoBtn: { display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "var(--lp-fg)", marginBottom: 32 },
  logoIcon: { display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 6, background: "var(--lp-primary)", color: "#fff" },
  logoText: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--lp-fg)" },
  formTitle: { fontSize: 36, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--lp-fg)" },
  formSub: { marginTop: 8, color: "var(--lp-muted)", fontSize: 15 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: 500, color: "var(--lp-fg)" },
  fieldInput: { width: "100%", borderRadius: 6, border: "1px solid var(--lp-border)", background: "var(--lp-card)", padding: "10px 12px", fontSize: 14, color: "var(--lp-fg)", outline: "none", boxSizing: "border-box" },
  rememberRow: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 },
  checkLabel: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--lp-muted)", cursor: "pointer" },
  forgotLink: { color: "var(--lp-primary)", textDecoration: "none", fontSize: 14 },
  submitBtn: { width: "100%", background: "var(--lp-primary)", color: "#fff", border: "none", borderRadius: 6, padding: "11px", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  formFooter: { marginTop: 24, textAlign: "center", fontSize: 14, color: "var(--lp-muted)" },
  linkBtn: { background: "none", border: "none", color: "var(--lp-primary)", fontWeight: 600, cursor: "pointer", fontSize: 14, padding: 0 },
};
