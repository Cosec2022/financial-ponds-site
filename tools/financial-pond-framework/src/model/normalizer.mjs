import { clamp } from "../core/transforms.mjs";

export function normalizeSeries(rows, valueColumn, profile) {
  const values = rows
    .map((row) => Number(row[valueColumn]))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return {
      score: 0,
      value: null,
      reason: "No numeric values available."
    };
  }

  const method = profile?.method ?? "passthrough";
  const latest = values.at(-1);

  if (method === "passthrough") {
    return {
      score: clamp(latest, -2, 2),
      value: latest,
      reason: "Latest value treated as an already-normalized score."
    };
  }

  if (method === "level_zscore") {
    const sample = values.slice(-(profile.lookback ?? 252));
    const score = zscore(latest, sample);
    return {
      score: clamp(score, ...(profile.clamp ?? [-2, 2])),
      value: latest,
      reason: "Latest level converted to z-score versus lookback window."
    };
  }

  if (method === "change_zscore") {
    const changes = differences(values).slice(-(profile.lookback ?? 60));
    const latestChange = changes.at(-1) ?? 0;
    const score = zscore(latestChange, changes);
    return {
      score: clamp(score, ...(profile.clamp ?? [-2, 2])),
      value: latest,
      reason: "Latest absolute change converted to z-score versus recent changes."
    };
  }

  if (method === "percent_change_zscore") {
    const changes = percentChanges(values).slice(-(profile.lookback ?? 60));
    const latestChange = changes.at(-1) ?? 0;
    const score = zscore(latestChange, changes);
    return {
      score: clamp(score, ...(profile.clamp ?? [-2, 2])),
      value: latest,
      reason: "Latest percent change converted to z-score versus recent percent changes."
    };
  }

  throw new Error(`Unsupported normalization method: ${method}`);
}

function differences(values) {
  const output = [];
  for (let index = 1; index < values.length; index += 1) {
    output.push(values[index] - values[index - 1]);
  }
  return output;
}

function percentChanges(values) {
  const output = [];
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    if (previous === 0) continue;
    output.push((values[index] - previous) / Math.abs(previous));
  }
  return output;
}

function zscore(value, sample) {
  if (!sample.length) return 0;
  const mean = sample.reduce((sum, item) => sum + item, 0) / sample.length;
  const variance = sample.reduce((sum, item) => sum + Math.pow(item - mean, 2), 0) / sample.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (value - mean) / std;
}
