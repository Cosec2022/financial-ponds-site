import test from "node:test";
import assert from "node:assert/strict";
import worker from "../dist/server/index.js";

const request = (path) => new Request(`https://financial-ponds.coseclab.dev${path}`);

test("serves the Financial Ponds clickable pond map at the site root", async () => {
  const response = await worker.fetch(request("/"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /Financial Ponds/);
  assert.match(html, /资金池塘图谱/);
  assert.match(html, /流入流出算法/);
  assert.match(html, /节点反馈 \/ 修改/);
});

test("serves dashboard, sector review, news review, and pond map JSON", async () => {
  const dashboard = await worker.fetch(request("/data/dashboard.json"), {});
  assert.equal(dashboard.status, 200);
  assert.ok((await dashboard.json()).entities);

  const review = await worker.fetch(request("/data/sector_flow_review.json"), {});
  assert.equal(review.status, 200);
  assert.ok((await review.json()).sector_reviews);

  const news = await worker.fetch(request("/data/news_review.json"), {});
  assert.equal(news.status, 200);
  assert.ok((await news.json()).interpretation_boundary);

  const pondMap = await worker.fetch(request("/data/pond_map.json"), {});
  assert.equal(pondMap.status, 200);
  const pondMapJson = await pondMap.json();
  assert.ok(pondMapJson.ponds.find((pond) => pond.id === "electric_power"));
  assert.ok(pondMapJson.keyword_groups.find((group) => group.pond_id === "electric_power"));
  assert.equal(pondMapJson.schema_version, "pond_map_v2_adaptive_graph");
  assert.ok(pondMapJson.graph_adaptation.pond_proposals.electric_power.length >= 2);
});
