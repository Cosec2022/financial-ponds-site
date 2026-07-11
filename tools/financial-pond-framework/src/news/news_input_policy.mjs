export const NARRATIVE_DISPLAY_ONLY = "narrative_display_only";
export const VERIFIED_FACT_CHANNEL = "verified_fact_channel";

export function normalizeNewsInputPolicy(value) {
  const mode = value?.news_input_mode;
  return {
    schema_version: value?.schema_version ?? "news_input_policy_v1",
    news_input_mode: mode === VERIFIED_FACT_CHANNEL ? VERIFIED_FACT_CHANNEL : NARRATIVE_DISPLAY_ONLY
  };
}

export function narrativeMayEnterGraph() {
  return false;
}

export function verifiedFactMayEnterGraph(policy, observation) {
  const normalized = normalizeNewsInputPolicy(policy);
  return normalized.news_input_mode === VERIFIED_FACT_CHANNEL
    && observation?.source === "verified_fact_channel"
    && ["official_machine_verified", "human_verified"].includes(observation?.verification_status);
}
