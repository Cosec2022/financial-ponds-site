import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreDir = path.join(rootDir, "src", "core");

test("core code does not hardcode current market entity ids", async () => {
  const files = (await readdir(coreDir))
    .filter((file) => file.endsWith(".mjs"))
    .map((file) => path.join(coreDir, file));

  const forbidden = [
    "us_equity",
    "a_share",
    "btc",
    "gold",
    "semiconductor",
    "hk_equity"
  ];

  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const token of forbidden) {
      assert.equal(
        text.includes(token),
        false,
        `${path.basename(file)} should not hardcode market token ${token}`
      );
    }
  }
});
