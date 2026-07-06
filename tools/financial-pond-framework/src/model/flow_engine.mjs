import { clamp } from "../core/transforms.mjs";

export function evaluateSectorFlows({
  observations,
  sectorCatalog,
  flowConfig,
  flexibleRiskFactors,
  scenario = null
}) {
  const observationMap = buildObservationMap(observations);
  const factorEffects = buildFactorEffectsByPool({
    flexibleRiskFactors,
    scenario
  });
  const sectors = sectorCatalog.sectors ?? [];
  const parentPool = sectorCatalog.parent_pool ?? "a_share";
  const poolPrefix = sectorCatalog.pool_prefix ?? parentPool;

  const sector_reviews = sectors.map((sector) => {
    const poolId = `${poolPrefix}_${sector.id}`;
    const components = buildSectorComponents({
      sector,
      poolId,
      observationMap,
      factorEffects,
      flowConfig
    });
    const weighted = weightedScore({
      components,
      weights: flowConfig.component_weights ?? {}
    });
    const confidence = scoreConfidence(components);
    const score = clamp(weighted.score, -1, 1);

    return {
      sector_id: sector.id,
      pool_id: poolId,
      name: sector.name,
      display_name: sector.display_name,
      coverage_status: sector.coverage_status ?? "framework_only",
      classification: sector.classification ?? null,
      score,
      label: labelForScore(score, flowConfig.labels ?? []),
      confidence,
      data_completeness: weighted.data_completeness,
      components,
      top_drivers: topDrivers(components, flowConfig.component_weights ?? {})
    };
  }).sort((a, b) => b.score - a.score);

  return {
    model_id: flowConfig.id,
    scenario_id: scenario?.id ?? null,
    counts: {
      sectors: sector_reviews.length,
      provider_mapped_representative_sectors: sectors.filter((sector) => sector.coverage_status === "provider_mapped_representative").length,
      framework_only_sectors: sectors.filter((sector) => sector.coverage_status === "framework_only").length,
      factor_signals: scenario?.signals?.length ?? 0
    },
    sector_reviews,
    summary: summarizeSectors(sector_reviews)
  };
}

export function observationsFromMockScores({ mockScores, asOf }) {
  return Object.entries(mockScores.scores ?? {}).map(([nodeId, score]) => ({
    node_id: nodeId,
    as_of: asOf ?? mockScores.as_of,
    score,
    confidence: 1,
    data_type: "mock",
    source: "config/mock_scores"
  }));
}

function buildObservationMap(observations) {
  const map = new Map();
  for (const observation of observations ?? []) {
    if (!observation?.node_id) continue;
    const score = typeof observation.score === "number" ? observation.score : 0;
    const confidence = typeof observation.confidence === "number" ? observation.confidence : 0;
    map.set(observation.node_id, {
      score: score * confidence,
      raw_score: score,
      confidence,
      source: observation.source ?? "unknown",
      reason: observation.reason ?? ""
    });
  }
  return map;
}

function buildFactorEffectsByPool({ flexibleRiskFactors, scenario }) {
  const strengthScale = flexibleRiskFactors.strength_scale ?? {};
  const factorById = new Map((flexibleRiskFactors.factors ?? []).map((factor) => [factor.id, factor]));
  const effects = new Map();

  for (const signal of scenario?.signals ?? []) {
    const factor = factorById.get(signal.factor_id);
    if (!factor) continue;
    const score = typeof signal.score === "number" ? signal.score : 0;
    const confidence = typeof signal.confidence === "number" ? signal.confidence : 0;

    for (const impact of factor.pool_impacts ?? []) {
      const strength = strengthScale[impact.strength] ?? 0;
      const multiplier = typeof impact.multiplier === "number" ? impact.multiplier : 1;
      const contribution = score * confidence * strength * multiplier;
      const current = effects.get(impact.pool_id) ?? {
        score: 0,
        confidence_sum: 0,
        contributors: []
      };
      current.score += contribution;
      current.confidence_sum += confidence;
      current.contributors.push({
        factor_id: signal.factor_id,
        factor_name: factor.name,
        score,
        confidence,
        strength: impact.strength,
        multiplier,
        contribution,
        reason: signal.reason ?? ""
      });
      effects.set(impact.pool_id, current);
    }
  }

  for (const effect of effects.values()) {
    effect.score = clamp(effect.score, -1, 1);
    effect.confidence = effect.contributors.length === 0
      ? 0
      : Math.min(1, effect.confidence_sum / effect.contributors.length);
    delete effect.confidence_sum;
  }

  return effects;
}

function buildSectorComponents({ sector, poolId, observationMap, factorEffects, flowConfig }) {
  const suffixes = flowConfig.sector_node_suffixes ?? {};
  const commonNodes = flowConfig.common_nodes ?? {};
  const sectorValue = (componentId) => {
    const nodeIds = (suffixes[componentId] ?? []).map((suffix) => `${sector.id}_${suffix}`);
    return averageNodes(nodeIds, observationMap);
  };

  const marketConfirmation = averageComponents([
    sectorValue("market_confirmation")
  ]);
  const policySentiment = averageComponents([
    sectorValue("policy_sentiment"),
    averageNodes(commonNodes.policy_sentiment ?? [], observationMap)
  ]);
  const externalEffect = factorEffects.get(poolId) ?? {
    score: 0,
    confidence: 0,
    contributors: []
  };

  return {
    direct_flow: sectorValue("direct_flow"),
    market_confirmation: marketConfirmation,
    market_liquidity: averageNodes(commonNodes.market_liquidity ?? [], observationMap),
    policy_sentiment: policySentiment,
    fundamental_proxy: sectorValue("fundamental_proxy"),
    external_factor_effect: {
      score: externalEffect.score,
      confidence: externalEffect.confidence,
      available: externalEffect.contributors.length > 0,
      nodes: [],
      factor_contributors: externalEffect.contributors
    }
  };
}

function averageNodes(nodeIds, observationMap) {
  const available = [];
  for (const nodeId of nodeIds) {
    const record = observationMap.get(nodeId);
    if (!record) continue;
    available.push({
      node_id: nodeId,
      score: record.score,
      confidence: record.confidence,
      source: record.source
    });
  }

  if (available.length === 0) {
    return {
      score: 0,
      confidence: 0,
      available: false,
      nodes: nodeIds
    };
  }

  return {
    score: available.reduce((sum, item) => sum + item.score, 0) / available.length,
    confidence: available.reduce((sum, item) => sum + item.confidence, 0) / available.length,
    available: true,
    nodes: available
  };
}

function averageComponents(components) {
  const available = components.filter((component) => component.available);
  if (available.length === 0) {
    return {
      score: 0,
      confidence: 0,
      available: false,
      nodes: components.flatMap((component) => component.nodes ?? [])
    };
  }

  return {
    score: available.reduce((sum, item) => sum + item.score, 0) / available.length,
    confidence: available.reduce((sum, item) => sum + item.confidence, 0) / available.length,
    available: true,
    nodes: available.flatMap((component) => component.nodes ?? [])
  };
}

function weightedScore({ components, weights }) {
  let numerator = 0;
  let denominator = 0;
  let availableWeight = 0;
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + Math.abs(weight), 0);

  for (const [componentId, weight] of Object.entries(weights)) {
    const component = components[componentId];
    if (!component) continue;
    denominator += Math.abs(weight);
    if (!component.available) continue;
    numerator += component.score * weight;
    availableWeight += Math.abs(weight);
  }

  return {
    score: denominator === 0 ? 0 : numerator / denominator,
    data_completeness: totalWeight === 0 ? 0 : availableWeight / totalWeight
  };
}

function scoreConfidence(components) {
  const available = Object.values(components).filter((component) => component.available);
  if (available.length === 0) return 0;
  const averageConfidence = available.reduce((sum, item) => sum + item.confidence, 0) / available.length;
  const completeness = available.length / Object.keys(components).length;
  return Number(clamp(averageConfidence * completeness, 0, 1).toFixed(4));
}

function labelForScore(score, labels) {
  const sorted = [...labels].sort((a, b) => b.min_score - a.min_score);
  return sorted.find((label) => score >= label.min_score)?.id ?? "unclassified";
}

function topDrivers(components, weights) {
  return Object.entries(components)
    .map(([componentId, component]) => ({
      component: componentId,
      score: component.score,
      confidence: component.confidence,
      weight: weights[componentId] ?? 0,
      contribution: component.available ? component.score * (weights[componentId] ?? 0) : 0,
      available: component.available
    }))
    .filter((item) => item.available)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 4);
}

function summarizeSectors(sectorReviews) {
  return {
    top_positive: sectorReviews.slice(0, 3).map((item) => ({
      pool_id: item.pool_id,
      score: item.score,
      label: item.label
    })),
    top_negative: [...sectorReviews].reverse().slice(0, 3).map((item) => ({
      pool_id: item.pool_id,
      score: item.score,
      label: item.label
    }))
  };
}
