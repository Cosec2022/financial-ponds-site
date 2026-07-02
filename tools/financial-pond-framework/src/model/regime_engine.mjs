export function evaluateRegimes({ observations, rules }) {
  const nodeScores = buildNodeScoreMap(observations);
  const active = [];

  for (const regime of rules.regimes ?? []) {
    const matchedConditions = [];
    let isActive = true;

    for (const condition of regime.conditions ?? []) {
      const actual = nodeScores.get(condition.node_id);
      const matched = matchesCondition(actual, condition);
      if (!matched) {
        isActive = false;
        break;
      }
      matchedConditions.push({
        node_id: condition.node_id,
        operator: condition.operator,
        expected: condition.value,
        actual
      });
    }

    if (isActive) {
      active.push({
        id: regime.id,
        name: regime.name ?? regime.id,
        description: regime.description ?? "",
        score: regime.score ?? 1,
        matched_conditions: matchedConditions
      });
    }
  }

  return {
    active,
    count: active.length,
    summary: active.length
      ? active.map((item) => item.id).join(", ")
      : "no_active_regime"
  };
}

export function buildNodeScoreMap(observations) {
  const map = new Map();
  for (const observation of observations) {
    if (!observation?.node_id || typeof observation.score !== "number") continue;
    const confidence = typeof observation.confidence === "number" ? observation.confidence : 1;
    map.set(observation.node_id, observation.score * confidence);
  }
  return map;
}

export function matchesCondition(actual, condition) {
  if (typeof actual !== "number") return false;

  switch (condition.operator) {
    case ">=":
      return actual >= condition.value;
    case ">":
      return actual > condition.value;
    case "<=":
      return actual <= condition.value;
    case "<":
      return actual < condition.value;
    case "between":
      return actual >= condition.min && actual <= condition.max;
    case "abs>=":
      return Math.abs(actual) >= condition.value;
    default:
      throw new Error(`Unsupported regime condition operator: ${condition.operator}`);
  }
}

