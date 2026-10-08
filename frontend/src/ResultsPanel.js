import React, { useState, useEffect, useCallback } from "react";
import ECGChart from "./ECGChart";
import { jsPDF } from "jspdf";

const API = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const CLASSES = [
  "Normal (N)",
  "Supraventricular (S)",
  "Ventricular (V)",
  "Fusion (F)",
  "Unclassifiable (Q)",
];

const COLOR = {
  "Normal (N)": "#0f9d8a",
  "Supraventricular (S)": "#3d55e6",
  "Ventricular (V)": "#c2362b",
  "Fusion (F)": "#d98324",
  "Unclassifiable (Q)": "#5b4bd6",
  Error: "#8a8c9c",
};

const ICON = {
  "Normal (N)": "✓",
  "Supraventricular (S)": "◈",
  "Ventricular (V)": "⚠",
  "Fusion (F)": "◉",
  "Unclassifiable (Q)": "?",
  Error: "✕",
};

const SEV = {
  "Normal (N)": {
    bg: "rgba(15,157,138,0.07)",
    border: "#0f9d8a",
    text: "#2cc2ab",
  },
  "Supraventricular (S)": {
    bg: "rgba(43,68,214,0.07)",
    border: "#3d55e6",
    text: "#6b7fff",
  },
  "Ventricular (V)": {
    bg: "rgba(194,54,43,0.07)",
    border: "#c2362b",
    text: "#dc4a3e",
  },
  "Fusion (F)": {
    bg: "rgba(217,131,36,0.07)",
    border: "#d98324",
    text: "#d98324",
  },
  "Unclassifiable (Q)": {
    bg: "rgba(91,75,214,0.07)",
    border: "#5b4bd6",
    text: "#7564f0",
  },
};

const DL_NAMES = new Set(["1D-CNN", "BiLSTM", "CNN-LSTM"]);

export default function ResultsPanel({ data }) {
  const [tab, setTab] = useState("overview");
  const [sensitivity, setSensitivity] = useState(null);
  const [pertLoading, setPertLoading] = useState(false);
  const { signal, predictions, ensemble_probs, source_image } = data;

  const valid = Object.entries(predictions).filter(
    ([, r]) => r.prediction && r.prediction !== "Error",
  );
  const counts = {};
  valid.forEach(
    ([, r]) => (counts[r.prediction] = (counts[r.prediction] || 0) + 1),
  );
  const consensus = (
    Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "Unknown"
  ).trim();
  const sev = SEV[consensus] || SEV["Normal (N)"];
  const predClassIdx = CLASSES.indexOf(consensus);

  const avgConf =
    valid
      .filter(([, r]) => r.prediction === consensus)
      .reduce((s, [, r]) => s + r.confidence, 0) / (counts[consensus] || 1);

  const dlPreds = valid.filter(([n]) => DL_NAMES.has(n));
  const mlPreds = valid.filter(([n]) => !DL_NAMES.has(n));

  const ensProbs =
    ensemble_probs ||
    (() => {
      const arr = valid.map(([, r]) => r.probs || []);
      if (!arr.length) return CLASSES.map(() => 0);
      return CLASSES.map(
        (_, i) => arr.reduce((s, p) => s + (p[i] || 0), 0) / arr.length,
      );
    })();

  const topDiseaseIdx = ensProbs.indexOf(Math.max(...ensProbs));

  const fetchPerturbation = useCallback(async () => {
    if (sensitivity || pertLoading || !signal || predClassIdx < 0) return;
    setPertLoading(true);
    try {
      const res = await fetch(`${API}/api/perturbation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: signal,
          pred_class: predClassIdx,
          window: 10,
        }),
      });
      const d = await res.json();
      if (d.success) setSensitivity(d.sensitivity);
    } catch (_) {
    } finally {
      setPertLoading(false);
    }
  }, [signal, predClassIdx, sensitivity, pertLoading]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchPerturbation();
  }, []);

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 18;
    const col = sev.border;
    let y = 0;

    const hex2rgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };

    // ── Header bar ──────────────────────────────────────────────────────
    const [hr, hg, hb] = hex2rgb(sev.border);
    doc.setFillColor(hr, hg, hb);
    doc.rect(0, 0, W, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("EchoVote — ECG Analysis Report", M, 14);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, W - M, 14, { align: "right" });
    y = 32;

    // ── Ensemble Verdict ────────────────────────────────────────────────
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("ENSEMBLE PREDICTION", M, y); y += 6;
    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.setTextColor(hr, hg, hb);
    doc.text(consensus, M, y); y += 6;
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(
      `${counts[consensus]}/${valid.length} models agree  ·  ${(avgConf * 100).toFixed(1)}% avg confidence  ·  Ensemble prob: ${(ensProbs[topDiseaseIdx] * 100).toFixed(1)}%`,
      M, y
    ); y += 10;

    // ── Stats row ───────────────────────────────────────────────────────
    const agreePct = counts[consensus] / valid.length;
    const consensusLevel = agreePct >= 0.875 ? "HIGH" : agreePct >= 0.625 ? "MODERATE" : "LOW";
    const stats = [
      ["Models Run", `${valid.length}/8`],
      ["Agreement", `${(agreePct * 100).toFixed(0)}%`],
      ["Consensus", consensusLevel],
      ["DL / ML", `${dlPreds.length} / ${mlPreds.length}`],
    ];
    const cellW = (W - M * 2) / 4;
    doc.setFillColor(245, 246, 250);
    doc.rect(M, y, W - M * 2, 16, "F");
    stats.forEach(([label, val], i) => {
      const x = M + i * cellW + cellW / 2;
      doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(hr, hg, hb);
      doc.text(val, x, y + 7, { align: "center" });
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 140);
      doc.text(label.toUpperCase(), x, y + 13, { align: "center" });
    });
    y += 22;

    // ── Ensemble Disease Probabilities ──────────────────────────────────
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(60, 60, 60);
    doc.text("ENSEMBLE DISEASE PROBABILITIES", M, y); y += 5;
    const barW = W - M * 2 - 50;
    CLASSES.forEach((cls, i) => {
      const pct = (ensProbs[i] || 0);
      const [cr, cg, cb] = hex2rgb(COLOR[cls]);
      doc.setFontSize(8); doc.setFont("helvetica", i === topDiseaseIdx ? "bold" : "normal");
      doc.setTextColor(cr, cg, cb);
      doc.text(cls, M, y + 3.5);
      doc.setFillColor(230, 232, 240);
      doc.rect(M + 46, y, barW, 5, "F");
      doc.setFillColor(cr, cg, cb);
      doc.rect(M + 46, y, barW * pct, 5, "F");
      doc.setTextColor(cr, cg, cb);
      doc.text(`${(pct * 100).toFixed(1)}%`, M + 46 + barW + 3, y + 3.5);
      y += 8;
    });
    y += 4;

    // ── Per-Model Results Table ──────────────────────────────────────────
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(60, 60, 60);
    doc.text("PER-MODEL RESULTS", M, y); y += 5;
    const cols = ["Model", "Type", "Prediction", "Confidence", "N", "S", "V", "F", "Q"];
    const colX = [M, M+32, M+50, M+82, M+108, M+118, M+128, M+138, M+148];
    doc.setFillColor(hr, hg, hb);
    doc.rect(M, y, W - M * 2, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    cols.forEach((c, i) => doc.text(c, colX[i], y + 4.5));
    y += 7;
    valid.forEach(([name, pred], idx) => {
      if (idx % 2 === 0) { doc.setFillColor(248, 249, 252); doc.rect(M, y, W - M * 2, 7, "F"); }
      const [pr, pg, pb] = hex2rgb(COLOR[pred.prediction] || "#8a8c9c");
      doc.setTextColor(60, 60, 60); doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(name, colX[0], y + 4.5);
      doc.setTextColor(DL_NAMES.has(name) ? 107 : 44, DL_NAMES.has(name) ? 127 : 194, DL_NAMES.has(name) ? 255 : 138);
      doc.text(DL_NAMES.has(name) ? "DL" : "ML", colX[1], y + 4.5);
      doc.setTextColor(pr, pg, pb); doc.setFont("helvetica", "bold");
      doc.text(pred.prediction?.split(" ")[0] || "-", colX[2], y + 4.5);
      doc.setTextColor(60, 60, 60); doc.setFont("helvetica", "normal");
      doc.text(`${((pred.confidence || 0) * 100).toFixed(1)}%`, colX[3], y + 4.5);
      (pred.probs || [0,0,0,0,0]).forEach((p, pi) => {
        doc.setTextColor(pred.class_idx === pi ? pr : 120, pred.class_idx === pi ? pg : 120, pred.class_idx === pi ? pb : 120);
        doc.setFont("helvetica", pred.class_idx === pi ? "bold" : "normal");
        doc.text(`${(p * 100).toFixed(0)}%`, colX[4 + pi], y + 4.5);
      });
      y += 7;
    });
    y += 6;

    // ── Clinical Summary ─────────────────────────────────────────────────
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFillColor(hr, hg, hb);
    doc.rect(M, y, W - M * 2, 8, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("CLINICAL SUMMARY", M + 4, y + 5.5);
    y += 12;

    const recMap = {
      "Ventricular (V)": "Urgent clinical review required. Ventricular arrhythmia detected — consult a cardiologist immediately.",
      "Normal (N)": consensusLevel === "HIGH" ? "High-confidence normal sinus rhythm. Routine follow-up as per clinical protocol." : "Normal sinus rhythm detected. Moderate model agreement — routine follow-up recommended.",
      "Supraventricular (S)": "Cardiology referral recommended. Consider Holter monitoring and rate control evaluation.",
      "Fusion (F)": "Fusion beat detected. Clinical review recommended to assess underlying rhythm.",
      "Unclassifiable (Q)": "Unclassifiable morphology. Manual review by a qualified cardiologist is required.",
    };
    const rec = recMap[consensus] || "Clinical review advised.";
    doc.setTextColor(hr, hg, hb); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("Final Prediction:", M, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
    doc.text(`${consensus}  —  ${(avgConf * 100).toFixed(1)}% avg confidence`, M + 30, y); y += 7;
    doc.setTextColor(hr, hg, hb); doc.setFont("helvetica", "bold");
    doc.text("Recommendation:", M, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
    const recLines = doc.splitTextToSize(rec, W - M * 2 - 32);
    doc.text(recLines, M + 32, y); y += recLines.length * 5 + 6;

    // ── Disclaimer ───────────────────────────────────────────────────────
    doc.setFillColor(245, 246, 250);
    doc.rect(M, y, W - M * 2, 10, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.setTextColor(150, 150, 150);
    doc.text(
      "Research tool only · Not FDA-approved · Not a medical device · Always consult a qualified cardiologist before clinical decisions.",
      W / 2, y + 6, { align: "center" }
    );

    doc.save(`EchoVote_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const tabs = ["overview", "disease-chance", "all-models"];
  const tabLabels = {
    overview: "Overview",
    "disease-chance": "Disease Probability",
    "all-models": "All Models",
  };

  return (
    <div style={s.wrap} className="anim-fadeUp">
      {/* ── Tab bar ── */}
      <div style={s.tabBar}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="tab-btn"
            style={{
              ...s.tabBtn,
              ...(tab === t
                ? {
                    ...s.tabActive,
                    borderBottomColor: sev.border,
                    color: sev.text,
                  }
                : {}),
            }}
          >
            {tabLabels[t]}
            {t === "sensitivity" && pertLoading && (
              <span style={s.tabSpinner} />
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={exportPDF}
          style={s.exportBtn}
          title="Export PDF report"
        >
          ⬇ Export PDF
        </button>
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div style={s.col}>
          {/* Real image preview for photo uploads */}
          {source_image && (
            <div style={s.card} className="card-hover">
              <div style={s.cardHead}>
                <span style={s.cardTitle}>Uploaded ECG Image</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Original · unmodified</span>
              </div>
              <img
                src={source_image}
                alt="Uploaded ECG"
                style={{ width: "100%", borderRadius: "var(--r-md)", display: "block", maxHeight: 220, objectFit: "contain" }}
              />
            </div>
          )}
          {/* Verdict */}
          <div
            style={{
              ...s.verdictBox,
              background: sev.bg,
              borderColor: sev.border,
            }}
            className="card-hover"
          >
            <div style={{ ...s.verdictIcon, background: sev.border }}>
              {ICON[consensus]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={s.verdictLabel}>Ensemble Prediction</div>
              <div style={{ ...s.verdictName, color: sev.text }}>
                {consensus}
              </div>
              <div style={s.verdictMeta}>
                {counts[consensus]}/{valid.length} models agree &nbsp;·&nbsp;
                {(avgConf * 100).toFixed(1)}% avg confidence
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...s.bigPct, color: sev.text }}>
                {(ensProbs[topDiseaseIdx] * 100).toFixed(1)}%
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginTop: 2,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                ensemble
              </div>
            </div>
          </div>

          {/* ── Sensitivity / Heatmap ── */}
          <div style={s.card} className="card-hover">
            <div style={s.cardHead}>
              <span style={s.cardTitle}>Sensitivity Heatmap</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {sensitivity && (
                  <span
                    style={{
                      ...s.badge,
                      background: "rgba(15,157,138,0.12)",
                      color: "#2cc2ab",
                    }}
                  >
                    Active
                  </span>
                )}
                {!sensitivity && !pertLoading && (
                  <button
                    style={s.smallBtn}
                    className="btn-primary"
                    onClick={fetchPerturbation}
                  >
                    Compute
                  </button>
                )}
                {pertLoading && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Computing...
                  </span>
                )}
              </div>
            </div>
            {pertLoading && (
              <div style={s.pertLoadBox}>
                <div style={s.bigSpinner} />
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Running masked predictions across all models...
                </div>
              </div>
            )}
            {!sensitivity && !pertLoading && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                Click <b>Compute</b> to highlight diagnostically critical ECG
                segments.
              </div>
            )}
            {sensitivity && (
              <>
                {source_image ? (
                  <div style={{ position: "relative", width: "100%" }}>
                    <img
                      src={source_image}
                      alt="Uploaded ECG"
                      style={{
                        width: "100%",
                        height: 180,
                        objectFit: "fill",
                        borderRadius: "var(--r-md)",
                        display: "block",
                      }}
                    />
                    {/* Sensitivity overlay on top of real image */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: 180,
                        display: "flex",
                        borderRadius: "var(--r-md)",
                        overflow: "hidden",
                        pointerEvents: "none",
                      }}
                    >
                      {sensitivity.map((val, i) => {
                        let r, g, b;
                        if (val < 0.5) {
                          const t = val * 2;
                          r = Math.round(43 + t * (217 - 43));
                          g = Math.round(68 + t * (131 - 68));
                          b = Math.round(214 + t * (36 - 214));
                        } else {
                          const t = (val - 0.5) * 2;
                          r = Math.round(217 + t * (194 - 217));
                          g = Math.round(131 + t * (54 - 131));
                          b = Math.round(36 + t * (43 - 36));
                        }
                        return (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              background: `rgb(${r},${g},${b})`,
                              opacity: 0.12 + val * 0.38,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <ECGChart
                    signal={signal}
                    height={180}
                    sensitivity={sensitivity}
                    accentColor={sev.border}
                  />
                )}
                <div style={s.heatLegend}>
                  <span style={{ color: "#3d55e6", fontSize: 11 }}>
                    ● Low impact
                  </span>
                  <div style={s.heatGradBar} />
                  <span style={{ color: "#c2362b", fontSize: 11 }}>
                    High impact ●
                  </span>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Top Sensitive Regions
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {(() => {
                      const windows = [];
                      for (let i = 0; i < 187; i += 10) {
                        const slice = sensitivity.slice(
                          i,
                          Math.min(i + 10, 187),
                        );
                        const avg =
                          slice.reduce((a, b) => a + b, 0) / slice.length;
                        windows.push({
                          start: i,
                          end: Math.min(i + 10, 187),
                          score: avg,
                        });
                      }
                      return windows
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 3)
                        .map((w, idx) => (
                          <div key={idx} style={s.regionRow}>
                            <span
                              style={{
                                ...s.regionRank,
                                background: sev.border,
                              }}
                            >
                              #{idx + 1}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-secondary)",
                                width: 100,
                                flexShrink: 0,
                              }}
                            >
                              Sample {w.start}–{w.end}
                            </span>
                            <div style={s.regionBarWrap}>
                              <div
                                style={{
                                  ...s.regionBarFill,
                                  width: `${w.score * 100}%`,
                                  background: `linear-gradient(90deg, ${sev.border}, #c2362b)`,
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: sev.text,
                                width: 36,
                                textAlign: "right",
                              }}
                            >
                              {(w.score * 100).toFixed(0)}%
                            </span>
                          </div>
                        ));
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── DL vs ML inline ── */}
          <div style={s.card} className="card-hover">
            <div style={s.cardHead}>
              <span style={s.cardTitle}>DL vs ML</span>
              {dlPreds.length > 0 &&
                mlPreds.length > 0 &&
                (() => {
                  const dlC = (() => {
                    const c = {};
                    dlPreds.forEach(
                      ([, r]) => (c[r.prediction] = (c[r.prediction] || 0) + 1),
                    );
                    return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
                  })();
                  const mlC = (() => {
                    const c = {};
                    mlPreds.forEach(
                      ([, r]) => (c[r.prediction] = (c[r.prediction] || 0) + 1),
                    );
                    return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
                  })();
                  const agree = dlC === mlC;
                  return (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: agree ? "#2cc2ab" : "#d98324",
                      }}
                    >
                      {agree ? "✓ Agree" : "⚠ Disagree"}
                    </span>
                  );
                })()}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {[
                ["Deep Learning", dlPreds],
                ["Machine Learning", mlPreds],
              ].map(([title, group]) => {
                if (!group.length) return null;
                const gCounts = {};
                group.forEach(
                  ([, r]) =>
                    (gCounts[r.prediction] = (gCounts[r.prediction] || 0) + 1),
                );
                const gConsensus = Object.keys(gCounts).sort(
                  (a, b) => gCounts[b] - gCounts[a],
                )[0];
                const gAvgConf =
                  group
                    .filter(([, r]) => r.prediction === gConsensus)
                    .reduce((s, [, r]) => s + r.confidence, 0) /
                  (gCounts[gConsensus] || 1);
                const gSev = SEV[gConsensus] || SEV["Unclassifiable (Q)"];
                const gProbs = CLASSES.map(
                  (_, i) =>
                    group.reduce(
                      (s, [, r]) => s + ((r.probs || [])[i] || 0),
                      0,
                    ) / group.length,
                );
                return (
                  <div
                    key={title}
                    style={{
                      background: "var(--bg-elevated)",
                      borderRadius: "var(--r-md)",
                      padding: 14,
                      border: `1px solid ${gSev.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: 8,
                      }}
                    >
                      {title}
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: gSev.text,
                        marginBottom: 4,
                      }}
                    >
                      {gConsensus}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 12,
                      }}
                    >
                      {(gAvgConf * 100).toFixed(1)}% conf ·{" "}
                      {gCounts[gConsensus]}/{group.length} agree
                    </div>
                    {CLASSES.map((cls, i) => (
                      <div
                        key={cls}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: COLOR[cls],
                            flexShrink: 0,
                          }}
                        />
                        <div
                          style={{
                            flex: 1,
                            background: "var(--bg-base)",
                            borderRadius: "var(--r-xs)",
                            height: 4,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(gProbs[i] * 100, 100)}%`,
                              height: "100%",
                              background: COLOR[cls],
                              borderRadius: "var(--r-xs)",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            color: COLOR[cls],
                            width: 34,
                            textAlign: "right",
                            fontWeight: 600,
                          }}
                        >
                          {(gProbs[i] * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      {group.map(([name, pred]) => {
                        const c = COLOR[pred.prediction] || "var(--text-muted)";
                        return (
                          <div
                            key={name}
                            style={{
                              fontSize: 10,
                              padding: "3px 7px",
                              borderRadius: "var(--r-xs)",
                              background: `${c}18`,
                              color: c,
                              fontWeight: 700,
                              border: `1px solid ${c}40`,
                            }}
                          >
                            {name}: {((pred.confidence || 0) * 100).toFixed(0)}%
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats row */}
          <div style={s.statsRow}>
            {[
              { v: valid.length, l: "Models Run" },
              { v: (avgConf * 100).toFixed(0) + "%", l: "Avg Confidence" },
              {
                v: ((counts[consensus] / valid.length) * 100).toFixed(0) + "%",
                l: "Agreement",
              },
              {
                v: dlPreds.length + " DL / " + mlPreds.length + " ML",
                l: "Breakdown",
              },
            ].map(({ v, l }) => (
              <div key={l} style={s.stat}>
                <div style={{ ...s.statVal, color: sev.border }}>{v}</div>
                <div style={s.statLbl}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DISEASE PROBABILITY ── */}
      {tab === "disease-chance" && (
        <div style={s.col}>
          <div style={s.card} className="card-hover">
            <div style={s.cardHead}>
              <span style={s.cardTitle}>Ensemble Disease Probability</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Averaged across {valid.length} models
              </span>
            </div>
            {CLASSES.map((cls, i) => {
              const pct = (ensProbs[i] || 0) * 100;
              const isTop = i === topDiseaseIdx;
              return (
                <div
                  key={cls}
                  style={{
                    ...s.chanceRow,
                    ...(isTop
                      ? {
                          background: SEV[cls]?.bg,
                          borderRadius: "var(--r-md)",
                          padding: "10px 12px",
                          margin: "0 -12px 10px",
                        }
                      : { marginBottom: 12 }),
                  }}
                >
                  <div style={s.chanceLeft}>
                    <span style={{ ...s.clsDot, background: COLOR[cls] }} />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isTop ? 700 : 500,
                        color: isTop ? COLOR[cls] : "var(--text-secondary)",
                      }}
                    >
                      {cls}
                    </span>
                    {isTop && (
                      <span style={{ ...s.topBadge, background: COLOR[cls] }}>
                        TOP
                      </span>
                    )}
                  </div>
                  <div style={s.chanceBarWrap}>
                    <div
                      style={{
                        ...s.chanceBarFill,
                        width: `${Math.min(pct, 100)}%`,
                        background: COLOR[cls],
                        opacity: isTop ? 1 : 0.55,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      ...s.chancePct,
                      color: COLOR[cls],
                      fontWeight: isTop ? 800 : 600,
                    }}
                  >
                    {pct.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>

          <div style={s.card} className="card-hover">
            <div style={s.cardTitle}>Per-Model Probabilities</div>
            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Model</th>
                    <th style={s.th}>Type</th>
                    {CLASSES.map((c) => (
                      <th key={c} style={{ ...s.th, color: COLOR[c] }}>
                        {c.split(" ")[0]}
                      </th>
                    ))}
                    <th style={s.th}>Prediction</th>
                  </tr>
                </thead>
                <tbody>
                  {valid.map(([name, pred]) => (
                    <tr key={name} style={s.tr}>
                      <td style={s.td}>{name}</td>
                      <td
                        style={{
                          ...s.td,
                          color: DL_NAMES.has(name) ? "#6b7fff" : "#2cc2ab",
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        {DL_NAMES.has(name) ? "DL" : "ML"}
                      </td>
                      {(pred.probs || [0, 0, 0, 0, 0]).map((p, i) => (
                        <td
                          key={i}
                          style={{
                            ...s.td,
                            color: COLOR[CLASSES[i]],
                            fontWeight: pred.class_idx === i ? 700 : 400,
                          }}
                        >
                          {(p * 100).toFixed(1)}%
                        </td>
                      ))}
                      <td
                        style={{
                          ...s.td,
                          color: COLOR[pred.prediction],
                          fontWeight: 700,
                        }}
                      >
                        {pred.prediction?.split(" ")[0]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ALL MODELS ── */}
      {tab === "all-models" && (
        <div style={s.col}>
          <div style={s.modelGrid}>
            {Object.entries(predictions).map(([name, pred]) => {
              const c = COLOR[pred.prediction] || "var(--text-muted)";
              return (
                <div
                  key={name}
                  style={{ ...s.modelCard, borderTopColor: c }}
                  className="card-hover"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <div style={s.modelName}>{name}</div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "var(--r-xs)",
                        background: DL_NAMES.has(name)
                          ? "rgba(91,75,214,0.12)"
                          : "rgba(15,157,138,0.12)",
                        color: DL_NAMES.has(name) ? "#6b7fff" : "#2cc2ab",
                      }}
                    >
                      {DL_NAMES.has(name) ? "DL" : "ML"}
                    </span>
                  </div>
                  <div style={{ ...s.modelPred, color: c }}>
                    {pred.prediction}
                  </div>
                  <div style={s.confBarWrap}>
                    <div
                      style={{
                        ...s.confBarFill,
                        width: `${(pred.confidence || 0) * 100}%`,
                        background: c,
                      }}
                    />
                  </div>
                  <div style={s.modelConf}>
                    {((pred.confidence || 0) * 100).toFixed(1)}% confidence
                  </div>
                  {pred.probs && (
                    <div style={{ marginTop: 12 }}>
                      {CLASSES.map((cls, i) => (
                        <div
                          key={cls}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: COLOR[cls],
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 10,
                              color: "var(--text-muted)",
                              width: 88,
                              flexShrink: 0,
                            }}
                          >
                            {cls.split(" ")[0]}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              background: "var(--bg-base)",
                              borderRadius: "var(--r-xs)",
                              height: 3,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${(pred.probs[i] || 0) * 100}%`,
                                height: "100%",
                                background: COLOR[cls],
                                borderRadius: "var(--r-xs)",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              color: COLOR[cls],
                              width: 34,
                              textAlign: "right",
                              fontWeight: pred.class_idx === i ? 700 : 400,
                            }}
                          >
                            {((pred.probs[i] || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {pred.error && (
                    <div
                      style={{ fontSize: 11, color: "#c2362b", marginTop: 8 }}
                    >
                      ⚠ {pred.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Clinical Summary ── */}
      {(() => {
        const agreePct = counts[consensus] / valid.length;
        const consensusLevel =
          agreePct >= 0.875 ? "HIGH" : agreePct >= 0.625 ? "MODERATE" : "LOW";
        const consensusColor =
          agreePct >= 0.875
            ? "#0f9d8a"
            : agreePct >= 0.625
              ? "#d98324"
              : "#dc4a3e";

        // DL vs ML disagreement
        const dlC = dlPreds.length
          ? (() => {
              const c = {};
              dlPreds.forEach(
                ([, r]) => (c[r.prediction] = (c[r.prediction] || 0) + 1),
              );
              return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
            })()
          : null;
        const mlC = mlPreds.length
          ? (() => {
              const c = {};
              mlPreds.forEach(
                ([, r]) => (c[r.prediction] = (c[r.prediction] || 0) + 1),
              );
              return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
            })()
          : null;
        const dlMlDisagree = dlC && mlC && dlC !== mlC;
        const dlStrongConf = dlPreds.length
          ? dlPreds
              .filter(([, r]) => r.prediction === dlC)
              .reduce((s, [, r]) => s + r.confidence, 0) /
            dlPreds.filter(([, r]) => r.prediction === dlC).length
          : 0;

        // Recommendation logic
        let recIcon, recColor, recBg, recBorder, recommendation;
        if (consensus === "Ventricular (V)") {
          recIcon = "🚨";
          recColor = "#c2362b";
          recBg = "rgba(194,54,43,0.06)";
          recBorder = "#dc4a3e";
          recommendation =
            "Urgent clinical review required. Ventricular arrhythmia detected — consult a cardiologist immediately.";
        } else if (consensus === "Normal (N)") {
          recIcon = "✅";
          recColor = "#0f8a79";
          recBg = "rgba(15,138,121,0.06)";
          recBorder = "#0f9d8a";
          recommendation =
            consensusLevel === "HIGH"
              ? "High-confidence normal sinus rhythm. Routine follow-up as per clinical protocol."
              : "Normal sinus rhythm detected. Moderate model agreement — routine follow-up recommended.";
        } else if (consensusLevel === "LOW" || dlMlDisagree) {
          recIcon = "⚠️";
          recColor = "#b8650f";
          recBg = "rgba(184,101,15,0.06)";
          recBorder = "#d98324";
          recommendation =
            "Clinical review advised. Low model consensus or DL/ML disagreement — manual cardiologist interpretation recommended.";
        } else if (consensus === "Supraventricular (S)") {
          recIcon = "⚠️";
          recColor = "#2b44d6";
          recBg = "rgba(43,68,214,0.06)";
          recBorder = "#2b44d6";
          recommendation =
            "Cardiology referral recommended. Consider Holter monitoring and rate control evaluation.";
        } else if (consensus === "Fusion (F)") {
          recIcon = "⚠️";
          recColor = "#b8650f";
          recBg = "rgba(184,101,15,0.06)";
          recBorder = "#d98324";
          recommendation =
            "Fusion beat detected. Clinical review recommended to assess underlying rhythm.";
        } else {
          recIcon = "🔍";
          recColor = "#5b4bd6";
          recBg = "rgba(91,75,214,0.06)";
          recBorder = "#7564f0";
          recommendation =
            "Unclassifiable morphology. Manual review by a qualified cardiologist is required.";
        }

        return (
          <div
            style={{
              marginTop: 24,
              border: `2px solid ${recBorder}`,
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}
          >
            {/* Header bar */}
            <div
              style={{
                background: recBorder,
                padding: "10px 20px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>{recIcon}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#fff",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Clinical Summary
              </span>
            </div>

            <div
              style={{
                background: recBg,
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* Final prediction line */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                  }}
                >
                  Final Prediction
                </span>
                <span
                  style={{ fontSize: 22, fontWeight: 800, color: recColor }}
                >
                  {consensus}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                  }}
                >
                  — {(avgConf * 100).toFixed(1)}% avg confidence
                </span>
              </div>

              {/* Disagreement alert */}
              {dlMlDisagree && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 14px",
                    background: "rgba(184,101,15,0.08)",
                    border: "1px solid #d98324",
                    borderRadius: "var(--r-md)",
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#b8650f",
                        marginBottom: 3,
                      }}
                    >
                      DISAGREEMENT: DL vs ML
                    </div>
                    <div
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      DL models predict{" "}
                      <span style={{ fontWeight: 700, color: COLOR[dlC] }}>
                        {dlC}
                      </span>
                      {dlStrongConf > 0 && (
                        <span style={{ color: "var(--text-muted)" }}>
                          {" "}
                          ({(dlStrongConf * 100).toFixed(0)}% conf)
                        </span>
                      )}
                      {" · "}ML models predict{" "}
                      <span style={{ fontWeight: 700, color: COLOR[mlC] }}>
                        {mlC}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 10,
                }}
              >
                {[
                  {
                    label: "Models Agree",
                    value: `${counts[consensus]}/${valid.length}`,
                    sub: `${((counts[consensus] / valid.length) * 100).toFixed(0)}%`,
                  },
                  {
                    label: "Consensus",
                    value: consensusLevel,
                    sub: `${(agreePct * 100).toFixed(0)}% agreement`,
                    color: consensusColor,
                  },
                  {
                    label: "Ensemble Prob",
                    value: `${(ensProbs[topDiseaseIdx] * 100).toFixed(1)}%`,
                    sub: "avg across models",
                  },
                ].map(({ label, value, sub, color }) => (
                  <div
                    key={label}
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                      padding: "12px 14px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: color || recColor,
                      }}
                    >
                      {value}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {sub}
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendation */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 16px",
                  background: "var(--bg-card)",
                  border: `1px solid ${recBorder}`,
                  borderRadius: "var(--r-md)",
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>💊</span>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                      marginBottom: 4,
                    }}
                  >
                    Recommendation
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: recColor,
                      fontWeight: 600,
                      lineHeight: 1.6,
                    }}
                  >
                    {recommendation}
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  lineHeight: 1.6,
                }}
              >
                ⚠ Research tool only · Not FDA-approved · Always consult a
                qualified cardiologist
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const s = {
  wrap: { width: "100%", display: "flex", flexDirection: "column", gap: 0 },
  col: { display: "flex", flexDirection: "column", gap: 18 },
  tabBar: {
    display: "flex",
    gap: 0,
    marginBottom: 24,
    borderBottom: "1px solid var(--border)",
    overflowX: "auto",
  },
  tabBtn: {
    padding: "10px 16px",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text-muted)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "var(--t-fast)",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomStyle: "solid",
    color: "inherit",
  },
  tabSpinner: {
    width: 8,
    height: 8,
    border: "1.5px solid rgba(255,255,255,0.2)",
    borderTopColor: "var(--text-inverse)",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    display: "inline-block",
  },
  verdictBox: {
    padding: "20px 24px",
    borderRadius: "var(--r-lg)",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
  },
  verdictIcon: {
    width: 44,
    height: 44,
    borderRadius: "var(--r-md)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    color: "var(--text-inverse)",
    fontWeight: 800,
    flexShrink: 0,
  },
  verdictLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "var(--text-muted)",
    letterSpacing: "0.8px",
    marginBottom: 4,
  },
  verdictName: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" },
  verdictMeta: { fontSize: 11, color: "var(--text-muted)", marginTop: 5 },
  bigPct: { fontSize: 28, fontWeight: 800, letterSpacing: "-1px" },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: 20,
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-primary)",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: "var(--r-sm)",
  },
  smallBtn: {
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 10px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition: "var(--t-fast)",
  },
  btn: {
    display: "block",
    width: "100%",
    padding: "12px 20px",
    background: "var(--grad-brand)",
    color: "var(--text-inverse)",
    border: "none",
    borderRadius: "var(--r-md)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "var(--t)",
  },
  heatLegend: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    justifyContent: "center",
  },
  heatGradBar: {
    flex: 1,
    maxWidth: 200,
    height: 6,
    borderRadius: "var(--r-sm)",
    background: "linear-gradient(90deg, #3d55e6, #d98324, #c2362b)",
  },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 },
  stat: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "14px 10px",
    textAlign: "center",
  },
  statVal: { fontSize: 17, fontWeight: 700 },
  statLbl: {
    fontSize: 10,
    color: "var(--text-muted)",
    marginTop: 5,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  pertLoadBox: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "24px 20px",
    background: "var(--bg-elevated)",
    borderRadius: "var(--r-md)",
    border: "1px solid var(--border)",
  },
  bigSpinner: {
    width: 28,
    height: 28,
    border: "3px solid var(--border)",
    borderTopColor: "var(--blue-light)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    flexShrink: 0,
  },
  regionRow: { display: "flex", alignItems: "center", gap: 10 },
  regionRank: {
    fontSize: 10,
    fontWeight: 800,
    color: "var(--text-inverse)",
    padding: "2px 6px",
    borderRadius: "var(--r-xs)",
    flexShrink: 0,
  },
  regionBarWrap: {
    flex: 1,
    background: "var(--bg-base)",
    borderRadius: "var(--r-sm)",
    height: 6,
    overflow: "hidden",
  },
  regionBarFill: {
    height: "100%",
    borderRadius: "var(--r-sm)",
    transition: "width 0.6s var(--ease)",
  },
  chanceRow: { display: "flex", alignItems: "center", gap: 12 },
  miniChanceRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  chanceLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: 200,
    flexShrink: 0,
  },
  clsDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  chanceBarWrap: {
    flex: 1,
    background: "var(--bg-base)",
    borderRadius: "var(--r-sm)",
    height: 8,
    overflow: "hidden",
  },
  chanceBarFill: {
    height: "100%",
    borderRadius: "var(--r-sm)",
    transition: "width 0.7s var(--ease)",
  },
  chancePct: {
    width: 48,
    fontSize: 12,
    fontWeight: 700,
    textAlign: "right",
    flexShrink: 0,
  },
  topBadge: {
    fontSize: 9,
    fontWeight: 800,
    color: "var(--text-inverse)",
    padding: "2px 5px",
    borderRadius: "var(--r-xs)",
    marginLeft: 6,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: {
    padding: "8px 10px",
    textAlign: "left",
    color: "var(--text-muted)",
    fontWeight: 700,
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
    fontSize: 11,
  },
  tr: { borderBottom: "1px solid rgba(18,22,48,0.08)" },
  td: {
    padding: "8px 10px",
    color: "var(--text-secondary)",
    whiteSpace: "nowrap",
  },
  modelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))",
    gap: 12,
  },
  modelCard: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderTop: "3px solid",
    borderRadius: "var(--r-md)",
    padding: 14,
  },
  modelName: {
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 8,
  },
  modelPred: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  confBarWrap: {
    background: "var(--bg-base)",
    borderRadius: "var(--r-xs)",
    height: 5,
    marginBottom: 5,
    overflow: "hidden",
  },
  confBarFill: {
    height: "100%",
    borderRadius: "var(--r-xs)",
    transition: "width 0.6s var(--ease)",
  },
  modelConf: { fontSize: 11, color: "var(--text-muted)", fontWeight: 600 },
  footer: {
    marginTop: 24,
    padding: "16px 20px",
    borderRadius: "var(--r-lg)",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  exportBtn: {
    alignSelf: "center",
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "var(--t-fast)",
  },
};
