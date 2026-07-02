export function buildGraph(edges) {
  const incoming = new Map();
  const outgoing = new Map();

  for (const edge of edges) {
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    incoming.get(edge.to).push(edge);
    outgoing.get(edge.from).push(edge);
  }

  return {
    edges,
    incoming(id) {
      return incoming.get(id) ?? [];
    },
    outgoing(id) {
      return outgoing.get(id) ?? [];
    }
  };
}

export function topologicalEntities(registry) {
  // Deterministic registry order only. The scoring engine resolves dependency
  // readiness from graph edges, so financial correctness must not depend on
  // filenames or on a hardcoded market hierarchy.
  return [
    ...registry.nodes.keys(),
    ...registry.pools.keys(),
    ...registry.assets.keys(),
    ...registry.portfolios.keys()
  ];
}
