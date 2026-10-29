import React, { useState, useRef, useEffect } from "react";
import "./index.css";
import "./shell.css";
import "./pages.css";
import ECGChart from "./ECGChart";
import ResultsPanel from "./ResultsPanel";
import LandingPage from "./LandingPage";
import { LoginPage, SignupPage } from "./AuthPages";
import { getEnsemblePrediction } from "./ensemble";
import { GuidePage, AboutPage } from "./InfoPages";
import AccountPage from "./AccountPage";
import {
  IconPulse, IconKey, IconHistory, IconBook, IconInfo, IconLogout, IconUpload, IconFile,
  IconCamera, IconPaste, IconFlask, IconPlus, IconShield, IconCheck, IconArrow, LogoMark,
} from "./icons";

const API = process.env.REACT_APP_API_BASE || "";

const NAV = [
  { id: "upload", Icon: IconPulse, label: "Analyze" },
  { id: "history", Icon: IconHistory, label: "History" },
  { id: "guide", Icon: IconBook, label: "Guide" },
  { id: "about", Icon: IconInfo, label: "About" },
];

const PAGE_TITLES = {
  upload: "Analyze",
  history: "History",
  guide: "Clinical Guide",
  about: "About",
  account: "Account",
};

const SAMPLES = [
  { type: "normal", label: "Normal sinus rhythm", sub: "Clean P-QRS-T, narrow QRS", color: "#34d399" },
  { type: "ventricular", label: "Ventricular (PVC)", sub: "Wide bizarre QRS, no P wave", color: "#f87171" },
  { type: "supraventricular", label: "Supraventricular (PAC)", sub: "Early narrow QRS, abnormal P wave", color: "#6b8cff" },
  { type: "fusion", label: "Fusion beat", sub: "Widened intermediate QRS", color: "#fbbf24" },
];

export default function App() {
  const [authPage, setAuthPage] = useState("landing"); // "landing" | "login" | "signup" | "app"
  const [user, setUser] = useState(null); // { name, org }
  const [page, setPage] = useState("upload");
  const [inputTab, setInputTab] = useState("csv");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [serverOk, setServerOk] = useState(null);
  const [modelsLive, setModelsLive] = useState(false);
  const [manualText, setManualText] = useState("");
  const csvRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    let active = true;
    let retryTimer;
    let requestTimer;

    const checkHealth = async () => {
      const controller = new AbortController();
      requestTimer = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${API}/api/health`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
        const data = await response.json();
        if (!active) return;
        setServerOk(true);
        setModelsLive(Boolean(data.live));
      } catch {
        if (active) setServerOk(false);
      } finally {
        clearTimeout(requestTimer);
        if (active) retryTimer = setTimeout(checkHealth, 5000);
      }
    };

    checkHealth();
    return () => {
      active = false;
      clearTimeout(retryTimer);
      clearTimeout(requestTimer);
    };
  }, []);

  const post = async (url, body, isForm = false, input = "Manual") => {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`${API}${url}`, {
        method: "POST",
        body,
        headers: isForm ? undefined : { "Content-Type": "application/json" },
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : null;
      if (!res.ok) {
        throw new Error(
          data?.detail || `Server returned ${res.status} ${res.statusText}`
        );
      }
      if (!data) throw new Error("Server returned an unexpected non-JSON response");
      setResults(data);
      setHistory((h) => [
        { id: Date.now(), at: Date.now(), input, data },
        ...h.slice(0, 9),
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCSV = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    await post("/api/predict/csv", fd, true, "CSV");
  };
  const handleImage = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    await post("/api/predict/image", fd, true, "Photo");
  };

  const parseManual = (text) => {
    // Split on any non-numeric separator (handles comma, tab, space, mixed)
    const vals = text
      .trim()
      .split(/[^0-9Ee.+\-]+/)
      .map((v) => parseFloat(v))
      .filter((v) => !isNaN(v));
    // Strip trailing label column if 188 values and last is 0-4
    if (
      vals.length === 188 &&
      vals[187] >= 0 &&
      vals[187] <= 4 &&
      Number.isInteger(vals[187])
    )
      return vals.slice(0, 187);
    console.log(
      "parseManual parsed:",
      vals.length,
      "| first3:",
      vals.slice(0, 3),
      "| last3:",
      vals.slice(-3),
    );
    return vals;
  };

  const handleManual = async () => {
    const vals = parseManual(manualText);
    if (vals.length !== 187) {
      setError(`Need 187 values, got ${vals.length}`);
      return;
    }
    await post("/api/predict/manual", JSON.stringify({ values: vals }), false, "Paste");
  };

  const handleSample = async (type = "normal") => {
    const sig = Array.from({ length: 187 }, (_, i) => {
      let v = Math.random() * 0.06 - 0.03;
      if (type === "normal") {
        if (i >= 20 && i <= 30) v += Math.sin(((i - 20) / 10) * Math.PI) * 0.25;
        if (i >= 55 && i <= 68) v += Math.sin(((i - 55) / 13) * Math.PI) * 2.2;
        if (i >= 130 && i <= 150)
          v += Math.sin(((i - 130) / 20) * Math.PI) * 0.4;
      } else if (type === "ventricular") {
        if (i >= 50 && i <= 90) {
          const t = (i - 50) / 40;
          v += Math.sin(t * Math.PI) * 2.5 * (1 - t);
          if (i >= 70 && i <= 90)
            v -= Math.sin(((i - 70) / 20) * Math.PI) * 1.8;
        }
        if (i >= 110 && i <= 145)
          v -= Math.sin(((i - 110) / 35) * Math.PI) * 0.6;
      } else if (type === "supraventricular") {
        if (i >= 10 && i <= 18) v += Math.sin(((i - 10) / 8) * Math.PI) * 0.15;
        if (i >= 40 && i <= 52) v += Math.sin(((i - 40) / 12) * Math.PI) * 1.9;
        if (i >= 100 && i <= 118)
          v += Math.sin(((i - 100) / 18) * Math.PI) * 0.35;
        if (i >= 155 && i <= 170)
          v += Math.sin(((i - 155) / 15) * Math.PI) * 1.7;
      } else if (type === "fusion") {
        if (i >= 25 && i <= 33) v += Math.sin(((i - 25) / 8) * Math.PI) * 0.18;
        if (i >= 55 && i <= 78) {
          v += Math.sin(((i - 55) / 23) * Math.PI) * 1.8;
          if (i >= 65 && i <= 78)
            v += Math.sin(((i - 65) / 13) * Math.PI) * 0.9;
        }
        if (i >= 120 && i <= 145)
          v += Math.sin(((i - 120) / 25) * Math.PI) * 0.3;
      }
      return parseFloat(v.toFixed(4));
    });
    await post("/api/predict/manual", JSON.stringify({ values: sig }), false, "Sample");
  };

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const Sidebar = () => (
    <aside className="ev-rail" aria-label="Main navigation">
      <div className="ev-brand">
        <LogoMark size={36} />
        <span className="ev-brand-name">EchoVote</span>
      </div>
      {NAV.map(({ id, Icon, label }) => (
        <button
          key={id}
          type="button"
          className={`ev-nav-btn${page === id ? " is-active" : ""}`}
          onClick={() => setPage(id)}
          title={label}
          aria-current={page === id ? "page" : undefined}
        >
          <Icon />
          <span className="ev-nav-label">{label}</span>
        </button>
      ))}
      <div className="ev-rail-spacer" />
      <div className="ev-rail-note">
        Research prototype. Not a certified medical device; not for diagnosis.
      </div>
    </aside>
  );

  const TRACE =
    "M0 30 L60 30 L75 30 L85 8 L97 52 L108 30 L190 30 L205 24 L220 30 L300 30 L315 30 L325 6 L337 54 L348 30 L430 30 L445 24 L460 30 L560 30";

  const UploadPanel = () => (
    <div>
      <div className="ev-seg" role="tablist">
        {[
          { id: "csv", label: "CSV", Icon: IconFile },
          { id: "image", label: "Photo", Icon: IconCamera },
          { id: "manual", label: "Paste", Icon: IconPaste },
          { id: "sample", label: "Samples", Icon: IconFlask },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={inputTab === id}
            className={inputTab === id ? "is-active" : ""}
            onClick={() => setInputTab(id)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>

      {(inputTab === "csv" || inputTab === "image") && (
        <>
          <div
            className="ev-drop"
            role="button"
            tabIndex={0}
            onClick={() => (inputTab === "csv" ? csvRef : imgRef).current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                (inputTab === "csv" ? csvRef : imgRef).current?.click();
            }}
          >
            <div className="ev-drop-icon">
              {inputTab === "csv" ? <IconUpload size={28} /> : <IconCamera size={28} />}
            </div>
            <h3>{inputTab === "csv" ? "Upload a CSV file" : "Upload an ECG photo"}</h3>
            <p>
              {inputTab === "csv"
                ? "One heartbeat · 187 comma-separated values"
                : "JPG or PNG of an ECG strip · the signal is extracted automatically"}
            </p>
            <span className="ev-btn ev-btn--primary">
              {inputTab === "csv" ? "Choose file" : "Choose image"}
            </span>
            <svg className="ev-drop-trace" viewBox="0 0 560 60" preserveAspectRatio="none" aria-hidden="true">
              <path d={TRACE} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
          <input ref={csvRef} type="file" accept=".csv" onChange={handleCSV} style={{ display: "none" }} />
          <input ref={imgRef} type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
        </>
      )}

      {inputTab === "manual" && (
        <div>
          <textarea
            className="ev-textarea"
            placeholder="Paste 187 values — comma, tab or space separated, e.g. 9.60E-01 8.63E-01 4.62E-01 ..."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
          />
          <div className="ev-count">
            {manualText ? `${parseManual(manualText).length}/187 values` : "0/187 values"}
          </div>
          <button
            type="button"
            className="ev-btn ev-btn--primary"
            onClick={handleManual}
            disabled={loading}
          >
            {loading ? "Analyzing…" : "Analyze signal"}
          </button>
        </div>
      )}

      {inputTab === "sample" && (
        <div>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-muted)" }}>
            Generate a synthetic beat to try the workflow. Synthetic beats only demonstrate the
            interface; they are not clinical data.
          </p>
          <div className="ev-samples">
            {SAMPLES.map(({ type, label, sub, color }) => (
              <button
                key={type}
                type="button"
                className="ev-sample"
                style={{ "--sample-color": color }}
                disabled={loading}
                onClick={() => handleSample(type)}
              >
                <i className="ev-sample-dot" />
                <div>
                  <b>{label}</b>
                  <span>{sub}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="ev-feedback is-error" role="alert">
          <strong>Analysis failed.</strong> {error}
          {serverOk === false && <div style={{ marginTop: 6 }}>The backend is offline.</div>}
        </div>
      )}
      {loading && (
        <div className="ev-feedback is-loading" role="status">
          <div className="ev-spin" />
          <span>Analysing the ECG…</span>
        </div>
      )}
    </div>
  );

  const COLOR_MAP = {
    "Normal (N)": "#0f9d8a",
    "Supraventricular (S)": "#3d55e6",
    "Ventricular (V)": "#c2362b",
    "Fusion (F)": "#d98324",
    "Unclassifiable (Q)": "#5b4bd6",
  };
  const ICON_MAP = {
    "Normal (N)": "✓",
    "Supraventricular (S)": "◈",
    "Ventricular (V)": "⚠",
    "Fusion (F)": "◉",
    "Unclassifiable (Q)": "?",
  };
  const CLASS_LIST = [
    "Normal (N)",
    "Supraventricular (S)",
    "Ventricular (V)",
    "Fusion (F)",
    "Unclassifiable (Q)",
  ];

  const historyRows = history.map((h) => {
    const { scores, prediction, classIndex } = getEnsemblePrediction(
      h.data.predictions,
      h.data.ensemble_probs,
      CLASS_LIST,
    );
    const conf = classIndex >= 0 ? scores[classIndex] : null;
    const letter = prediction?.match(/\((.)\)/)?.[1] || "?";
    const flagged = h.data.arrhythmia?.detected;
    let outcome = { label: "No action", tone: "ok" };
    if (prediction === "Unknown" || letter === "Q" || conf == null) {
      outcome = { label: "Review manually", tone: "warn" };
    } else if (flagged ?? letter !== "N") {
      outcome = { label: "Review recommended", tone: "warn" };
    }
    return {
      h,
      letter,
      conf,
      outcome,
      color: COLOR_MAP[prediction] || "#5b4bd6",
      shortName: prediction.replace(/\s*\(.\)$/, ""),
      dateText: new Date(h.at).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    };
  });

  const historyVisible = historyRows.filter((r) => {
    if (historyFilter !== "all" && r.letter !== historyFilter) return false;
    const q = historySearch.trim().toLowerCase();
    return (
      !q || `${r.dateText} ${r.h.input} ${r.shortName}`.toLowerCase().includes(q)
    );
  });

  // Called as a function (not <HistoryPage />) so typing in the search box
  // does not remount the page and drop focus.
  const HistoryPage = () => (
    <div className="anim-fadeUp">
      <div className="ev-page-head">
        <h1>
          History <span className="ev-pill">This session</span>
        </h1>
        <p>
          Previous screenings, newest first. Open one to see its waveform,
          sensitivity map and report. Records clear on refresh.
        </p>
      </div>
      <div className="ev-hist-tools">
        <div className="ev-hist-search">
          <input
            type="search"
            placeholder="Search by date or input type"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
          />
        </div>
        <select
          className="ev-hist-select"
          value={historyFilter}
          onChange={(e) => setHistoryFilter(e.target.value)}
        >
          <option value="all">All beat types</option>
          {CLASS_LIST.map((c) => {
            const l = c.match(/\((.)\)/)[1];
            return (
              <option key={l} value={l}>
                {c.replace(/\s*\(.\)$/, "")}
              </option>
            );
          })}
        </select>
        <span className="ev-hist-count">
          {historyVisible.length} result{historyVisible.length === 1 ? "" : "s"}
        </span>
      </div>
      {history.length === 0 ? (
        <div style={st.empty}>No analyses yet. Upload an ECG to get started.</div>
      ) : (
        <div className="ev-hist-table" role="table">
          <div className="ev-hist-row ev-hist-head" role="row">
            <span>Date and time</span>
            <span>Input</span>
            <span>Beat type</span>
            <span>Confidence</span>
            <span>Outcome</span>
            <span />
          </div>
          {historyVisible.length === 0 && (
            <div className="ev-hist-none">No records match.</div>
          )}
          {historyVisible.map((r) => (
            <button
              type="button"
              key={r.h.id}
              className="ev-hist-row"
              role="row"
              onClick={() => {
                setResults(r.h.data);
                setPage("upload");
              }}
            >
              <span>{r.dateText}</span>
              <span>{r.h.input}</span>
              <span className="ev-hist-type">
                <i className="ev-hist-letter" style={{ "--c": r.color }}>
                  {r.letter}
                </i>
                {r.shortName}
              </span>
              <span className="ev-hist-conf">
                {r.conf == null ? "–" : `${Math.round(r.conf * 100)}%`}
              </span>
              <span className={`ev-hist-outcome is-${r.outcome.tone}`}>
                <b />
                {r.outcome.label}
              </span>
              <span className="ev-hist-open">Open ›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // user object from /auth/login or /auth/register: { id, username, email, org }
  const handleLogin = (userData) => {
    // Normalise: support both old {name} shape and new {username} shape
    const normalised = {
      name: userData.name || userData.username || "User",
      org:  userData.org  || "",
      email: userData.email || "",
      username: userData.username || userData.name || "User",
    };
    setUser(normalised);
    setAuthPage("app");
  };
  const handleLogout = () => { setUser(null); setResults(null); setHistory([]); setAuthPage("landing"); };

  if (authPage === "landing")
    return <LandingPage onLogin={() => setAuthPage("login")} onSignup={() => setAuthPage("signup")} />;
  if (authPage === "login")
    return <LoginPage onLogin={handleLogin} onSignup={() => setAuthPage("signup")} onLogoClick={() => setAuthPage("landing")} />;
  if (authPage === "signup")
    return <SignupPage onSignup={handleLogin} onLogin={() => setAuthPage("login")} onLogoClick={() => setAuthPage("landing")} />;

  const statusClass = serverOk === false || (serverOk && !modelsLive) ? "is-bad" : serverOk ? "is-live" : "";
  const statusText =
    serverOk === null ? "Connecting" : !serverOk ? "Offline" : modelsLive ? "Live" : "Models unavailable";

  return (
    <div className="ev-app">
      <Sidebar />
      <div className="ev-main">
        <header className="ev-top">
          <div className="ev-top-left">
            <div className="ev-title">{PAGE_TITLES[page]}</div>
            <span className={`ev-pill ${statusClass}`}>
              <i />
              {statusText}
            </span>
          </div>
          <div className="ev-top-right">
            {results && page === "upload" && (
              <button type="button" className="ev-btn ev-btn--primary" onClick={() => setResults(null)}>
                <IconPlus size={16} /> New analysis
              </button>
            )}
            <div className="ev-user">
              <div className="ev-avatar">{initials}</div>
              <div className="ev-user-meta">
                <div className="ev-user-name">{user?.email || user?.name || "Guest"}</div>
                {user?.org && <div className="ev-user-org">{user.org}</div>}
              </div>
              <button type="button" className="ev-icon-btn ev-icon-btn--key" onClick={() => setPage("account")} title="Change password" aria-label="Change password">
                <IconKey size={17} />
              </button>
              <button type="button" className="ev-icon-btn" onClick={handleLogout} title="Log out" aria-label="Log out">
                <IconLogout size={17} />
              </button>
            </div>
          </div>
        </header>

        <div className="ev-content">
          <div className="ev-content-inner">
            {page === "upload" && !results && (
              <>
                <section className="ev-hero">
                  <div className="ev-eyebrow">
                    <IconPulse size={14} /> Arrhythmia screening
                  </div>
                  <h1>
                    Screen an ECG for <span>arrhythmia</span>
                  </h1>
                  <p>
                    Upload a heartbeat or a photo of an ECG strip, or paste raw values. You receive a
                    clear screening result, the most likely beat type, and the parts of the
                    waveform that drove the finding.
                  </p>
                </section>
                <div className="ev-grid">
                  <section className="ev-panel">
                    <h2 className="ev-panel-title">Select ECG input</h2>
                    <UploadPanel />
                  </section>
                  <aside className="ev-panel">
                    <h2 className="ev-panel-title">How it works</h2>
                    <ol className="ev-steps">
                      <li>
                        <span className="ev-step-n">01</span>
                        <div>
                          <b>Provide a beat</b>
                          <span>A single 187-sample heartbeat as CSV, pasted values, or an ECG photo.</span>
                        </div>
                      </li>
                      <li>
                        <span className="ev-step-n">02</span>
                        <div>
                          <b>Automated analysis</b>
                          <span>Several independent algorithms assess each beat and their findings are combined.</span>
                        </div>
                      </li>
                      <li>
                        <span className="ev-step-n">03</span>
                        <div>
                          <b>Review and export</b>
                          <span>Read the screen, inspect the sensitivity map, and download a report.</span>
                        </div>
                      </li>
                    </ol>
                    <div className="ev-notice">
                      <IconShield size={18} />
                      <div>
                        Decision-support research tool. It is not a certified medical device and
                        does not replace clinical judgement. A clinician must confirm every finding.
                      </div>
                    </div>
                  </aside>
                </div>

                <section className="ev-section">
                  <div className="ev-section-head">
                    <h2>Beat types reported</h2>
                    <span>AAMI EC57 classes</span>
                  </div>
                  <div className="ev-tiles">
                    {[
                      { code: "N", name: "Normal", text: "Resembles a normal heartbeat.", color: "#34d399" },
                      { code: "S", name: "Supraventricular", text: "Early beat arising above the ventricles.", color: "#6b8cff" },
                      { code: "V", name: "Ventricular", text: "Beat arising in the ventricles.", color: "#f87171" },
                      { code: "F", name: "Fusion", text: "Blend of a normal and a ventricular beat.", color: "#fbbf24" },
                      { code: "Q", name: "Unclassifiable", text: "Could not be classified; review manually.", color: "#a78bfa" },
                    ].map(({ code, name, text, color }) => (
                      <article className="ev-tile" key={code} style={{ "--c": color }}>
                        <div className="ev-badge">{code}</div>
                        <b>{name}</b>
                        <span>{text}</span>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="ev-section ev-two">
                  <div className="ev-panel">
                    <div className="ev-section-head" style={{ margin: "0 0 14px" }}>
                      <h2>Recent analyses</h2>
                      {history.length > 0 && (
                        <button type="button" className="ev-btn" onClick={() => setPage("history")}>
                          View all <IconArrow size={15} />
                        </button>
                      )}
                    </div>
                    {history.length === 0 ? (
                      <div className="ev-empty">
                        <IconPulse size={26} />
                        Your analyses from this session will appear here.
                      </div>
                    ) : (
                      <ul className="ev-recent">
                        {history.slice(0, 4).map((h) => {
                          const { prediction } = getEnsemblePrediction(
                            h.data.predictions,
                            h.data.ensemble_probs,
                            CLASS_LIST,
                          );
                          const color = COLOR_MAP[prediction] || "#a78bfa";
                          const flagged = h.data.arrhythmia?.detected;
                          return (
                            <li key={h.id}>
                              <button
                                type="button"
                                style={{ "--c": color }}
                                onClick={() => {
                                  setResults(h.data);
                                  setPage("upload");
                                }}
                              >
                                <div className="ev-badge" style={{ "--c": color }}>
                                  {prediction?.match(/\((.)\)/)?.[1] || "?"}
                                </div>
                                <div className="ev-recent-main">
                                  <b>{prediction}</b>
                                  <span>{new Date(h.at).toLocaleTimeString()}</span>
                                </div>
                                {h.data.arrhythmia && (
                                  <span className={`ev-flag ${flagged ? "is-warn" : "is-ok"}`}>
                                    {flagged ? "Possible arrhythmia" : "No arrhythmia"}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <aside className="ev-panel">
                    <h2 className="ev-panel-title">For best results</h2>
                    <ul className="ev-tips">
                      {[
                        "Use a single heartbeat of 187 samples for CSV or pasted input.",
                        "For photos, use a straight, well-lit, in-focus image with a clearly visible trace.",
                        "Photo results are less reliable than digital signals; check them against the original ECG.",
                        "Always interpret the result alongside the full ECG and the clinical picture.",
                      ].map((tip) => (
                        <li key={tip}>
                          <IconCheck size={16} />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </aside>
                </section>
              </>
            )}
            {page === "upload" && results && <ResultsPanel data={results} />}
            {page === "history" && HistoryPage()}
            {page === "guide" && <GuidePage />}
            {page === "about" && <AboutPage />}
            {page === "account" && <AccountPage user={user} />}
          </div>
        </div>
      </div>
    </div>
  );
}

const st = {
  app: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
    background: "var(--bg-base)",
    fontFamily: "var(--font)",
  },
  sidebar: {
    background: "var(--bg-sidebar)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    transition: "width 0.3s var(--ease)",
    overflow: "hidden",
    flexShrink: 0,
    boxShadow: "var(--shadow-md)",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "24px 16px",
    cursor: "pointer",
    borderBottom: "1px solid var(--border)",
    userSelect: "none",
    transition: "var(--t)",
  },
  logoIcon: { fontSize: 28, flexShrink: 0 },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text-inverse)",
    whiteSpace: "nowrap",
    background: "var(--grad-brand)",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  nav: {
    flex: 1,
    padding: "16px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  navBtn: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 12px",
    border: "none",
    background: "transparent",
    borderRadius: "var(--r-md)",
    color: "var(--text-sidebar)",
    fontSize: 13,
    fontWeight: 500,
    transition: "var(--t)",
    textAlign: "left",
    width: "100%",
    whiteSpace: "nowrap",
  },
  navActive: {
    background: "rgba(255,255,255,0.08)",
    color: "var(--text-inverse)",
    boxShadow: "inset 0 0 16px rgba(43,68,214,0.15)",
  },
  navIcon: { fontSize: 18, flexShrink: 0 },
  navLabel: { whiteSpace: "nowrap" },
  statusBar: {
    padding: "16px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    animation: "pulse 2s ease-in-out infinite",
    boxShadow: "0 0 12px currentColor",
  },
  statusText: {
    fontSize: 12,
    color: "var(--text-sidebar)",
    whiteSpace: "nowrap",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
  },
  topBar: {
    padding: "20px 32px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "var(--bg-topbar)",
    flexShrink: 0,
    boxShadow: "var(--shadow-sm)",
  },
  topTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.5px",
  },
  topSub: { fontSize: 13, color: "var(--text-secondary)", marginTop: 4 },
  topBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontFamily: "var(--mono)",
    color: "var(--text-muted)",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "3px 10px",
    letterSpacing: "0.04em",
  },
  clearBtn: {
    padding: "10px 20px",
    background: "var(--blue-light)",
    color: "var(--text-inverse)",
    border: "none",
    borderRadius: "var(--r-md)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "var(--shadow-blue)",
    transition: "var(--t-fast)",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "32px 32px",
    animation: "fadeIn 0.25s var(--ease)",
  },
  split: { display: "flex", gap: 32, alignItems: "flex-start" },
  miniUploadTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  uploadPanel: { display: "flex", flexDirection: "column", gap: 20 },
  inputTabs: {
    display: "flex",
    gap: 6,
    background: "var(--bg-elevated)",
    padding: 6,
    borderRadius: "var(--r-lg)",
    flexWrap: "wrap",
    boxShadow: "var(--shadow-xs)",
  },
  inputTabBtn: {
    flex: 1,
    minWidth: 70,
    padding: "10px 12px",
    background: "transparent",
    border: "none",
    borderRadius: "var(--r-md)",
    color: "var(--text-secondary)",
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "var(--t-fast)",
  },
  inputTabActive: {
    background: "var(--blue-light)",
    color: "var(--text-inverse)",
    boxShadow: "var(--shadow-blue)",
  },
  dropZone: {
    border: "2px dashed var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "48px 32px",
    textAlign: "center",
    cursor: "pointer",
    background: "var(--bg-elevated)",
    transition: "var(--t)",
    position: "relative",
    overflow: "hidden",
  },
  dropIcon: { fontSize: 48, marginBottom: 16 },
  dropTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 8,
  },
  dropSub: { fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 },
  dropBtn: {
    display: "inline-block",
    padding: "11px 28px",
    background: "var(--blue-light)",
    color: "var(--text-inverse)",
    borderRadius: "var(--r-md)",
    fontSize: 13,
    fontWeight: 600,
    boxShadow: "var(--shadow-blue)",
    transition: "var(--t-fast)",
  },
  label: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginBottom: 10,
    display: "block",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  textarea: {
    width: "100%",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "14px 16px",
    color: "var(--text-primary)",
    fontSize: 13,
    fontFamily: "var(--mono)",
    resize: "vertical",
    lineHeight: 1.8,
    transition: "var(--t)",
    boxShadow: "var(--shadow-xs)",
  },
  valCount: {
    fontSize: 12,
    color: "var(--text-secondary)",
    textAlign: "right",
    marginTop: 8,
  },
  btn: {
    width: "100%",
    padding: "14px 20px",
    background: "var(--grad-brand)",
    color: "var(--text-inverse)",
    border: "none",
    borderRadius: "var(--r-md)",
    fontSize: 14,
    fontWeight: 600,
    marginTop: 12,
    cursor: "pointer",
    boxShadow: "var(--shadow-md)",
    transition: "var(--t)",
  },
  samplePanel: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "48px 32px",
    textAlign: "center",
    boxShadow: "var(--shadow-sm)",
  },
  sampleIcon: { fontSize: 56, marginBottom: 16 },
  sampleTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 8,
  },
  sampleSub: { fontSize: 14, color: "var(--text-secondary)", marginBottom: 28 },
  errorBox: {
    background: "rgba(194,54,43,0.05)",
    border: "1px solid var(--red-light)",
    borderRadius: "var(--r-md)",
    padding: "14px 16px",
    fontSize: 13,
    color: "var(--red)",
    boxShadow: "var(--shadow-xs)",
  },
  loadingBox: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
    fontSize: 13,
    color: "var(--text-secondary)",
    boxShadow: "var(--shadow-sm)",
  },
  spinner: {
    width: 18,
    height: 18,
    border: "2px solid var(--border)",
    borderTopColor: "var(--blue-light)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 24,
    letterSpacing: "-0.5px",
  },
  empty: {
    color: "var(--text-secondary)",
    fontSize: 15,
    padding: "60px 40px",
    textAlign: "center",
    background: "var(--bg-elevated)",
    borderRadius: "var(--r-lg)",
    border: "1px solid var(--border)",
  },
  historyCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px 20px",
    cursor: "pointer",
    transition: "var(--t)",
    boxShadow: "var(--shadow-sm)",
  },
  historyTime: {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginBottom: 6,
  },
  historyConsensus: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 6,
  },
  historyModels: { fontSize: 13, color: "var(--text-secondary)" },
  guideCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderLeft: "3px solid var(--blue-light)",
    borderRadius: "var(--r-md)",
    padding: "20px 22px",
    boxShadow: "var(--shadow-sm)",
    transition: "var(--t)",
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 10,
  },
  guideContent: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.8,
  },
  disclaimerCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--red-light)",
    borderRadius: "var(--r-md)",
    padding: "20px 22px",
  },
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--red-light)",
    marginBottom: 10,
  },
  profileSection: {
    borderTop: "1px solid var(--border)",
    padding: "12px 10px 4px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  profileChip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 6px",
    borderRadius: "var(--r-md)",
    background: "rgba(255,255,255,0.04)",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "var(--blue-light)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    boxShadow: "var(--shadow-blue)",
  },
  profileInfo: { minWidth: 0, flex: 1 },
  profileName: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-inverse)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  profileOrg: {
    fontSize: 11,
    color: "var(--text-sidebar)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: 1,
  },
  logoutBtn: {
    width: "100%",
    padding: "8px 10px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "var(--r-md)",
    color: "var(--text-sidebar)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    transition: "var(--t)",
  },
};
