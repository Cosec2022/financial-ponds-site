const VALID_KINDS = new Set(["node", "pool", "asset", "portfolio"]);
const VALID_TRANSFORMS = new Set(["identity", "inverse", "half_life_decay"]);

export function validateConfig(config, registry) {
  const errors = [];

  for (const entity of registry.entities.values()) {
    if (!VALID_KINDS.has(entity.kind)) {
      errors.push(`Entity ${entity.id} has invalid kind ${entity.kind}`);
    }
  }

  for (const pool of registry.pools.values()) {
    if (pool.parent_pool && !registry.pools.has(pool.parent_pool)) {
      errors.push(`Pool ${pool.id} references missing parent_pool ${pool.parent_pool}`);
    }
  }

  const edgeIds = new Set();
  for (const edge of config.edges) {
    if (!edge.id) errors.push("Edge missing id");
    if (edgeIds.has(edge.id)) errors.push(`Duplicate edge id: ${edge.id}`);
    edgeIds.add(edge.id);

    if (!registry.has(edge.from)) errors.push(`Edge ${edge.id} has missing from entity ${edge.from}`);
    if (!registry.has(edge.to)) errors.push(`Edge ${edge.id} has missing to entity ${edge.to}`);
    if (typeof edge.weight !== "number") errors.push(`Edge ${edge.id} weight must be numeric`);
    if (!VALID_TRANSFORMS.has(edge.transform ?? "identity")) {
      errors.push(`Edge ${edge.id} has unsupported transform ${edge.transform}`);
    }
  }

  if (errors.length) {
    throw new Error(`Config validation failed:\n- ${errors.join("\n- ")}`);
  }

  return true;
}
