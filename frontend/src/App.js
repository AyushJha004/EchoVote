import React, { useState, useRef, useEffect } from "react";
import "./index.css";
import ECGChart from "./ECGChart";
import ResultsPanel from "./ResultsPanel";
import LandingPage from "./LandingPage";
import { LoginPage, SignupPage } from "./AuthPages";

const API = process.env.REACT_APP_API_BASE || "";

const NAV = [
  { id: "upload", icon: "📤", label: "Analyze" },
  { id: "history", icon: "🕓", label: "History" },
  { id: "guide", icon: "📖", label: "Guide" },
  { id: "about", icon: "ℹ️", label: "About" },
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
  const [serverOk, setServerOk] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [manualText, setManualText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
        setDemoMode(data.demo_mode);
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

  const post = async (url, body, isForm = false) => {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`${API}${url}`, {
        method: "POST",
        body,
        headers: isForm ? undefined : { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Server error");
      setResults(data);
      setHistory((h) => [
        { id: Date.now(), time: new Date().toLocaleTimeString(), data },
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
    await post("/api/predict/csv", fd, true);
  };
  const handleImage = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    await post("/api/predict/image", fd, true);
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
    await post("/api/predict/manual", JSON.stringify({ values: vals }));
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
    await post("/api/predict/manual", JSON.stringify({ values: sig }));
  };

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const Sidebar = () => (
    <aside
      className="app-sidebar"
      style={{
        ...st.sidebar,
        width: sidebarOpen ? 240 : 70,
        minWidth: sidebarOpen ? 240 : 70,
      }}
    >
      <div style={st.logo} onClick={() => setSidebarOpen((o) => !o)}>
        <div style={st.logoIcon} className="app-logo-icon">❤️</div>
        {sidebarOpen && <span style={st.logoText} className="app-logo-text">EchoVote</span>}
      </div>
      <nav style={st.nav} className="app-nav">
        {NAV.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            style={{ ...st.navBtn, ...(page === id ? st.navActive : {}) }}
            title={label}
          >
            <span style={st.navIcon}>{icon}</span>
            {sidebarOpen && <span style={st.navLabel}>{label}</span>}
          </button>
        ))}
      </nav>

      {/* ── Profile + Logout ── */}
      <div style={st.profileSection} className="app-profile-section">
        <div style={st.profileChip}>
          <div style={st.avatar}>{initials}</div>
          {sidebarOpen && (
            <div style={st.profileInfo}>
              <div style={st.profileName}>{user?.name || "Guest"}</div>
              {user?.org && <div style={st.profileOrg}>{user.org}</div>}
            </div>
          )}
        </div>
        {sidebarOpen && (
          <button style={st.logoutBtn} onClick={handleLogout} title="Log out">
            ⎋ Log out
          </button>
        )}
        {!sidebarOpen && (
          <button style={{ ...st.logoutBtn, padding: "8px", fontSize: 16 }} onClick={handleLogout} title="Log out">
            ⎋
          </button>
        )}
      </div>

      <div style={st.statusBar} className="app-status-bar">
        <div
          style={{
            ...st.statusDot,
            background:
              serverOk === null
                ? "var(--amber-light)"
                : serverOk
                  ? "var(--green-bright)"
                  : "var(--red-light)",
          }}
        />
        {sidebarOpen && (
          <span style={st.statusText}>
            {serverOk === null
              ? "Connecting"
              : serverOk
                ? demoMode
                  ? "Demo"
                  : "Live"
                : "Offline"}
          </span>
        )}
      </div>
    </aside>
  );

  const UploadPanel = () => (
    <div style={st.uploadPanel} className="analysis-input-panel">
      <div style={st.inputTabs} className="analysis-input-tabs">
        {[
          { id: "csv", label: "📄 CSV" },
          { id: "image", label: "📷 Photo" },
          { id: "manual", label: "⌨️ Manual" },
          { id: "sample", label: "🧪 Sample" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setInputTab(id)}
            style={{
              ...st.inputTabBtn,
              ...(inputTab === id ? st.inputTabActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {inputTab === "csv" && (
        <div>
          <div
            className="drop-zone analysis-input-content analysis-input-content--file"
            style={st.dropZone}
            onClick={() => csvRef.current?.click()}
          >
            <div style={st.dropIcon}>📄</div>
            <div style={st.dropTitle}>Upload CSV File</div>
            <div style={st.dropSub}>187 comma-separated ECG values</div>
            <div style={st.dropBtn}>Choose File</div>
          </div>
          <input
            ref={csvRef}
            type="file"
            accept=".csv"
            onChange={handleCSV}
            style={{ display: "none" }}
          />
        </div>
      )}

      {inputTab === "image" && (
        <div>
          <div
            className="drop-zone analysis-input-content analysis-input-content--file"
            style={st.dropZone}
            onClick={() => imgRef.current?.click()}
          >
            <div style={st.dropIcon}>📷</div>
            <div style={st.dropTitle}>Upload ECG Photo</div>
            <div style={st.dropSub}>JPG, PNG · AI extracts signal</div>
            <div style={st.dropBtn}>Choose Image</div>
          </div>
          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            onChange={handleImage}
            style={{ display: "none" }}
          />
        </div>
      )}

      {inputTab === "manual" && (
        <div className="analysis-input-content analysis-input-content--manual">
          <label style={st.label}>
            Paste 187 values (comma, tab, or space separated)
          </label>
          <textarea
            style={st.textarea}
            className="analysis-manual-textarea"
            rows={6}
            placeholder="Comma, tab, or space separated — e.g. 9.60E-01  8.63E-01  4.62E-01 ..."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData("text/plain");
              setManualText(pasted);
            }}
          />
          <div style={st.valCount}>
            {manualText
              ? `${parseManual(manualText).length}/187 values`
              : "0/187 values"}
          </div>
          <button
            style={st.btn}
            className="btn-primary analysis-submit"
            onClick={handleManual}
            disabled={loading}
          >
            {loading ? "⏳ Analyzing..." : "🚀 Analyze"}
          </button>
        </div>
      )}

      {inputTab === "sample" && (
        <div style={st.samplePanel} className="analysis-input-content analysis-sample-panel">
          <div style={st.sampleIcon}>🧪</div>
          <div style={st.sampleTitle}>Synthetic ECG Samples</div>
          <div style={st.sampleSub}>
            Select an arrhythmia type to generate a synthetic beat for testing.
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              width: "100%",
            }}
          >
            {[
              {
                type: "normal",
                label: "🟢 Normal Sinus Rhythm",
                sub: "Clean P-QRS-T, narrow QRS",
              },
              {
                type: "ventricular",
                label: "🔴 Ventricular (PVC)",
                sub: "Wide bizarre QRS, no P wave, deep S",
              },
              {
                type: "supraventricular",
                label: "🔵 Supraventricular (PAC)",
                sub: "Early narrow QRS, abnormal P wave",
              },
              {
                type: "fusion",
                label: "🟠 Fusion Beat",
                sub: "Widened intermediate QRS morphology",
              },
            ].map(({ type, label, sub }) => (
              <button
                key={type}
                disabled={loading}
                onClick={() => handleSample(type)}
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "var(--t)",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 3,
                  }}
                >
                  {sub}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={st.errorBox} className="analysis-feedback anim-fadeUp">
          <strong>⚠️ Error:</strong> {error}
          {serverOk === false && (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              Backend offline. Restart it.
            </div>
          )}
        </div>
      )}

      {loading && (
        <div style={st.loadingBox} className="analysis-feedback anim-fadeUp">
          <div style={st.spinner} />
          <span>Analyzing with AI ensemble...</span>
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

  const HistoryPage = () => (
    <div className="anim-fadeUp">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h2 style={st.pageTitle}>Analysis History</h2>
        {history.length > 0 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {history.length} session record{history.length > 1 ? "s" : ""} ·
            clears on refresh
          </span>
        )}
      </div>
      {history.length === 0 ? (
        <div style={st.empty}>
          📊 No analyses yet. Upload an ECG to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {history.map((h, i) => {
            const preds = Object.entries(h.data.predictions || {}).filter(
              ([, r]) => r.prediction && r.prediction !== "Error",
            );
            const counts = {};
            preds.forEach(
              ([, r]) =>
                (counts[r.prediction] = (counts[r.prediction] || 0) + 1),
            );
            const consensus = (
              Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] ||
              "Unknown"
            ).trim();
            const color = COLOR_MAP[consensus] || "#5b4bd6";
            const agreePct =
              ((counts[consensus] || 0) / (preds.length || 1)) * 100;
            const avgConf =
              preds
                .filter(([, r]) => r.prediction === consensus)
                .reduce((s, [, r]) => s + r.confidence, 0) /
              (counts[consensus] || 1);
            const ensProbs = h.data.ensemble_probs || CLASS_LIST.map(() => 0);
            const dlCount = preds.filter(([n]) =>
              ["1D-CNN", "BiLSTM", "CNN-LSTM"].includes(n),
            ).length;
            const mlCount = preds.length - dlCount;
            const consensusLevel =
              agreePct >= 87.5 ? "HIGH" : agreePct >= 62.5 ? "MODERATE" : "LOW";
            const levelColor =
              agreePct >= 87.5
                ? "#0f9d8a"
                : agreePct >= 62.5
                  ? "#d98324"
                  : "#c2362b";

            return (
              <div
                key={h.id}
                style={{
                  ...st.historyCard,
                  borderLeft: `4px solid ${color}`,
                  padding: 0,
                  overflow: "hidden",
                }}
                className="card-hover"
                onClick={() => {
                  setResults(h.data);
                  setPage("upload");
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--border)",
                    background: `${color}0d`,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "var(--r-md)",
                      background: color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      color: "#fff",
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {ICON_MAP[consensus] || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 800,
                        color,
                        lineHeight: 1.2,
                      }}
                    >
                      {consensus}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 3,
                      }}
                    >
                      #{history.length - i} · {h.time}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>
                      {(avgConf * 100).toFixed(1)}%
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                      }}
                    >
                      avg conf
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 0,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {[
                    { label: "Models", value: `${preds.length}/8` },
                    {
                      label: "Agreement",
                      value: `${agreePct.toFixed(0)}%`,
                      color: levelColor,
                    },
                    {
                      label: "Consensus",
                      value: consensusLevel,
                      color: levelColor,
                    },
                    { label: "DL / ML", value: `${dlCount} / ${mlCount}` },
                  ].map(({ label, value, color: vc }) => (
                    <div
                      key={label}
                      style={{
                        padding: "10px 14px",
                        textAlign: "center",
                        borderRight: "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: vc || "var(--text-primary)",
                        }}
                      >
                        {value}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginTop: 2,
                          textTransform: "uppercase",
                          letterSpacing: "0.4px",
                        }}
                      >
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Agreement bar + ensemble probs */}
                <div
                  style={{
                    padding: "12px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {/* Agreement bar */}
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        width: 70,
                        flexShrink: 0,
                      }}
                    >
                      Agreement
                    </span>
                    <div
                      style={{
                        flex: 1,
                        background: "var(--bg-base)",
                        borderRadius: 4,
                        height: 6,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${agreePct}%`,
                          height: "100%",
                          background: levelColor,
                          borderRadius: 4,
                          transition: "width 0.6s",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: levelColor,
                        width: 32,
                        textAlign: "right",
                      }}
                    >
                      {agreePct.toFixed(0)}%
                    </span>
                  </div>

                  {/* Ensemble prob mini bars */}
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "flex-end",
                      height: 32,
                    }}
                  >
                    {CLASS_LIST.map((cls, ci) => {
                      const p = ensProbs[ci] || 0;
                      const c = COLOR_MAP[cls];
                      return (
                        <div
                          key={cls}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <div
                            style={{ fontSize: 9, color: c, fontWeight: 700 }}
                          >
                            {(p * 100).toFixed(0)}%
                          </div>
                          <div
                            style={{
                              width: "100%",
                              background: "var(--bg-base)",
                              borderRadius: 3,
                              height: 20,
                              display: "flex",
                              alignItems: "flex-end",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                height: `${Math.max(p * 100, 2)}%`,
                                background: c,
                                opacity: cls === consensus ? 1 : 0.4,
                                borderRadius: 3,
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: 8,
                              color: "var(--text-muted)",
                              textAlign: "center",
                              lineHeight: 1.1,
                            }}
                          >
                            {cls.split(" ")[0]}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      textAlign: "right",
                    }}
                  >
                    Click to reload full results →
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const GuidePage = () => {
    const [section, setSection] = useState("arrhythmia");
    const sections = [
      { id: "arrhythmia", label: "🫀 Arrhythmia Classes" },
      { id: "howtouse", label: "📋 How to Use" },
      { id: "tabs", label: "🗂 Result Tabs" },
      { id: "heatmap", label: "🌡 Sensitivity Heatmap" },
    ];
    return (
      <div className="anim-fadeUp">
        <h2 style={st.pageTitle}>Clinical Guide</h2>

        {/* Section tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--r-md)",
                fontSize: 13,
                fontWeight: 600,
                background:
                  section === s.id ? "var(--blue-light)" : "var(--bg-card)",
                color: section === s.id ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${section === s.id ? "var(--blue-light)" : "var(--border)"}`,
                boxShadow:
                  section === s.id ? "var(--shadow-blue)" : "var(--shadow-xs)",
                transition: "var(--t)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Arrhythmia Classes ── */}
        {section === "arrhythmia" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                title: "🟢 Normal (N)",
                color: "var(--green-light)",
                content:
                  "Regular P-QRS-T pattern. Normal sinus rhythm. Rate 60–100 bpm. No clinical action required.",
              },
              {
                title: "🔵 Supraventricular (S)",
                color: "var(--teal-light)",
                content:
                  "SVT / PAC / Atrial Fibrillation. Originates above the ventricles. Narrow QRS complex. Action: Cardiology referral, Holter monitor, consider rate control.",
              },
              {
                title: "🔴 Ventricular (V)",
                color: "var(--red-light)",
                content:
                  "PVC / VT / VF. Originates in the ventricles. Wide QRS (>0.12s). Action: Immediate clinical attention. Amiodarone or defibrillation may be required.",
              },
              {
                title: "🟠 Fusion (F)",
                color: "var(--amber-light)",
                content:
                  "Fusion beat: simultaneous normal sinus and ventricular activation. Intermediate QRS morphology. Clinical review recommended.",
              },
              {
                title: "🟣 Unclassifiable (Q)",
                color: "var(--purple-light)",
                content:
                  "Paced beats or unknown morphology. Signal quality may be poor or beat does not fit standard patterns. Manual cardiologist review required.",
              },
            ].map(({ title, color, content }) => (
              <div
                key={title}
                style={{ ...st.guideCard, borderLeftColor: color }}
                className="card-hover"
              >
                <div style={{ ...st.guideTitle, color }}>{title}</div>
                <p style={st.guideContent}>{content}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── How to Use ── */}
        {section === "howtouse" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                title: "📄 CSV Upload",
                color: "var(--blue-light)",
                steps: [
                  "Export your ECG data as a CSV file with 187 comma-separated amplitude values.",
                  "Click the CSV tab in the Analyze panel and press Choose File.",
                  "The system automatically reads the first row of 187 values.",
                  "Results appear instantly on the right panel.",
                ],
              },
              {
                title: "📷 Photo Upload",
                color: "var(--teal-light)",
                steps: [
                  "Take a clear photo of a printed ECG strip or monitor screen.",
                  "Click the Photo tab and upload the image (JPG or PNG).",
                  "OpenCV extracts the waveform signal from the image automatically.",
                  "Best results with good lighting and a straight, unobstructed strip.",
                  "Mobile users: tap Choose Image and select Camera for direct capture.",
                ],
              },
              {
                title: "⌨️ Manual Entry",
                color: "var(--amber-light)",
                steps: [
                  "Paste 187 values separated by commas, tabs, or spaces (MIT-BIH scientific notation like 9.60E-01 works too).",
                  "The counter below shows how many values have been detected.",
                  "Press Analyze when the counter reads 187/187.",
                  "Useful for programmatic testing or pasting from a spreadsheet.",
                ],
              },
              {
                title: "🧪 Sample / Demo",
                color: "var(--green-light)",
                steps: [
                  "Click the Sample tab and press Generate.",
                  "A synthetic ECG with a realistic QRS complex is created.",
                  "Use this to explore the full results panel without real patient data.",
                  "Useful for demonstrations, training, and UI testing.",
                ],
              },
            ].map(({ title, color, steps }) => (
              <div
                key={title}
                style={{ ...st.guideCard, borderLeftColor: color }}
                className="card-hover"
              >
                <div style={{ ...st.guideTitle, color }}>{title}</div>
                <ol style={{ paddingLeft: 18, marginTop: 8 }}>
                  {steps.map((s, i) => (
                    <li key={i} style={{ ...st.guideContent, marginBottom: 6 }}>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {/* ── Result Tabs ── */}
        {section === "tabs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                title: "🗂 Overview Tab",
                color: "var(--blue-light)",
                content:
                  "The default tab after any analysis. Shows the ensemble verdict (the class most models agreed on), confidence percentage, and agreement count. Also contains the Sensitivity Heatmap and the DL vs ML comparison — all in one place. Start here.",
              },
              {
                title: "📊 Disease Probability Tab",
                color: "var(--teal-light)",
                content:
                  "Shows the averaged probability for each of the 5 arrhythmia classes across all models. The top predicted class is highlighted. Below that, a full per-model probability table lets you see exactly what each model output for every class — useful for research and second-opinion review.",
              },
              {
                title: "🤖 All Models Tab",
                color: "var(--amber-light)",
                content:
                  "Displays individual result cards for all 8 models (3 Deep Learning + 5 Machine Learning). Each card shows the model name, its prediction, confidence bar, and a mini probability breakdown per class. Use this to spot outlier models or verify ensemble consistency.",
              },
            ].map(({ title, color, content }) => (
              <div
                key={title}
                style={{ ...st.guideCard, borderLeftColor: color }}
                className="card-hover"
              >
                <div style={{ ...st.guideTitle, color }}>{title}</div>
                <p style={st.guideContent}>{content}</p>
              </div>
            ))}
            <div
              style={{
                ...st.guideCard,
                borderLeftColor: "var(--purple-light)",
              }}
            >
              <div style={{ ...st.guideTitle, color: "var(--purple-light)" }}>
                🕓 History
              </div>
              <p style={st.guideContent}>
                Every analysis you run in the current session is saved to
                History (up to 10 entries). Click any entry to reload its full
                results. History is session-only and clears on page refresh.
              </p>
            </div>
          </div>
        )}

        {/* ── Sensitivity Heatmap ── */}
        {section === "heatmap" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{ ...st.guideCard, borderLeftColor: "var(--blue-light)" }}
            >
              <div style={{ ...st.guideTitle, color: "var(--blue-light)" }}>
                🌡 What is the Sensitivity Heatmap?
              </div>
              <p style={st.guideContent}>
                The heatmap is a perturbation-based explainability tool. It
                answers:{" "}
                <strong>
                  "Which parts of this ECG beat most influenced the AI's
                  prediction?"
                </strong>
                <br />
                <br />
                The algorithm slides a 10-sample window across all 187 points,
                masks each window to zero, re-runs all 8 models, and measures
                how much the ensemble confidence in the predicted class dropped.
                A large drop means that region was critical to the decision.
              </p>
            </div>
            <div
              style={{ ...st.guideCard, borderLeftColor: "var(--teal-light)" }}
            >
              <div style={{ ...st.guideTitle, color: "var(--teal-light)" }}>
                🎨 Reading the Color Ribbon
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                {[
                  {
                    color: "#3d55e6",
                    label: "Teal / Blue",
                    meaning:
                      "Low impact — masking this region barely changed the prediction. The models do not rely on this segment.",
                  },
                  {
                    color: "#d98324",
                    label: "Amber / Yellow",
                    meaning:
                      "Moderate impact — this region has some influence on the classification.",
                  },
                  {
                    color: "#c2362b",
                    label: "Red",
                    meaning:
                      "High impact — this is a diagnostically critical segment. Masking it caused a large drop in confidence.",
                  },
                ].map(({ color, label, meaning }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: color,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div>
                      <span style={{ fontWeight: 700, color, fontSize: 13 }}>
                        {label}:{" "}
                      </span>
                      <span style={st.guideContent}>{meaning}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    height: 12,
                    borderRadius: 4,
                    background:
                      "linear-gradient(90deg, #3d55e6, #d98324, #c2362b)",
                    marginBottom: 6,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--text-muted)",
                  }}
                >
                  <span>Low Impact</span>
                  <span>Moderate</span>
                  <span>High Impact</span>
                </div>
              </div>
            </div>
            <div
              style={{ ...st.guideCard, borderLeftColor: "var(--amber-light)" }}
            >
              <div style={{ ...st.guideTitle, color: "var(--amber-light)" }}>
                🔬 Clinical Interpretation
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {[
                  {
                    region: "QRS Complex (sharp spike) is red",
                    meaning:
                      "Models are correctly focusing on ventricular depolarization — expected and reassuring.",
                  },
                  {
                    region: "P-wave region (before QRS) is red",
                    meaning:
                      "Atrial activity is driving the classification. Typical for Supraventricular (S) beats.",
                  },
                  {
                    region: "T-wave region (after QRS) is red",
                    meaning:
                      "Repolarization abnormalities are influencing the result. Relevant for ischemia or electrolyte issues.",
                  },
                  {
                    region: "Flat / baseline regions are red",
                    meaning:
                      "The model may be picking up noise or baseline wander. Flag for manual review.",
                  },
                ].map(({ region, meaning }) => (
                  <div
                    key={region}
                    style={{
                      padding: "10px 12px",
                      background: "var(--bg-elevated)",
                      borderRadius: "var(--r-sm)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        marginBottom: 4,
                      }}
                    >
                      📍 {region}
                    </div>
                    <div style={st.guideContent}>{meaning}</div>
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{ ...st.guideCard, borderLeftColor: "var(--green-light)" }}
            >
              <div style={{ ...st.guideTitle, color: "var(--green-light)" }}>
                📋 Top Sensitive Regions List
              </div>
              <p style={st.guideContent}>
                Below the heatmap ribbon, the top 3 most sensitive windows are
                ranked by their average sensitivity score.
                <br />
                <br />
                Example: <strong>"Sample 55–65 · 87%"</strong> means masking
                those 10 samples caused an 87% drop in ensemble confidence — the
                models rely heavily on that segment for their decision.
                <br />
                <br />
                Use this list to quickly identify which part of the beat to
                examine clinically without scanning the entire ribbon.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const AboutPage = () => (
    <div className="anim-fadeUp">
      <h2 style={st.pageTitle}>About EchoVote</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[
          {
            title: "🏥 Project",
            content:
              "EchoVote is an AI-powered ECG arrhythmia classification tool built as a capstone research project at BMSCE Bengaluru. It uses an 8-model ensemble voting system — combining deep learning and classical machine learning — to classify single heartbeats into 5 AAMI standard classes.",
          },
          {
            title: "📊 Dataset",
            content:
              "MIT-BIH Arrhythmia Database. 87,554 training samples across 5 classes (N, S, V, F, Q). Class imbalance handled with SMOTE oversampling. Features are 187 amplitude samples per beat at 360 Hz.",
          },
          {
            title: "🧠 Ensemble Models",
            content:
              "3 Deep Learning: 1D-CNN (Conv1D → BatchNorm → MaxPool → Dense), BiLSTM (Bidirectional LSTM × 2), CNN-LSTM (Conv1D blocks → BiLSTM × 2). 5 Machine Learning: Random Forest (100 estimators), XGBoost, KNN, SVM, Logistic Regression. Final prediction is determined by majority vote across all 8 models.",
          },
          {
            title: "🌡 Explainability",
            content:
              "Perturbation-based sensitivity heatmap: a 10-sample window is slid across the 187-point signal, each window is masked to zero, all 8 models are re-run, and the drop in ensemble confidence is recorded. High-drop regions are highlighted red — showing which ECG segments drove the prediction.",
          },
          {
            title: "📷 Image Processing",
            content:
              "OpenCV pipeline: CLAHE contrast enhancement → adaptive Gaussian thresholding → morphological opening → per-column weighted centroid extraction. Signal is aligned to the MIT-BIH amplitude distribution (baseline ~0, QRS peak ~1) before prediction.",
          },
          {
            title: "⚙️ Stack",
            content:
              "Frontend: React 18, SVG charts · Backend: FastAPI, Python 3.10 · ML/DL: TensorFlow 2.16 (CPU), Scikit-learn, XGBoost · Image: OpenCV · Containerization: Docker, Docker Compose, Nginx",
          },
        ].map(({ title, content }) => (
          <div key={title} style={st.guideCard} className="card-hover">
            <div style={st.guideTitle}>{title}</div>
            <p style={st.guideContent}>{content}</p>
          </div>
        ))}
        <div style={st.disclaimerCard} className="card-hover">
          <div style={st.disclaimerTitle}>⚠️ Disclaimer</div>
          <p style={st.guideContent}>
            Research tool only. Not FDA-approved. Not a medical device. Always
            consult a qualified cardiologist before clinical decisions.
          </p>
        </div>
      </div>
    </div>
  );

  const handleLogin = (userData) => { setUser(userData); setAuthPage("app"); };
  const handleLogout = () => { setUser(null); setResults(null); setHistory([]); setAuthPage("landing"); };

  if (authPage === "landing")
    return <LandingPage onLogin={() => setAuthPage("login")} onSignup={() => setAuthPage("signup")} />;
  if (authPage === "login")
    return <LoginPage onLogin={handleLogin} onSignup={() => setAuthPage("signup")} onLogoClick={() => setAuthPage("landing")} />;
  if (authPage === "signup")
    return <SignupPage onSignup={handleLogin} onLogin={() => setAuthPage("login")} onLogoClick={() => setAuthPage("landing")} />;

  return (
    <div style={st.app} className="app">
      <Sidebar />
      <main style={st.main}>
        <div style={st.topBar} className="app-ecg-grid">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={st.topTitle}>
              {{ upload: "EchoVote", history: "History", guide: "Clinical Guide", about: "About" }[page]}
            </div>
            {page === "upload" && (
              <span style={st.topBadge}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: serverOk ? "var(--green-bright)" : "var(--amber-light)", display: "inline-block" }} />
                {serverOk ? (demoMode ? "Demo" : "Live") : "Offline"}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {results && page === "upload" && (
              <button style={st.clearBtn} className="btn-primary" onClick={() => setResults(null)}>
                + New Analysis
              </button>
            )}
          </div>
        </div>

        <div style={st.content} className="app-content">
          {page === "upload" && (
            <div className={`analysis-workspace${results ? " has-results" : ""}`}>
              <section className="analysis-input-card">
                <div className="analysis-input-heading">
                  <h2>Select ECG Input</h2>
                  <p>Upload a file, take a photo, paste values, or use a sample ECG signal.</p>
                </div>
                <UploadPanel />
              </section>
              {results && (
                <section className="analysis-results-section">
                  <ResultsPanel data={results} demoMode={demoMode} />
                </section>
              )}
            </div>
          )}
          {page === "history" && <HistoryPage />}
          {page === "guide" && <GuidePage />}
          {page === "about" && <AboutPage />}
        </div>
      </main>
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
