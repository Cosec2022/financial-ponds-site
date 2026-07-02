import { AiAnalyzerContract } from "../contracts/ai_analyzer_contract.mjs";

export class NoopAiAnalyzer extends AiAnalyzerContract {
  constructor() {
    super({
      id: "noop_ai_analyzer",
      description: "Placeholder AI analyzer. Real Codex API integration should implement this contract."
    });
  }

  async analyze({ observations, scoredGraph }) {
    return {
      analyzer_id: this.id,
      summary: "No AI analysis configured. Report uses structured observations and graph contributors only.",
      event_notes: [],
      observation_count: observations.length,
      scored_entity_count: scoredGraph.results.size
    };
  }
}
