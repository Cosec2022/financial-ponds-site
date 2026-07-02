import { applyTransform, clamp } from "./transforms.mjs";
import { topologicalEntities } from "./graph_engine.mjs";

export function calculateScores({ registry, graph, inputScores, scoringConfig }) {
  const results = new Map();
  const explanations = new Map();

  for (const [id, value] of Object.entries(inputScores)) {
    if (!registry.has(id)) continue;
    results.set(id, {
      id,
      kind: registry.kindOf(id),
      score: value,
      confidence: 1,
      contributors: []
    });
  }

  const pending = new Set(topologicalEntities(registry).filter((id) => registry.kindOf(id) !== "node"));

  while (pending.size > 0) {
    let progressed = false;

    for (const id of [...pending]) {
      if (!dependenciesReady(id, graph, results, pending)) continue;
      scoreEntity({ id, registry, graph, results, explanations, scoringConfig });
      pending.delete(id);
      progressed = true;
    }

    if (!progressed) {
      const unresolved = [...pending].join(", ");
      throw new Error(
        `Cannot resolve graph scoring order. Check for circular pool/asset/portfolio edges or missing node scores: ${unresolved}`
      );
    }
  }

  return {
    results,
    explanations
  };
}

function dependenciesReady(id, graph, results, pending) {
  for (const edge of graph.incoming(id)) {
    if (results.has(edge.from)) continue;
    if (!pending.has(edge.from)) continue;
    return false;
  }
  return true;
}

function scoreEntity({ id, registry, graph, results, explanations, scoringConfig }) {
  const incoming = graph.incoming(id);
  const contributions = [];

  for (const edge of incoming) {
    const source = results.get(edge.from);
    if (!source) continue;

    const transformed = applyTransform(source.score, edge.transform, edge);
    if (transformed === null) continue;

    const weighted = transformed * edge.weight;
    contributions.push({
      edge_id: edge.id,
      from: edge.from,
      to: edge.to,
      channel: edge.channel,
      source_score: source.score,
      transformed_score: transformed,
      weight: edge.weight,
      contribution: weighted,
      description: edge.description
    });
  }

  const totalWeight = contributions.reduce((sum, item) => sum + Math.abs(item.weight), 0);
  const rawScore = totalWeight === 0
    ? null
    : contributions.reduce((sum, item) => sum + item.contribution, 0) / totalWeight;

  const profileId = registry.get(id).scoring_profile
    ?? defaultProfileForKind(registry.kindOf(id));
  const profile = scoringConfig.profiles[profileId];
  const [min, max] = profile?.clamp ?? [-2, 2];
  const score = rawScore === null ? null : clamp(rawScore, min, max);

  results.set(id, {
    id,
    kind: registry.kindOf(id),
    score,
    confidence: rawScore === null ? 0 : 1,
    contributors: contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  });

  explanations.set(id, buildExplanation(registry.get(id), results.get(id)));
}

function defaultProfileForKind(kind) {
  if (kind === "asset") return "default_asset_v0_1";
  if (kind === "portfolio") return "default_portfolio_v0_1";
  return "default_pool_v0_1";
}

function buildExplanation(entity, result) {
  if (result.score === null) {
    return `${entity.name}: no active incoming data yet.`;
  }

  const top = result.contributors.slice(0, 3);
  const reasons = top.map((item) => `${item.from} via ${item.channel}: ${item.contribution.toFixed(2)}`);
  return `${entity.name}: score ${result.score.toFixed(2)}. Top contributors: ${reasons.join("; ") || "none"}.`;
}
