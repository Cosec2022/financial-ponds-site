export function validateObservation(observation, registry) {
  const errors = [];

  if (!observation || typeof observation !== "object") {
    errors.push("observation must be an object");
  }

  if (!observation.node_id) errors.push("node_id is required");
  if (!observation.as_of) errors.push("as_of is required");
  if (typeof observation.score !== "number") errors.push("score must be numeric");
  if (typeof observation.confidence !== "number") errors.push("confidence must be numeric");
  if (!observation.data_type) errors.push("data_type is required");
  if (!observation.source) errors.push("source is required");

  if (observation.node_id && registry && !registry.nodes.has(observation.node_id)) {
    errors.push(`node_id ${observation.node_id} is not registered as a node`);
  }

  if (typeof observation.score === "number" && (observation.score < -2 || observation.score > 2)) {
    errors.push("score must be in [-2, 2]");
  }

  if (
    typeof observation.confidence === "number"
    && (observation.confidence < 0 || observation.confidence > 1)
  ) {
    errors.push("confidence must be in [0, 1]");
  }

  if (errors.length) {
    throw new Error(`Invalid observation for ${observation?.node_id ?? "unknown"}:\n- ${errors.join("\n- ")}`);
  }

  return true;
}

export function observationsToScoreMap(observations) {
  const map = {};
  for (const observation of observations) {
    // Confidence scales node strength before it enters the graph. This keeps
    // uncertain AI/news inputs from having the same force as high-confidence data.
    map[observation.node_id] = observation.score * observation.confidence;
  }
  return map;
}
