import React from "react";

const ECG_PATH =
  "M0 60 H120 L135 60 L145 50 L155 60 H200 L210 70 L222 8 L236 104 L248 60 H300 L320 44 L345 60 H460 L475 60 L485 50 L495 60 H540 L550 70 L562 8 L576 104 L588 60 H640 L660 44 L685 60 H800";

function EcgLine({ style }) {
  return (
    <svg viewBox="0 0 800 120" preserveAspectRatio="none" style={style} aria-hidden>
      <path d={ECG_PATH} fill="none" stroke="var(--lp-border)" strokeWidth="2" />
      <path d={ECG_PATH} fill="none" stroke="var(--lp-primary)" strokeWidth="2.5" className="ecg-trace" strokeLinejoin="round" />
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

const features = [
  { k: "01", t: "8-model ensemble", d: "Three deep learning and five classical ML models read the same signal. You see where they agree — and where they don't." },
  { k: "02", t: "Beat-level classes", d: "Every beat sorted into N, S, V, F and Q classes with confidence scores you can inspect." },
  { k: "03", t: "Explainable heatmaps", d: "See which parts of a beat most influenced the prediction, shown on the waveform." },
];

const stats = [
  { v: "8", l: "AI Models" },
  { v: "5", l: "Beat classes" },
  { v: "3", l: "Input types" },
  { v: "2-page", l: "PDF report" },
];

export default function LandingPage({ onLogin, onSignup }) {
  return (
    <div style={s.page}>
      {/* Hero section with ECG grid */}
      <div style={s.heroSection} className="lp-ecg-grid">
        <header style={s.header}>
          <Logo onLogin={onLogin} />
          <nav style={s.nav}>
            <button onClick={onLogin} style={s.navLink}>Log in</button>
            <button onClick={onSignup} style={s.navCta}>Sign up</button>
          </nav>
        </header>

        <section style={s.hero}>
          <p style={s.eyebrow}>
            <span style={s.eyebrowDot} />
            ECG arrhythmia analysis
          </p>
          <h1 style={s.heroTitle}>
            Read every heartbeat,{" "}
            <em style={{ color: "var(--lp-primary)", fontStyle: "normal" }}>not just the rhythm.</em>
          </h1>
          <p style={s.heroSub}>
            Upload an ECG and EchoVote classifies each beat with eight AI models, then highlights the parts of the waveform that influenced the result.
          </p>
          <p style={{ margin: "-4px 0 20px", fontSize: 13, color: "var(--lp-muted)" }}>
            Research prototype. Not a certified medical device; it does not provide a diagnosis.
          </p>
          <div style={s.heroBtns}>
            <button onClick={onSignup} style={s.btnPrimary} className="lp-glow">Create free account</button>
            <button onClick={onLogin} style={s.btnSecondary}>I already have one</button>
          </div>
          <div style={s.ecgCard}>
            <div style={s.ecgCardMeta}>
              <span>LEAD II · 360 Hz</span>
              <span style={{ color: "var(--lp-accent)" }}>● N · Normal beat · 0.97</span>
            </div>
            <EcgLine style={{ height: 112, width: "100%" }} />
          </div>
        </section>
      </div>

      {/* Stats strip */}
      <div style={s.statsStrip}>
        {stats.map((st) => (
          <div key={st.l} style={s.statItem}>
            <div style={s.statVal}>{st.v}</div>
            <div style={s.statLabel}>{st.l}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <section style={s.featuresSection}>
        <h2 style={s.featuresTitle}>Built for people who read waveforms for a living.</h2>
        <div style={s.featuresGrid}>
          {features.map((f) => (
            <div key={f.k} style={s.featureCard}>
              <span style={s.featureNum}>{f.k}</span>
              <h3 style={s.featureTitle}>{f.t}</h3>
              <p style={s.featureSub}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={s.ctaSection}>
        <div style={s.ctaBox} className="lp-ecg-grid">
          <div>
            <h2 style={s.ctaTitle}>Your first analysis takes a minute.</h2>
            <p style={s.ctaSub}>Sign up, upload a recording, read the result.</p>
          </div>
          <button onClick={onSignup} style={s.btnPrimary} className="lp-glow">Get started</button>
        </div>
      </section>

      <footer style={s.footer}>
        <Logo />
        <p style={s.footerNote}>Decision support only — not a substitute for clinical judgement.</p>
      </footer>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "var(--lp-bg)", color: "var(--lp-fg)", fontFamily: "'Manrope', 'Inter Tight', system-ui, sans-serif" },
  heroSection: { position: "relative", overflow: "hidden" },
  header: { maxWidth: 1152, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px" },
  logoBtn: { display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "var(--lp-fg)" },
  logoIcon: { display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 6, background: "var(--lp-primary)", color: "#fff" },
  logoText: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--lp-fg)" },
  nav: { display: "flex", alignItems: "center", gap: 8 },
  navLink: { background: "none", border: "none", cursor: "pointer", padding: "8px 16px", borderRadius: 6, color: "var(--lp-muted)", fontSize: 14, fontWeight: 500, transition: "color 0.2s" },
  navCta: { background: "var(--lp-primary)", border: "none", cursor: "pointer", padding: "8px 16px", borderRadius: 6, color: "#fff", fontSize: 14, fontWeight: 600 },
  hero: { maxWidth: 1152, margin: "0 auto", padding: "48px 24px 64px" },
  eyebrow: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--lp-accent)", background: "var(--lp-card)", border: "1px solid var(--lp-border)", borderRadius: 999, padding: "4px 12px", marginBottom: 24 },
  eyebrowDot: { width: 8, height: 8, borderRadius: "50%", background: "var(--lp-accent)", animation: "pulse 2s ease-in-out infinite" },
  heroTitle: { fontSize: "clamp(36px, 6vw, 68px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02, maxWidth: 720, marginBottom: 24, color: "var(--lp-fg)" },
  heroSub: { fontSize: 18, color: "var(--lp-muted)", maxWidth: 520, marginBottom: 32, lineHeight: 1.6 },
  heroBtns: { display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 56 },
  btnPrimary: { background: "var(--lp-primary)", color: "#fff", border: "none", borderRadius: 6, padding: "12px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "transform 0.15s" },
  btnSecondary: { background: "var(--lp-card)", color: "var(--lp-fg)", border: "1px solid var(--lp-border)", borderRadius: 6, padding: "12px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  ecgCard: { background: "rgba(255,255,255,0.04)", border: "1px solid var(--lp-border)", borderRadius: 12, padding: 16, backdropFilter: "blur(8px)" },
  ecgCardMeta: { display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "monospace", color: "var(--lp-muted)", marginBottom: 8, letterSpacing: "0.05em" },
  statsStrip: { borderTop: "1px solid var(--lp-border)", borderBottom: "1px solid var(--lp-border)", background: "var(--lp-card)", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" },
  statItem: { padding: "32px 24px", borderRight: "1px solid var(--lp-border)" },
  statVal: { fontSize: 36, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--lp-fg)" },
  statLabel: { fontSize: 11, fontFamily: "monospace", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--lp-muted)", marginTop: 4 },
  featuresSection: { maxWidth: 1152, margin: "0 auto", padding: "80px 24px" },
  featuresTitle: { fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 700, letterSpacing: "-0.03em", maxWidth: 520, marginBottom: 48, color: "var(--lp-fg)" },
  featuresGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 1, background: "var(--lp-border)", border: "1px solid var(--lp-border)", borderRadius: 12, overflow: "hidden" },
  featureCard: { background: "var(--lp-bg)", padding: 32, transition: "background 0.2s" },
  featureNum: { fontSize: 13, fontFamily: "monospace", color: "var(--lp-primary)", fontWeight: 600 },
  featureTitle: { fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 8, color: "var(--lp-fg)" },
  featureSub: { fontSize: 14, color: "var(--lp-muted)", lineHeight: 1.7 },
  ctaSection: { maxWidth: 1152, margin: "0 auto", padding: "0 24px 80px" },
  ctaBox: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 24, border: "1px solid var(--lp-border)", borderRadius: 16, background: "var(--lp-card)", padding: 40 },
  ctaTitle: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--lp-fg)" },
  ctaSub: { fontSize: 15, color: "var(--lp-muted)", marginTop: 8 },
  footer: { borderTop: "1px solid var(--lp-border)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, maxWidth: 1152, margin: "0 auto", padding: "32px 24px" },
  footerNote: { fontSize: 12, fontFamily: "monospace", color: "var(--lp-muted)" },
};
