import React, { useState } from "react";
import {
  IconPulse, IconBook, IconUpload, IconCamera, IconPaste, IconFlask, IconFile,
  IconShield, IconLayers, IconHeat, IconDoc, IconDatabase, IconCpu, IconCode,
  IconEye, IconTarget, IconAlert, IconCheck, IconHistory, IconInfo,
} from "./icons";

const CLASS_GUIDE = [
  {
    code: "N",
    title: "Normal",
    color: "#34d399",
    text: "The beat's shape resembles a normal heartbeat. This is a beat-type label only: it does not confirm normal rhythm or normal conduction intervals.",
  },
  {
    code: "S",
    title: "Supraventricular ectopic",
    color: "#6b8cff",
    text: "An early beat that starts above the ventricles (atria or AV node). It does not by itself identify the arrhythmia type; correlate with the full ECG.",
  },
  {
    code: "V",
    title: "Ventricular ectopic",
    color: "#f87171",
    text: "A beat that starts in the ventricles, such as a premature ventricular contraction. The label does not establish diagnosis or urgency.",
  },
  {
    code: "F",
    title: "Fusion",
    color: "#fbbf24",
    text: "A blend of a normal and a ventricular beat. The label does not establish the underlying activation mechanism.",
  },
  {
    code: "Q",
    title: "Unclassifiable",
    color: "#a78bfa",
    text: "The beat could not be placed in another class, which can reflect poor signal quality or paced rhythm. Manual review is needed.",
  },
];

const METHODS = [
  {
    Icon: IconFile,
    title: "CSV file",
    steps: [
      "Export one heartbeat as a CSV row of 187 amplitude values.",
      "Open the CSV tab in Analyze and choose the file.",
      "The first row is read automatically; a trailing label column is ignored.",
    ],
  },
  {
    Icon: IconCamera,
    title: "ECG photo",
    steps: [
      "Photograph or scan a printed strip or monitor with a visible trace.",
      "Upload it from the Photo tab (JPG or PNG).",
      "The trace is extracted, cut into single beats at the R peaks, and each beat is analysed.",
      "Straight, well-lit images give the best results. Photo results are less reliable than digital signals.",
    ],
  },
  {
    Icon: IconPaste,
    title: "Paste values",
    steps: [
      "Paste 187 values separated by commas, tabs or spaces (scientific notation works).",
      "Wait until the counter reads 187/187.",
      "Press Analyze signal.",
    ],
  },
  {
    Icon: IconFlask,
    title: "Samples",
    steps: [
      "Pick a sample type on the Samples tab.",
      "A synthetic beat is generated and analysed immediately.",
      "Samples demonstrate the interface only; they are not clinical data.",
    ],
  },
];

const RESULT_TABS = [
  {
    Icon: IconTarget,
    title: "Clinical Summary",
    text: "The default view. It leads with the arrhythmia screen, then the most likely beat type, the ECG trace with the sensitivity heatmap, and a reminder that a clinician must confirm findings.",
  },
  {
    Icon: IconLayers,
    title: "Model Comparison",
    text: "For researchers. Compares the deep-learning and classical models, shows each model's vote and how strongly the group agrees.",
  },
  {
    Icon: IconPulse,
    title: "Ensemble Scores",
    text: "The averaged score for each of the five beat classes. The highest mean score selects the predicted class. Scores are uncalibrated model outputs.",
  },
  {
    Icon: IconDatabase,
    title: "All Models",
    text: "One card per model with its prediction, confidence and class probabilities. Useful for spotting an outlier model.",
  },
  {
    Icon: IconDoc,
    title: "PDF report",
    text: "Page 1 is a clinician summary. Page 2 is a technical appendix for researchers.",
  },
  {
    Icon: IconHistory,
    title: "History",
    text: "Analyses from the current session (up to 10). Open any entry to reload its results. History clears when the page is refreshed.",
  },
];

const HEAT_LEVELS = [
  { color: "#6b8cff", label: "Low impact", text: "Hiding this part barely changed the result." },
  { color: "#fbbf24", label: "Moderate impact", text: "This part has some influence on the result." },
  { color: "#f87171", label: "High impact", text: "Hiding this part changed the result a lot; it drove the prediction." },
];

const HEAT_REGIONS = [
  ["QRS complex", "The models are focusing on ventricular depolarisation, which is expected."],
  ["P-wave region", "Atrial activity is driving the result, typical for supraventricular beats."],
  ["ST-T region", "Repolarisation is influencing the result; relevant to ischaemia or electrolyte issues."],
  ["Baseline / edges", "The models may be reacting to noise or baseline wander. Review manually."],
];

const GUIDE_SECTIONS = [
  { id: "classes", label: "Beat types", Icon: IconPulse },
  { id: "use", label: "How to use", Icon: IconUpload },
  { id: "results", label: "Reading results", Icon: IconLayers },
  { id: "heatmap", label: "Sensitivity map", Icon: IconHeat },
];

function PageHeader({ eyebrow, title, children }) {
  return (
    <header className="ev-page-head">
      <div className="ev-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}

export function GuidePage() {
  const [section, setSection] = useState("classes");

  return (
    <div className="ev-fade">
      <PageHeader eyebrow="Reference" title="Clinical guide">
        What each result means, how to provide an ECG, and how to read the sensitivity map.
      </PageHeader>

      <div className="ev-guide">
        <nav className="ev-subnav" aria-label="Guide sections">
          {GUIDE_SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={section === id ? "is-active" : ""}
              onClick={() => setSection(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="ev-guide-body">
          {section === "classes" && (
            <div className="ev-cards">
              {CLASS_GUIDE.map(({ code, title, color, text }) => (
                <article className="ev-card ev-card--row" key={code} style={{ "--c": color }}>
                  <div className="ev-badge">{code}</div>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </article>
              ))}
              <div className="ev-callout">
                <IconAlert size={18} />
                <span>
                  These are beat-type labels from an automated model. They are not diagnoses; read
                  them alongside the full ECG and the clinical context.
                </span>
              </div>
            </div>
          )}

          {section === "use" && (
            <div className="ev-cards ev-cards--2">
              {METHODS.map(({ Icon, title, steps }) => (
                <article className="ev-card" key={title}>
                  <div className="ev-card-icon">
                    <Icon size={20} />
                  </div>
                  <h3>{title}</h3>
                  <ol className="ev-steps-list">
                    {steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          )}

          {section === "results" && (
            <div className="ev-cards ev-cards--2">
              {RESULT_TABS.map(({ Icon, title, text }) => (
                <article className="ev-card" key={title}>
                  <div className="ev-card-icon">
                    <Icon size={20} />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          )}

          {section === "heatmap" && (
            <div className="ev-cards">
              <article className="ev-card">
                <div className="ev-card-icon">
                  <IconEye size={20} />
                </div>
                <h3>What the map shows</h3>
                <p>
                  It answers one question: <b>which parts of this beat most influenced the result?</b>{" "}
                  A 10-sample window is slid across the 187 points and hidden in turn. Every model is
                  re-run, and the drop in the ensemble's score for the predicted class is recorded. A
                  large drop means that region mattered.
                </p>
              </article>

              <article className="ev-card">
                <h3>Reading the colour ribbon</h3>
                <div className="ev-ribbon" aria-hidden="true" />
                <div className="ev-ribbon-labels">
                  <span>Low</span>
                  <span>Moderate</span>
                  <span>High</span>
                </div>
                <ul className="ev-legend">
                  {HEAT_LEVELS.map(({ color, label, text }) => (
                    <li key={label}>
                      <i style={{ background: color }} />
                      <div>
                        <b style={{ color }}>{label}</b>
                        <span>{text}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="ev-card">
                <h3>Interpreting the highlighted region</h3>
                <ul className="ev-legend">
                  {HEAT_REGIONS.map(([region, text]) => (
                    <li key={region}>
                      <i style={{ background: "var(--ev-accent)" }} />
                      <div>
                        <b>{region}</b>
                        <span>{text}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>

              <div className="ev-callout">
                <IconCheck size={18} />
                <span>
                  The "top sensitive regions" list under the ribbon ranks the three most influential
                  windows, so you can go straight to the segment worth checking.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ABOUT_CARDS = [
  {
    Icon: IconInfo,
    title: "Project",
    text: "EchoVote is an AI-assisted ECG beat-screening tool built as a capstone research project at BMSCE Bengaluru. It combines the outputs of eight models into an arrhythmia screen and a predicted beat class.",
  },
  {
    Icon: IconDatabase,
    title: "Training data",
    text: "MIT-BIH Arrhythmia Database: 87,554 training beats in five AAMI classes (N, S, V, F, Q). Class imbalance was handled with SMOTE oversampling. Each beat is 187 amplitude samples.",
  },
  {
    Icon: IconCpu,
    title: "Models",
    text: "Three deep-learning models (1D-CNN, BiLSTM, CNN-LSTM) and five classical models (Random Forest, XGBoost, KNN, SVM, Logistic Regression). The predicted class has the highest mean probability across models.",
  },
  {
    Icon: IconTarget,
    title: "Arrhythmia screen",
    text: "A beat is flagged when the ensemble's combined probability of any abnormal class reaches 40%. For a photographed strip, every beat is screened and the strip is flagged when a fifth or more of its beats are.",
  },
  {
    Icon: IconHeat,
    title: "Explainability",
    text: "A perturbation-based sensitivity map slides a 10-sample window across the beat, hides each window, re-runs the models, and records the drop in the ensemble's score for the predicted class.",
  },
  {
    Icon: IconCamera,
    title: "Photo processing",
    text: "Contrast enhancement, adaptive thresholding and per-column centroid extraction recover the trace. R peaks are detected, the strip is cut into beats, and each beat is rescaled to the training format before analysis.",
  },
  {
    Icon: IconCode,
    title: "Technology",
    text: "React 18 frontend, FastAPI backend (Python 3.10), TensorFlow 2.16 (CPU), scikit-learn, XGBoost, OpenCV, served with Docker Compose and Nginx.",
  },
  {
    Icon: IconShield,
    title: "Security",
    text: "Accounts are stored in a local SQLite user database persisted in a Docker volume. Uploaded ECGs are analysed in memory and are not stored by the server.",
  },
];

export function AboutPage() {
  return (
    <div className="ev-fade">
      <PageHeader eyebrow="About" title="EchoVote">
        A research decision-support tool that screens ECG beats for arrhythmia and explains which
        parts of the waveform drove the result.
      </PageHeader>

      <div className="ev-cards ev-cards--3">
        {ABOUT_CARDS.map(({ Icon, title, text }) => (
          <article className="ev-card" key={title}>
            <div className="ev-card-icon">
              <Icon size={20} />
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>

      <div className="ev-disclaimer">
        <IconShield size={22} />
        <div>
          <b>Research use only</b>
          <p>
            EchoVote is not a certified medical device and is not approved by the FDA, CE or CDSCO.
            It does not provide a diagnosis. Every finding must be confirmed by a qualified
            clinician before any clinical decision.
          </p>
        </div>
      </div>
    </div>
  );
}

export { IconBook };
