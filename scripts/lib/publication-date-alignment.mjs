export function validatePenetrationDateAlignment({ brief, manifest, observationPointer }) {
  if (!brief?.as_of) throw new Error("Market penetration as_of is required");

  if (brief.schema_version === "market-penetration-v1") {
    if (!manifest?.as_of) throw new Error("Official daily manifest as_of is required");
    if (brief.as_of !== manifest.as_of) {
      throw new Error(`official market penetration ${brief.as_of} does not match daily manifest ${manifest.as_of}`);
    }
    if (manifest.artifacts?.market_penetration !== "market_penetration_brief.json") {
      throw new Error("Daily manifest does not declare the official market penetration artifact");
    }
    return { source_of_truth: "daily_manifest", as_of: manifest.as_of };
  }

  if (!observationPointer?.latest_as_of) throw new Error("Legacy observation pointer latest_as_of is required");
  if (brief.as_of !== observationPointer.latest_as_of) {
    throw new Error(`legacy market penetration ${brief.as_of} does not match latest observation ${observationPointer.latest_as_of}`);
  }
  return { source_of_truth: "latest_observation_pointer", as_of: observationPointer.latest_as_of };
}
