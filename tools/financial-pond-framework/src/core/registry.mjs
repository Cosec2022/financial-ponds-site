export function buildRegistry(config) {
  const entities = new Map();
  const byKind = {
    node: new Map(),
    pool: new Map(),
    asset: new Map(),
    portfolio: new Map()
  };

  const groups = [
    ["node", config.nodes],
    ["pool", config.pools],
    ["asset", config.assets],
    ["portfolio", config.portfolios]
  ];

  for (const [expectedKind, records] of groups) {
    for (const record of records) {
      if (!record.id) {
        throw new Error(`Missing id in ${expectedKind} config`);
      }
      if (record.kind !== expectedKind) {
        throw new Error(`Entity ${record.id} has kind ${record.kind}, expected ${expectedKind}`);
      }
      if (entities.has(record.id)) {
        throw new Error(`Duplicate entity id: ${record.id}`);
      }
      entities.set(record.id, record);
      byKind[expectedKind].set(record.id, record);
    }
  }

  return {
    entities,
    nodes: byKind.node,
    pools: byKind.pool,
    assets: byKind.asset,
    portfolios: byKind.portfolio,
    get(id) {
      return entities.get(id);
    },
    has(id) {
      return entities.has(id);
    },
    kindOf(id) {
      return entities.get(id)?.kind ?? null;
    },
    childPools(parentId) {
      return [...byKind.pool.values()].filter((pool) => pool.parent_pool === parentId);
    }
  };
}
