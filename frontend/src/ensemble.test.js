import { getEnsemblePrediction } from "./ensemble";

const CLASSES = [
  "Normal (N)",
  "Supraventricular (S)",
  "Ventricular (V)",
  "Fusion (F)",
  "Unclassifiable (Q)",
];

describe("getEnsemblePrediction", () => {
  it("selects the highest averaged score even when another class has more model votes", () => {
    const predictions = {
      model1: { prediction: "Normal (N)", probs: [0.42, 0.45, 0.05, 0.04, 0.04] },
      model2: { prediction: "Normal (N)", probs: [0.42, 0.45, 0.05, 0.04, 0.04] },
      model3: { prediction: "Normal (N)", probs: [0.42, 0.45, 0.05, 0.04, 0.04] },
      model4: { prediction: "Supraventricular (S)", probs: [0.42, 0.45, 0.05, 0.04, 0.04] },
      model5: { prediction: "Supraventricular (S)", probs: [0.42, 0.45, 0.05, 0.04, 0.04] },
    };

    const result = getEnsemblePrediction(
      predictions,
      [0.42, 0.45, 0.05, 0.04, 0.04],
      CLASSES,
    );

    expect(result.prediction).toBe("Supraventricular (S)");
    expect(result.classIndex).toBe(1);
  });

  it("averages valid model scores when the backend did not provide ensemble scores", () => {
    const predictions = {
      model1: { prediction: "Normal (N)", probs: [0.7, 0.2, 0.05, 0.03, 0.02] },
      model2: { prediction: "Supraventricular (S)", probs: [0.3, 0.6, 0.05, 0.03, 0.02] },
      model3: { prediction: "Error", probs: [0, 0, 0, 0, 0] },
    };

    const result = getEnsemblePrediction(predictions, null, CLASSES);

    expect(result.prediction).toBe("Normal (N)");
    expect(result.scores).toEqual([0.5, 0.4, 0.05, 0.03, 0.02]);
  });

  it("resolves equal scores by the fixed class order", () => {
    const predictions = {
      model1: { prediction: "Supraventricular (S)", probs: [0.5, 0.5, 0, 0, 0] },
    };

    const result = getEnsemblePrediction(
      predictions,
      [0.5, 0.5, 0, 0, 0],
      CLASSES,
    );

    expect(result.prediction).toBe("Normal (N)");
  });
});
