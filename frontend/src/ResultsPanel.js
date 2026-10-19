import React, { useState, useEffect, useCallback } from "react";
import ECGChart from "./ECGChart";
import { jsPDF } from "jspdf";
import { getEnsemblePrediction } from "./ensemble";

const API = process.env.REACT_APP_API_BASE || "";

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
  const [pertError, setPertError] = useState(null);
  const { signal, predictions, ensemble_probs, source_image } = data;

  const valid = Object.entries(predictions).filter(
    ([, r]) => r.prediction && r.prediction !== "Error",
  );
  const dlPreds = valid.filter(([n]) => DL_NAMES.has(n));
  const mlPreds = valid.filter(([n]) => !DL_NAMES.has(n));

  const {
    scores: ensProbs,
    prediction: consensus,
    classIndex: topDiseaseIdx,
  } = getEnsemblePrediction(predictions, ensemble_probs, CLASSES);

  const counts = {};
  valid.forEach(
    ([, r]) => (counts[r.prediction] = (counts[r.prediction] || 0) + 1),
  );
  const sev = SEV[consensus] || SEV["Normal (N)"];
  const predClassIdx = CLASSES.indexOf(consensus);
  const selectedClassScore = topDiseaseIdx >= 0 ? ensProbs[topDiseaseIdx] : 0;

  const fetchPerturbation = useCallback(async () => {
    if (sensitivity || pertLoading || !signal || predClassIdx < 0) return;
    setPertLoading(true);
    setPertError(null);
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
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : null;
      if (!res.ok) {
        throw new Error(
          data?.detail || `Server returned ${res.status} ${res.statusText}`,
        );
      }
      if (!data?.success || !Array.isArray(data.sensitivity)) {
        throw new Error("The server did not return a valid heatmap.");
      }
      setSensitivity(data.sensitivity);
    } catch (error) {
      setPertError(error.message || "Failed to compute the heatmap.");
    } finally {
      setPertLoading(false);
    }
  }, [signal, predClassIdx, sensitivity, pertLoading]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchPerturbation();
  }, []);

  const REPORT_SCOPE_NOTE =
    "This report summarizes the model's classification of an isolated 187-sample beat segment. ECG morphology, rhythm, rate, and conduction intervals have not been independently measured by this system.";
  const REPORT_INTERPRETATION_NOTE =
    "This model output requires interpretation alongside the ECG and clinical context.";

  const CLINICAL_DEFINITIONS = {
    "Normal (N)": {
      fullName: "Predicted ECG Beat Class: Normal (N)",
      aamiCode: "AAMI EC57 Class N · Isolated Beat Evaluation",
      badgeBg: [15, 157, 138],
    },
    "Supraventricular (S)": {
      fullName: "Predicted ECG Beat Class: Supraventricular Ectopic (S)",
      aamiCode: "AAMI EC57 Class S · Atrial / Nodal Ectopic Beat",
      badgeBg: [61, 85, 230],
    },
    "Ventricular (V)": {
      fullName: "Predicted ECG Beat Class: Ventricular Ectopic (V)",
      aamiCode: "AAMI EC57 Class V · Ventricular Ectopic Beat",
      badgeBg: [194, 54, 43],
    },
    "Fusion (F)": {
      fullName: "Predicted ECG Beat Class: Fusion Beat (F)",
      aamiCode: "AAMI EC57 Class F · Hybrid Activation",
      badgeBg: [217, 131, 36],
    },
    "Unclassifiable (Q)": {
      fullName: "Predicted ECG Beat Class: Unclassifiable (Q)",
      aamiCode: "AAMI EC57 Class Q · Indeterminate Morphology",
      badgeBg: [91, 75, 214],
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210,
      H = 297,
      M = 14;
    const usableW = W - 2 * M; // 182 mm

    const hex2rgb = (hex) => {
      if (!hex || typeof hex !== "string") return [91, 75, 214];
      const clean = hex.replace("#", "");
      if (clean.length === 3) {
        return [
          parseInt(clean[0] + clean[0], 16),
          parseInt(clean[1] + clean[1], 16),
          parseInt(clean[2] + clean[2], 16),
        ];
      }
      return [
        parseInt(clean.slice(0, 2), 16) || 0,
        parseInt(clean.slice(2, 4), 16) || 0,
        parseInt(clean.slice(4, 6), 16) || 0,
      ];
    };

    const clin = CLINICAL_DEFINITIONS[consensus] || CLINICAL_DEFINITIONS["Normal (N)"];
    const [hr, hg, hb] = hex2rgb(sev.border);

    // Cohort calculations for DL and ML
    const getCohortSummary = (group) => {
      if (!group.length) return { consensus: "N/A", avgConf: 0, count: 0, agreePct: 0, total: 0 };
      const c = {};
      group.forEach(([, r]) => (c[r.prediction] = (c[r.prediction] || 0) + 1));
      const gConsensus = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
      const matching = group.filter(([, r]) => r.prediction === gConsensus);
      const gAvgConf =
        matching.reduce((s, [, r]) => s + (r.confidence || 0), 0) / (matching.length || 1);
      const gAgreePct = matching.length / group.length;
      return { consensus: gConsensus, avgConf: gAvgConf, count: matching.length, total: group.length, agreePct: gAgreePct };
    };

    const dlSummary = getCohortSummary(dlPreds);
    const mlSummary = getCohortSummary(mlPreds);
    const isConcordant = dlSummary.consensus === mlSummary.consensus;
    const concordanceText = isConcordant
      ? "DL & ML Cohorts Concordant"
      : `Cohort Discrepancy (DL: ${dlSummary.consensus?.split(" ")[0]} vs ML: ${mlSummary.consensus?.split(" ")[0]})`;

    const agreePct = (counts[consensus] || 0) / (valid.length || 1);
    const agreementTier =
      agreePct >= 0.875 ? "High" : agreePct >= 0.625 ? "Moderate" : "Low";

    // =========================================================================
    // PAGE 1: MODEL OUTPUT & CLASS SCORE DISTRIBUTION
    // =========================================================================

    // ── Header bar ───────────────────────────────────────────────────────────
    doc.setFillColor(18, 24, 38);
    doc.rect(0, 0, W, 22, "F");

    // Accent strip under header
    doc.setFillColor(hr, hg, hb);
    doc.rect(0, 21.2, W, 0.8, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("EchoVote — ECG Beat-Class & Ensemble Report", M, 11);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 174, 192);
    doc.text("Lead II Cardiac Arrhythmia Decision Support · 8-Model Ensemble Architecture", M, 17);

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(203, 213, 225);
    doc.text("CONFIDENTIAL MEDICAL DECISION SUPPORT", W - M, 10.5, { align: "right" });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 174, 192);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} · Page 1 of 2`, W - M, 16.5, {
      align: "right",
    });

    let y = 29;

    // ── Section 1: Model Output & Executive Summary ──────────────────────────
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("1. ALGORITHMIC BEAT-CLASS PREDICTION", M, y);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.line(M, y + 2, W - M, y + 2);
    y += 6.5;

    // Primary Classification Banner Card (Dynamically Sized)
    const [badgeR, badgeG, badgeB] = clin.badgeBg;
    const badgeW = 62;
    const badgeH = 6.2;
    const badgeX = W - M - badgeW - 3;
    const badgeY = y + 3.5;

    // Measure wrapped diagnosis title
    doc.setFontSize(12.5);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(clin.fullName, usableW - badgeW - 14);

    // Meta details formatted in 2 clean wrapped lines
    const metaLine1 = `${clin.aamiCode}   |   Model Votes for Predicted Class: ${counts[consensus] || 0}/${valid.length} (${(agreePct * 100).toFixed(0)}%)   |   Mean Class Score: ${(selectedClassScore * 100).toFixed(1)}%`;
    const metaLine2 = `Cohort Agreement: ${concordanceText}   |   Model Agreement Tier: ${agreementTier}`;
    doc.setFontSize(7.4);
    doc.setFont("helvetica", "normal");
    const metaLines1 = doc.splitTextToSize(metaLine1, usableW - 14);
    const metaLines2 = doc.splitTextToSize(metaLine2, usableW - 14);

    const bannerH = Math.max(30, 14 + titleLines.length * 4.8 + (metaLines1.length + metaLines2.length) * 3.5);

    doc.setFillColor(250, 251, 254);
    doc.setDrawColor(hr, hg, hb);
    doc.setLineWidth(0.6);
    doc.roundedRect(M, y, usableW, bannerH, 1.5, 1.5, "FD");

    // Left accent block
    doc.setFillColor(hr, hg, hb);
    doc.rect(M, y, 3.5, bannerH, "F");

    // Model output badge (pill)
    doc.setFillColor(badgeR, badgeG, badgeB);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.2, 1.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "bold");
    doc.text("MODEL OUTPUT", badgeX + badgeW / 2, badgeY + 4.3, { align: "center" });

    // Category label
    doc.setFontSize(7.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("PRIMARY ALGORITHMIC BEAT PREDICTION (AAMI EC57):", M + 6.5, y + 5.5);

    // Predicted beat class (multiline safe)
    doc.setFontSize(12.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(hr, hg, hb);
    let titleY = y + 12;
    doc.text(titleLines, M + 6.5, titleY);
    titleY += titleLines.length * 4.8;

    // Metadata lines (multiline safe)
    doc.setFontSize(7.4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(metaLines1, M + 6.5, titleY);
    titleY += metaLines1.length * 3.5;
    doc.text(metaLines2, M + 6.5, titleY);

    y += bannerH + 4.5;

    // Input scope and measurement limitations
    doc.setFontSize(7.2);
    doc.setFont("helvetica", "normal");
    const obsLines = doc.splitTextToSize(REPORT_SCOPE_NOTE, usableW - 12);
    const obsH = Math.max(22, 10 + obsLines.length * 3.7);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, usableW, obsH, 1.5, 1.5, "FD");

    doc.setFontSize(7.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("INPUT SCOPE & MEASUREMENT LIMITS", M + 5, y + 5.5);

    doc.setFontSize(7.2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(obsLines, M + 5, y + 11.2);

    y += obsH + 4;

    // Neutral interpretation note
    doc.setFontSize(7.0);
    doc.setFont("helvetica", "normal");
    const actionLines = doc.splitTextToSize(REPORT_INTERPRETATION_NOTE, usableW - 14);
    const actH = Math.max(20, 15 + actionLines.length * 3.7);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.roundedRect(M, y, usableW, actH, 1.5, 1.5, "FD");

    doc.setFillColor(hr, hg, hb);
    doc.rect(M, y, 2.5, actH, "F");

    doc.setFontSize(7.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(hr, hg, hb);
    doc.text("INTERPRETATION NOTE", M + 5, y + 5.5);

    doc.setFontSize(7.0);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(actionLines, M + 5, y + 11.2);

    y += actH + 5.5;

    // ── Section 2: Multi-Model Ensemble Consensus (Class Scores) ─────────────
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("2. ENSEMBLE CLASS SCORES", M, y);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.line(M, y + 2, W - M, y + 2);
    y += 5.5;

    doc.setFontSize(7.2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const scoreMethodLines = doc.splitTextToSize(
      "The predicted class is the class with the highest arithmetic mean of the valid models' class scores. Model vote counts are shown separately as agreement; scores are uncalibrated model outputs:",
      usableW,
    );
    doc.text(scoreMethodLines, M, y);
    y += scoreMethodLines.length * 3.5 + 1;

    // Class Score Bars
    const barW = usableW - 88;
    CLASSES.forEach((cls, i) => {
      const score = ensProbs[i] || 0;
      const isSelected = cls === consensus;
      const [cr, cg, cb] = hex2rgb(COLOR[cls]);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", isSelected ? "bold" : "normal");
      doc.setTextColor(cr, cg, cb);
      doc.text(cls, M, y + 3.8);

      // Track
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(M + 46, y, barW, 4.8, 0.8, 0.8, "F");

      // Fill
      if (score > 0.005) {
        doc.setFillColor(cr, cg, cb);
        doc.roundedRect(M + 46, y, Math.max(barW * score, 1.5), 4.8, 0.8, 0.8, "F");
      }

      // Percentage
      doc.setFontSize(7.2);
      doc.setFont("helvetica", isSelected ? "bold" : "normal");
      doc.setTextColor(cr, cg, cb);
      doc.text(`${(score * 100).toFixed(1)}%`, M + 46 + barW + 3, y + 3.6);

      // Plurality Vote / Primary Tag
      if (isSelected) {
        doc.setFillColor(cr, cg, cb);
        doc.roundedRect(M + 46 + barW + 15, y + 0.3, 27, 4.2, 0.8, 0.8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "bold");
        doc.text("PREDICTED CLASS", M + 46 + barW + 28.5, y + 3.3, { align: "center" });
      }

      y += 6.5;
    });

    y += 3;

    // Essential Technical & Calibration Note Callout (Dynamically Sized)
    const noteText =
      "Ensemble methodology: the predicted class is the class with the highest arithmetic mean score across valid model probability distributions (soft voting). Exact score ties follow the fixed order N, S, V, F, Q. The count of individual model predictions for the selected class is reported separately as model agreement; it does not select the class. Scores are uncalibrated model outputs, not measured clinical confidence or disease probabilities, and require interpretation alongside the ECG and clinical context.";
    doc.setFontSize(6.6);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(noteText, usableW - 12);
    const noteH = Math.max(22, 10 + noteLines.length * 3.4);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, usableW, noteH, 1.5, 1.5, "FD");

    doc.setFillColor(100, 116, 139);
    doc.rect(M, y, 2.5, noteH, "F");

    doc.setFontSize(7.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("TECHNICAL VERIFICATION NOTE: CALIBRATION & SCORE INTERPRETATION", M + 5, y + 5);

    doc.setFontSize(6.6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(noteLines, M + 5, y + 9.5);

    // Page 1 Footer
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Page 1 of 2: Model Output & Class Scores — Turn to Page 2 for Model Results & Technical Methodology",
      W / 2,
      288,
      { align: "center" },
    );

    // =========================================================================
    // PAGE 2: DETAILED 8-MODEL AUDIT TABLE & RESEARCH METHODOLOGY
    // =========================================================================
    doc.addPage();

    // Page 2 Header Bar
    doc.setFillColor(18, 24, 38);
    doc.rect(0, 0, W, 18, "F");
    doc.setFillColor(hr, hg, hb);
    doc.rect(0, 17.3, W, 0.7, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11.5);
    doc.setFont("helvetica", "bold");
    doc.text("EchoVote — Detailed 8-Model Benchmark & Research Audit", M, 11);

    doc.setFontSize(7.2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 174, 192);
    doc.text("Model-by-Model Verification Table · Capstone Project Viva Audit Data · Page 2 of 2", W - M, 11, {
      align: "right",
    });

    y = 25;

    // ── Section 3: Eight-Model Benchmark Table ───────────────────────────────
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("3. EIGHT-MODEL CLASSIFICATION BENCHMARK TABLE (TECHNICAL AUDIT)", M, y);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.line(M, y + 2, W - M, y + 2);
    y += 5.5;

    // Table Column Definitions
    const colNames = ["Model Name", "Type", "Predicted Class", "Conf.", "N (%)", "S (%)", "V (%)", "F (%)", "Q (%)"];
    const colWidths = [34, 14, 32, 17, 17, 17, 17, 17, 17];
    let colX = [];
    let curX = M;
    colWidths.forEach((w) => {
      colX.push(curX);
      curX += w;
    });

    // Table Header
    doc.setFillColor(30, 41, 59);
    doc.rect(M, y, usableW, 6.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "bold");
    colNames.forEach((name, idx) => {
      doc.text(name, colX[idx] + 2, y + 4.2);
    });
    y += 6.2;

    // Table Rows (All 8 Models)
    valid.forEach(([name, pred], idx) => {
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(M, y, usableW, 6.2, "F");

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(M, y + 6.2, W - M, y + 6.2);

      const isDL = DL_NAMES.has(name);
      const [pr, pg, pb] = hex2rgb(COLOR[pred.prediction] || "#8a8c9c");

      // Model Name
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(6.8);
      doc.setFont("helvetica", "bold");
      doc.text(name, colX[0] + 2, y + 4.2);

      // Type Badge
      doc.setFillColor(isDL ? 238 : 240, isDL ? 242 : 253, isDL ? 255 : 250);
      doc.roundedRect(colX[1] + 1.5, y + 1.2, 10, 3.8, 0.6, 0.6, "F");
      doc.setTextColor(isDL ? 61 : 15, isDL ? 85 : 157, isDL ? 230 : 138);
      doc.setFontSize(5.8);
      doc.setFont("helvetica", "bold");
      doc.text(isDL ? "DL" : "ML", colX[1] + 6.5, y + 3.8, { align: "center" });

      // Predicted Class
      doc.setTextColor(pr, pg, pb);
      doc.setFontSize(6.8);
      doc.setFont("helvetica", "bold");
      doc.text(pred.prediction?.split(" ")[0] || "-", colX[2] + 2, y + 4.2);

      // Model Confidence
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(6.8);
      doc.setFont("helvetica", "normal");
      doc.text(`${((pred.confidence || 0) * 100).toFixed(1)}%`, colX[3] + 2, y + 4.2);

      // N, S, V, F, Q distributions
      (pred.probs || [0, 0, 0, 0, 0]).forEach((p, pi) => {
        const isMatch = pred.class_idx === pi;
        const [cpr, cpg, cpb] = hex2rgb(COLOR[CLASSES[pi]]);
        doc.setTextColor(isMatch ? cpr : 148, isMatch ? cpg : 163, isMatch ? cpb : 184);
        doc.setFont("helvetica", isMatch ? "bold" : "normal");
        doc.setFontSize(isMatch ? 6.8 : 6.3);
        doc.text(`${(p * 100).toFixed(0)}%`, colX[4 + pi] + 2, y + 4.2);
      });

      y += 6.2;
    });

    y += 5;

    // Cohort Sub-Analysis Cards (DL vs ML)
    doc.setFontSize(8.0);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("COHORT BREAKDOWN: DEEP LEARNING VS. CLASSICAL MACHINE LEARNING", M, y);
    y += 4;

    const cardW = (usableW - 5) / 2;
    const cardH = 24;

    // Card 1: Deep Learning
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(M, y, cardW, cardH, 1.2, 1.2, "FD");

    doc.setFontSize(7.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(61, 85, 230);
    doc.text("DEEP LEARNING COHORT (3 MODELS)", M + 4, y + 4.8);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const dlArchLines = doc.splitTextToSize("Architectures: 1D-CNN, BiLSTM, CNN-LSTM", cardW - 8);
    doc.text(dlArchLines, M + 4, y + 9.2);

    doc.setFontSize(7.0);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`Consensus: ${dlSummary.consensus}`, M + 4, y + 14.8);

    doc.setFontSize(6.6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Agreement: ${dlSummary.count}/3 (${(dlSummary.agreePct * 100).toFixed(0)}%) · Mean Model Score: ${(dlSummary.avgConf * 100).toFixed(1)}%`,
      M + 4,
      y + 19.5,
    );

    // Card 2: Classical ML
    const mlCardX = M + cardW + 5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(mlCardX, y, cardW, cardH, 1.2, 1.2, "FD");

    doc.setFontSize(7.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 157, 138);
    doc.text("CLASSICAL ML COHORT (5 MODELS)", mlCardX + 4, y + 4.8);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const mlArchLines = doc.splitTextToSize("Estimators: Random Forest, XGBoost, KNN, SVM, LogReg", cardW - 8);
    doc.text(mlArchLines, mlCardX + 4, y + 9.2);

    doc.setFontSize(7.0);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`Consensus: ${mlSummary.consensus}`, mlCardX + 4, y + 14.8);

    doc.setFontSize(6.6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Agreement: ${mlSummary.count}/5 (${(mlSummary.agreePct * 100).toFixed(0)}%) · Mean Model Score: ${(mlSummary.avgConf * 100).toFixed(1)}%`,
      mlCardX + 4,
      y + 19.5,
    );

    y += cardH + 3.5;

    // Concordance Notification Strip (Dynamically Sized & Wrapped)
    const bannerColor = isConcordant ? [16, 185, 129] : [245, 158, 11];
    const bannerBg = isConcordant ? [236, 253, 245] : [255, 251, 235];
    const bannerText = isConcordant
      ? `Deep Learning and Classical ML cohort votes both select "${dlSummary.consensus}".`
      : `The cohort votes differ: Deep Learning selects "${dlSummary.consensus}" and Classical ML selects "${mlSummary.consensus}".`;

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    const bannerLines = doc.splitTextToSize(bannerText, usableW - 8);
    const confStripH = Math.max(6.5, 4 + bannerLines.length * 3.4);

    doc.setFillColor(bannerBg[0], bannerBg[1], bannerBg[2]);
    doc.setDrawColor(bannerColor[0], bannerColor[1], bannerColor[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(M, y, usableW, confStripH, 1, 1, "FD");

    doc.setTextColor(isConcordant ? 4 : 180, isConcordant ? 120 : 83, isConcordant ? 87 : 9);
    doc.text(bannerLines, M + 4, y + 4.2);

    y += confStripH + 4.5;

    // ── Section 4: Research Methodology & Architecture Specifications ────────
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("4. RESEARCH METHODOLOGY & SYSTEM ARCHITECTURE (VIVA REFERENCE)", M, y);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.line(M, y + 2, W - M, y + 2);
    y += 5.5;

    const colWidth = (usableW - 8) / 2;
    const col1Items = [
      ["Benchmark", "MIT-BIH Arrhythmia Database (PhysioNet)"],
      ["Input Shape", "187 normalized amplitude points per beat"],
      ["Sampling", "360 Hz (standard Lead II electrocardiogram)"],
      ["Taxonomy", "AAMI 5-Class: N, S, V, F, Q standard"],
      ["Balancing", "SMOTE synthetic oversampling in training"],
      ["Signal Proc.", "Adaptive centroid & min-max amplitude scaling"],
    ];

    const col2Items = [
      ["Deep Learning", "1D-CNN, BiLSTM, CNN-LSTM Hybrid (3 models)"],
      ["Classical ML", "Random Forest (100), XGBoost, KNN, SVM, LogReg (5 models)"],
      ["Class Decision", "Highest arithmetic mean class score (soft voting); ties follow N, S, V, F, Q order"],
      ["Class Scores", "Arithmetic mean of available model probability distributions"],
      ["Model Agreement Tier", "High (>=87.5% agreement), Moderate (>=62.5% and <87.5%), Low (<62.5%)"],
      ["Explainability", "10-sample sliding occlusion perturbation sensitivity map"],
    ];

    // Measure required height dynamically
    doc.setFontSize(6.5);
    let col1Height = 8;
    col1Items.forEach(([label, val]) => {
      const fullText = `• ${label}: ${val}`;
      const lines = doc.splitTextToSize(fullText, colWidth - 4);
      col1Height += lines.length * 3.4 + 1.2;
    });

    let col2Height = 8;
    col2Items.forEach(([label, val]) => {
      const fullText = `• ${label}: ${val}`;
      const lines = doc.splitTextToSize(fullText, colWidth - 4);
      col2Height += lines.length * 3.4 + 1.2;
    });

    const methH = Math.max(col1Height, col2Height) + 3;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, usableW, methH, 1.2, 1.2, "FD");

    // Render Left Column
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("DATASET & PREPROCESSING SPECIFICATION", M + 4, y + 5);

    let curY1 = y + 9.5;
    col1Items.forEach(([label, val]) => {
      const fullText = `• ${label}: ${val}`;
      const lines = doc.splitTextToSize(fullText, colWidth - 4);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(lines, M + 4, curY1);
      curY1 += lines.length * 3.4 + 1.2;
    });

    // Render Right Column
    const col2X = M + colWidth + 6;
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("ENSEMBLE PIPELINE & AUDIT PARAMETERS", col2X, y + 5);

    let curY2 = y + 9.5;
    col2Items.forEach(([label, val]) => {
      const fullText = `• ${label}: ${val}`;
      const lines = doc.splitTextToSize(fullText, colWidth - 4);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(lines, col2X, curY2);
      curY2 += lines.length * 3.4 + 1.2;
    });

    y += methH + 4;

    // ── Section 5: Regulatory Disclaimer & Attestation Block ─────────────────
    const discText =
      "EchoVote is an artificial intelligence research platform developed as an academic capstone investigation at BMSCE Bengaluru for clinical decision-support evaluation. It is NOT certified as a medical device by the US FDA, CE, or CDSCO. Model predictions, sensitivity maps, and ensemble scores are intended solely for investigational decision support and academic research. Treatment, diagnosis, or clinical decisions must be made by a licensed, board-certified physician.";
    doc.setFontSize(5.9);
    doc.setFont("helvetica", "normal");
    const discLines = doc.splitTextToSize(discText, usableW - 8);
    const discH = Math.max(16, 7 + discLines.length * 3.2);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, usableW, discH, 1.2, 1.2, "FD");

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("REGULATORY DISCLAIMER & INVESTIGATIONAL USE NOTICE", M + 4, y + 4.2);

    doc.setFontSize(5.9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(discLines, M + 4, y + 8.2);

    y += discH + 4;

    // Clinician Verification / Audit Sign-off Fields
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);

    const signW = (usableW - 8) / 3;
    const signH = 14;

    // Field 1
    doc.roundedRect(M, y, signW, signH, 1, 1, "S");
    doc.setFontSize(5.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("REVIEWING CLINICIAN / EXAMINER", M + 3, y + 4);

    // Field 2
    doc.roundedRect(M + signW + 4, y, signW, signH, 1, 1, "S");
    doc.text("INSTITUTION / DEPARTMENT", M + signW + 7, y + 4);

    // Field 3
    doc.roundedRect(M + (signW + 4) * 2, y, signW, signH, 1, 1, "S");
    doc.text("VERIFICATION DATE & SIGNATURE", M + (signW + 4) * 2 + 3, y + 4);

    // Page 2 Footer
    doc.setFontSize(6.6);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text(
      "EchoVote AI Cardiac Decision Support · BMSCE Bengaluru Capstone Project · Model Architecture: v2.4.1 · Page 2 of 2",
      W / 2,
      288,
      { align: "center" },
    );

    doc.save(`EchoVote_Clinical_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const tabs = ["overview", "disease-chance", "all-models"];
  const tabLabels = {
    overview: "Overview",
    "disease-chance": "Ensemble Scores",
    "all-models": "All Models",
  };

  return (
    <div style={s.wrap} className="anim-fadeUp">
      {/* ── Tab bar ── */}
      <div style={s.tabBar} className="results-tabs">
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
        <div style={s.col} className="results-overview">
          {/* Real image preview for photo uploads */}
          {source_image && (
            <div style={s.card} className="card-hover results-photo-preview">
              <div style={s.cardHead}>
                <span style={s.cardTitle}>Uploaded ECG Image</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Original · unmodified
                </span>
              </div>
              <img
                src={source_image}
                alt="Uploaded ECG"
                style={{
                  width: "100%",
                  borderRadius: "var(--r-md)",
                  display: "block",
                  maxHeight: 220,
                  objectFit: "contain",
                }}
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
            className="card-hover results-verdict"
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
                {counts[consensus] || 0}/{valid.length} model votes for this class
                &nbsp;·&nbsp; {(selectedClassScore * 100).toFixed(1)}% mean score
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...s.bigPct, color: sev.text }}>
                {(selectedClassScore * 100).toFixed(1)}%
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
          <div style={s.card} className="card-hover results-heatmap">
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
            {pertError && (
              <div
                role="alert"
                style={{
                  fontSize: 12,
                  color: "var(--red-light)",
                  textAlign: "center",
                  padding: "12px 0 0",
                }}
              >
                Heatmap failed: {pertError}
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
          <div style={s.card} className="card-hover results-model-compare">
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
          <div style={s.card} className="results-model-preview">
            <div className="results-model-preview-heading">
              <span style={s.cardTitle}>Model Predictions</span>
              <button
                type="button"
                className="results-view-models"
                onClick={() => setTab("all-models")}
              >
                View all models →
              </button>
            </div>
            <div className="results-model-preview-list">
              {valid.map(([name, pred]) => {
                const color = COLOR[pred.prediction] || "var(--text-muted)";
                return (
                  <div className="results-model-preview-row" key={name}>
                    <span
                      className="results-model-preview-class"
                      style={{ color, background: `${color}22` }}
                    >
                      {pred.prediction?.match(/\((.)\)/)?.[1] || "?"}
                    </span>
                    <span className="results-model-preview-name">{name}</span>
                    <span className="results-model-preview-bar">
                      <span
                        style={{
                          width: `${Math.min((pred.confidence || 0) * 100, 100)}%`,
                          background: color,
                        }}
                      />
                    </span>
                    <strong>{((pred.confidence || 0) * 100).toFixed(0)}%</strong>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={s.statsRow} className="results-stats">
            {[
              { v: valid.length, l: "Models Run" },
              { v: (selectedClassScore * 100).toFixed(0) + "%", l: "Mean Class Score" },
              {
                v: (((counts[consensus] || 0) / (valid.length || 1)) * 100).toFixed(0) + "%",
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
              <span style={s.cardTitle}>Ensemble Class Scores (Soft Voting)</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Averaged class scores across {valid.length} models (uncalibrated model outputs)
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
            <div style={s.cardTitle}>Per-Model Output Distributions</div>
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

            <div
              style={{
                marginTop: 18,
                padding: "12px 16px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
                fontSize: 12,
                color: "var(--text-muted)",
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                💡 Methodological Note on Calibration &amp; Scoring:
              </strong>
              Ensemble scores represent the unweighted arithmetic mean of individual model outputs across the 8
              estimators (soft voting). These uncalibrated averaged model scores are not measured clinical confidence or
              calibrated disease probabilities. Because post-hoc calibration (such as Platt scaling, isotonic regression,
              or temperature scaling) has not been performed on an independent cohort, interpret them as relative model
              outputs rather than empirical epidemiological risk.
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
        const agreePct = (counts[consensus] || 0) / (valid.length || 1);
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

        const recIcon = "ℹ️";
        const recColor = "#2b44d6";
        const recBg = "rgba(43,68,214,0.06)";
        const recBorder = "#2b44d6";
        const recommendation = `Predicted ECG beat class: ${consensus}. Interpret this model output alongside the ECG and clinical context.`;

        return (
          <div
            style={{
              marginTop: 24,
              border: `2px solid ${recBorder}`,
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}
            className="results-clinical-summary"
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
                Model Output & Interpretation
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
                  Predicted Beat Class
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
                  — {(selectedClassScore * 100).toFixed(1)}% mean class score
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
                    sub: `${(((counts[consensus] || 0) / (valid.length || 1)) * 100).toFixed(0)}%`,
                  },
                  {
                    label: "Model Agreement Tier",
                    value: consensusLevel,
                    sub: `${(agreePct * 100).toFixed(0)}% agreement`,
                    color: consensusColor,
                  },
                  {
                    label: "Top Mean Class Score",
                    value: `${(selectedClassScore * 100).toFixed(1)}%`,
                    sub: "mean across models",
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
