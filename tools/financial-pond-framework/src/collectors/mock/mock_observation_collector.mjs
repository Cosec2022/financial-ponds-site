import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJsonFile } from "../../core/config_loader.mjs";
import { CollectorContract } from "../../contracts/collector_contract.mjs";

export class MockObservationCollector extends CollectorContract {
  constructor(rootDir) {
    super({
      id: "mock_observation_collector",
      description: "Loads dated mock scores and converts them to normalized node observations."
    });
    this.rootDir = rootDir;
  }

  async collect({ asOf, registry }) {
    const mockPath = await findMockPath(this.rootDir, asOf);
    const mock = await readJsonFile(mockPath);
    const mockRef = path.relative(this.rootDir, mockPath);
    return Object.entries(mock.scores).map(([nodeId, score]) => {
      const node = registry.nodes.get(nodeId);
      return {
        node_id: nodeId,
        as_of: asOf,
        value: score,
        unit: "normalized_score",
        score,
        confidence: 1,
        data_type: node?.data_type ?? "unknown",
        source: this.id,
        raw_ref: mockRef,
        reason: `Mock observation for ${node?.name ?? nodeId}. Source mock date: ${mock.as_of}.`
      };
    });
  }
}

async function findMockPath(rootDir, asOf) {
  const dir = path.join(rootDir, "config", "mock_scores");
  const exactPath = path.join(dir, `${asOf}.json`);
  try {
    await readJsonFile(exactPath);
    return exactPath;
  } catch {
    const files = (await readdir(dir))
      .filter((file) => file.endsWith(".json"))
      .sort();
    if (!files.length) throw new Error("No mock score files found");
    return path.join(dir, files.at(-1));
  }
}
