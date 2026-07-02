export function generateMarkdownReport({ asOf, observations, scoredGraph, aiAnalysis, entityIds }) {
  const lines = [];
  lines.push(`# Daily Financial Pond Report`);
  lines.push("");
  lines.push(`Date: ${asOf}`);
  lines.push("");
  lines.push(`AI analysis: ${aiAnalysis.summary}`);
  lines.push("");
  lines.push(`Observations: ${observations.length}`);
  lines.push("");
  lines.push(`## Pool Scores`);
  lines.push("");
  lines.push(`| Entity | Score | Top Drivers |`);
  lines.push(`|---|---:|---|`);

  for (const id of entityIds) {
    const result = scoredGraph.results.get(id);
    if (!result) continue;

    const topDrivers = result.contributors
      .slice(0, 3)
      .map((item) => `${item.from} (${item.channel}: ${item.contribution.toFixed(2)})`)
      .join("; ");
    const score = typeof result.score === "number" ? result.score.toFixed(2) : "n/a";
    lines.push(`| ${id} | ${score} | ${topDrivers || "No active inputs"} |`);
  }

  lines.push("");
  lines.push(`## Explanations`);
  lines.push("");
  for (const id of entityIds) {
    const explanation = scoredGraph.explanations.get(id);
    if (explanation) lines.push(`- ${explanation}`);
  }

  lines.push("");
  lines.push(`## Audit Notes`);
  lines.push("");
  lines.push(`- This report is generated from normalized node observations.`);
  lines.push(`- AI does not directly set final pool scores.`);
  lines.push(`- Financial relationships are defined in config edges, not core code.`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}
