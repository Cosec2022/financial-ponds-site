import test from "node:test";
import assert from "node:assert/strict";
import worker from "../dist/server/index.js";

const request = (path) => new Request(`https://financial-ponds.coseclab.dev${path}`);

test("serves the Financial Ponds app at the site root", async () => {
  const response = await worker.fetch(request("/"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(await response.text(), /Financial Pond/);
});

test("serves dashboard and sector review JSON", async () => {
  const dashboard = await worker.fetch(request("/data/dashboard.json"), {});
  assert.equal(dashboard.status, 200);
  assert.ok((await dashboard.json()).entities);

  const review = await worker.fetch(request("/data/sector_flow_review.json"), {});
  assert.equal(review.status, 200);
  assert.ok((await review.json()).sector_reviews);
});
