import { spawn } from "node:child_process";

const asOf = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Hong_Kong",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

for (const [command, args] of [
  ["node", ["scripts/fp/run-daily.mjs", "--mode", "live", "--as-of", asOf]],
  ["npm", ["run", "build:site"]],
  ["npm", ["run", "validate"]],
  ["npm", ["run", "validate:data"]],
  ["npm", ["test"]]
]) await run(command, args);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`)));
  });
}
