import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readJsonFile } from "../core/config_loader.mjs";
import { runCollectionCycle } from "../pipeline/run_cycle.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const schedulePath = path.join(rootDir, "config", "schedules", "twice_daily.json");
const statePath = path.join(rootDir, "scheduler_state", "twice_daily_state.json");

async function readState() {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    return { runs: {} };
  }
}

async function writeState(state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function zonedParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}`
  };
}

async function tick() {
  const schedule = await readJsonFile(schedulePath);
  const now = zonedParts(new Date(), schedule.timezone);
  if (!schedule.run_times.includes(now.time)) return;

  const state = await readState();
  const key = `${now.date}T${now.time}`;
  if (state.runs[key]) return;

  console.log(`Scheduled cycle starting: ${key} ${schedule.timezone}`);
  state.runs[key] = { status: "running", started_at: new Date().toISOString() };
  await writeState(state);

  try {
    const result = await runCollectionCycle({ rootDir, asOf: now.date });
    state.runs[key] = {
      status: "completed",
      started_at: state.runs[key].started_at,
      completed_at: new Date().toISOString(),
      report_path: result.reportPath,
      dashboard_path: result.dashboardPath
    };
    await writeState(state);
    console.log(`Scheduled cycle completed: ${key}`);
  } catch (error) {
    state.runs[key] = {
      status: "failed",
      started_at: state.runs[key].started_at,
      failed_at: new Date().toISOString(),
      error: error.message
    };
    await writeState(state);
    console.error(`Scheduled cycle failed: ${key}`);
    console.error(error);
  }
}

console.log("Twice-daily scheduler started.");
console.log(`Schedule config: ${schedulePath}`);
await tick();
setInterval(tick, 30_000);
