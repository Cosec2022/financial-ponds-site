export function applyTransform(value, transform = "identity", edge = {}) {
  if (typeof value !== "number") return null;

  switch (transform) {
    case "identity":
      return value;
    case "inverse":
      return -value;
    case "half_life_decay": {
      const ageDays = edge.age_days ?? 0;
      const halfLife = edge.half_life_days ?? 7;
      const decay = Math.pow(0.5, ageDays / halfLife);
      return value * decay;
    }
    default:
      throw new Error(`Unsupported transform: ${transform}`);
  }
}

export function clamp(value, min = -2, max = 2) {
  return Math.max(min, Math.min(max, value));
}
