import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const workerPath = resolve(import.meta.dirname, "..", "dist", "server", "index.js");
const workerModule = await import(pathToFileURL(workerPath));

assert.equal(typeof workerModule.default?.fetch, "function", "dist/server/index.js must export default.fetch");
console.log("Artifact is valid ESM and exports default.fetch");
