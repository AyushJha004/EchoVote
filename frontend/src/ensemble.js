export function getEnsemblePrediction(predictions, ensembleProbs, classes) {
  const validPredictions = Object.values(predictions || {}).filter(
    (result) => result?.prediction && result.prediction !== "Error",
  );
  const hasProvidedScores =
    Array.isArray(ensembleProbs) &&
    ensembleProbs.length === classes.length &&
    ensembleProbs.every(Number.isFinite);
  const probabilityVectors = validPredictions.filter(
    (result) =>
      Array.isArray(result.probs) &&
      result.probs.length === classes.length,
  );
  const scores = hasProvidedScores
    ? ensembleProbs
    : classes.map(
        (_, classIndex) =>
          probabilityVectors.reduce(
            (sum, result) =>
              sum +
              (Number.isFinite(result.probs[classIndex])
                ? result.probs[classIndex]
                : 0),
            0,
          ) / (probabilityVectors.length || 1),
      );

  if (
    !validPredictions.length ||
    (!probabilityVectors.length && !hasProvidedScores)
  ) {
    return { scores, prediction: "Unknown", classIndex: -1 };
  }

  const classIndex = scores.indexOf(Math.max(...scores));
  return {
    scores,
    prediction: classes[classIndex] || "Unknown",
    classIndex,
  };
}
