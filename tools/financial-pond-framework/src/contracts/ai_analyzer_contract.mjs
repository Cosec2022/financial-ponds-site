export class AiAnalyzerContract {
  constructor({ id, description }) {
    this.id = id;
    this.description = description;
  }

  async analyze() {
    throw new Error("AI analyzer must implement analyze({ asOf, observations, scoredGraph })");
  }
}
