export function buildLayerSummary({ observations, nodeLayers }) {
  const nodeToLayer = new Map();
  for (const [layerId, layer] of Object.entries(nodeLayers.layers ?? {})) {
    for (const nodeId of layer.nodes ?? []) {
      nodeToLayer.set(nodeId, {
        id: layerId,
        description: layer.description
      });
    }
  }

  const summary = {};
  for (const observation of observations) {
    const layer = nodeToLayer.get(observation.node_id) ?? {
      id: "unclassified",
      description: "Node has not been assigned to a model layer yet."
    };

    if (!summary[layer.id]) {
      summary[layer.id] = {
        id: layer.id,
        description: layer.description,
        count: 0,
        score_sum: 0,
        average_score: 0,
        nodes: []
      };
    }

    summary[layer.id].count += 1;
    summary[layer.id].score_sum += observation.score * observation.confidence;
    summary[layer.id].nodes.push(observation.node_id);
  }

  for (const layer of Object.values(summary)) {
    layer.average_score = layer.count === 0 ? 0 : layer.score_sum / layer.count;
    delete layer.score_sum;
  }

  return summary;
}
