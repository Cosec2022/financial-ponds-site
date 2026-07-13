import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalJson, contentHash } from "./daily-longitudinal-snapshot.mjs";

export async function appendImmutableSnapshot({ rootDir, snapshot, correctionReason = null }) {
  const baseDir = path.join(rootDir, "financial-pond", "data", "history", "daily");
  const dayDir = path.join(baseDir, snapshot.as_of);
  await mkdir(dayDir, { recursive: true });
  const existing = await snapshotsForDate(dayDir);
  const canonicalContentHash = contentHash(withoutMutableFields(snapshot));
  const same = existing.find((item) => item.content_hash === canonicalContentHash);
  if (same) return { record: same, created: false, index: await rebuildDailyIndex({ rootDir }) };
  const prior = existing.at(-1) ?? null;
  const revision = existing.length + 1;
  const snapshotId = `${snapshot.snapshot_id}:r${revision}`;
  const record = {
    ...snapshot,
    snapshot_id: snapshotId,
    revision,
    supersedes_snapshot_id: prior?.snapshot_id ?? null,
    correction_reason: prior ? correctionReason ?? "content_changed" : null,
    provenance: snapshot.provenance ?? "published_at_the_time",
    content_hash: canonicalContentHash,
    checksum: canonicalContentHash
  };
  await writeFile(path.join(dayDir, `${safe(snapshotId)}.json`), `${canonicalJson(record)}\n`);
  await writeFile(path.join(dayDir, "manifest.json"), `${canonicalJson({ schema_version: "daily_longitudinal_manifest_v1", as_of: snapshot.as_of, records: [...existing.map(compact), compact(record)] })}\n`);
  return { record, created: true, index: await rebuildDailyIndex({ rootDir }) };
}

export async function rebuildDailyIndex({ rootDir }) {
  const baseDir = path.join(rootDir, "financial-pond", "data", "history", "daily");
  await mkdir(baseDir, { recursive: true });
  const dates = (await readdir(baseDir, { withFileTypes: true })).filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name)).map((entry) => entry.name).sort();
  const records = [];
  for (const date of dates) records.push(...await snapshotsForDate(path.join(baseDir, date)));
  records.sort((a, b) => a.as_of.localeCompare(b.as_of) || a.revision - b.revision || a.snapshot_id.localeCompare(b.snapshot_id));
  const index = { schema_version: "daily_longitudinal_index_v1", records: records.map(compact), current_by_date: Object.fromEntries(dates.map((date) => [date, compact(records.filter((item) => item.as_of === date).at(-1))])) };
  await writeFile(path.join(baseDir, "index.json"), `${canonicalJson(index)}\n`);
  return index;
}

export async function snapshotsForDate(dayDir) {
  try {
    const entries = await readdir(dayDir, { withFileTypes: true });
    const records = await Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "manifest.json").map(async (entry) => JSON.parse(await readFile(path.join(dayDir, entry.name), "utf8"))));
    return records.sort((a, b) => a.revision - b.revision || a.snapshot_id.localeCompare(b.snapshot_id));
  } catch { return []; }
}

function compact(record) { return { snapshot_id: record.snapshot_id, as_of: record.as_of, revision: record.revision, finality_status: record.finality_status, content_hash: record.content_hash, supersedes_snapshot_id: record.supersedes_snapshot_id, correction_reason: record.correction_reason, row_count: record.row_count, model_version: record.model_version, path: `financial-pond/data/history/daily/${record.as_of}/${safe(record.snapshot_id)}.json` }; }
function withoutMutableFields(snapshot) { const { content_hash, checksum, snapshot_id, revision, supersedes_snapshot_id, correction_reason, generated_at, ...content } = snapshot; return content; }
function safe(id) { return String(id).replace(/[^A-Za-z0-9._-]/g, "_"); }
