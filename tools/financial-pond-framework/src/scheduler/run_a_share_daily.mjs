import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readJsonFile } from "../core/config_loader.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const schedulePath = path.join(rootDir, "config", "schedules", "a_share_daily.json");
const statePath = path.join(rootDir, "scheduler_state", "a_share_daily_state.json");

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

async function runCommand(command) {
  const child = spawn(command, {
    cwd: rootDir,
    shell: true,
    stdio: "inherit",
    env: process.env
  });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Scheduled command failed with exit code ${code}`));
      }
    });
  });
}

async function tick() {
  const schedule = await readJsonFile(schedulePath);
  const now = zonedParts(new Date(), schedule.timezone);
  if (!schedule.run_times.includes(now.time)) return;

  const state = await readState();
  const key = `${now.date}T${now.time}`;
  if (state.runs[key]) return;

  console.log(`A-share daily scheduler starting: ${key} ${schedule.timezone}`);
  state.runs[key] = { status: "running", started_at: new Date().toISOString(), command: schedule.command };
  await writeState(state);

  try {
    await runCommand(schedule.command);
    state.runs[key] = {
      status: "completed",
      started_at: state.runs[key].started_at,
      completed_at: new Date().toISOString(),
      command: schedule.command
    };
    await writeState(state);
    console.log(`A-share daily scheduler completed: ${key}`);
  } catch (error) {
    state.runs[key] = {
      status: "failed",
      started_at: state.runs[key].started_at,
      failed_at: new Date().toISOString(),
      command: schedule.command,
      error: error.message
    };
    await writeState(state);
    console.error(`A-share daily scheduler failed: ${key}`);
    console.error(error);
  }
}

console.log("A-share daily scheduler started.");
console.log(`Schedule config: ${schedulePath}`);
await tick();
setInterval(tick, 30_000);
