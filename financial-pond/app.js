const state = {
  data: null,
  flow: null,
  selectedId: null,
  filter: "all"
};

const majorPoolIds = ["us_equity", "a_share", "btc", "gold"];

const fallbackData = {
  as_of: "not loaded",
  model_version: "unknown",
  entities: {},
  edges: [],
  groups: { nodes: [], pools: [], assets: [], portfolios: [] },
  observations: []
};

async function loadDashboard() {
  try {
    const response = await fetch("./data/dashboard.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Failed to load dashboard.json", error);
    return fallbackData;
  }
}

async function loadFlowReview() {
  try {
    const response = await fetch("./data/sector_flow_review.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Failed to load sector_flow_review.json", error);
    return null;
  }
}

function scoreClass(score) {
  if (typeof score !== "number") return "neutral";
  if (score > 0.15) return "positive";
  if (score < -0.15) return "negative";
  return "neutral";
}

function formatScore(score) {
  return typeof score === "number" ? score.toFixed(2) : "n/a";
}

function scoreColor(score, kind) {
  if (kind === "node") return "#2e5d7c";
  if (kind === "asset") return "#9b7428";
  if (kind === "portfolio") return "#536258";
  if (typeof score !== "number") return "#849083";
  if (score > 0.15) return "#1f7a4d";
  if (score < -0.15) return "#ad3f32";
  return "#657064";
}

function renderHeader() {
  document.getElementById("asOfBadge").textContent = `As of ${state.data.as_of}`;
  document.getElementById("modelVersion").textContent = `model ${state.data.model_version}`;
}

function renderPoolCards() {
  const container = document.getElementById("poolCards");
  container.innerHTML = "";

  const poolIds = majorPoolIds.filter((id) => state.data.entities[id])
    .concat(state.data.groups.pools.filter((id) => !majorPoolIds.includes(id)));

  for (const id of poolIds) {
    const entity = state.data.entities[id];
    const card = document.createElement("button");
    card.className = `pool-card ${state.selectedId === id ? "active" : ""}`;
    card.type = "button";
    card.dataset.id = id;
    card.innerHTML = `
      <div class="pool-card-title">
        <strong>${entity.name ?? id}</strong>
        <span class="score ${scoreClass(entity.score)}">${formatScore(entity.score)}</span>
      </div>
      <div class="score-bar"><div class="score-fill" style="${scoreFillStyle(entity.score)}"></div></div>
      <p class="pool-desc">${entity.pool_type ?? entity.kind}${entity.parent_pool ? ` · parent: ${entity.parent_pool}` : ""}</p>
    `;
    card.addEventListener("click", () => selectEntity(id));
    container.appendChild(card);
  }
}

function scoreFillStyle(score) {
  if (typeof score !== "number") return "width: 50%; background: #849083;";
  const width = Math.max(4, Math.min(100, 50 + score * 25));
  const color = score > 0.15 ? "#1f7a4d" : score < -0.15 ? "#ad3f32" : "#657064";
  return `width: ${width}%; background: ${color};`;
}

function entityVisible(entity) {
  if (state.filter === "all") return true;
  if (state.filter === "pools") return entity.kind === "pool" || entity.kind === "asset" || entity.kind === "portfolio";
  if (state.filter === "nodes") return entity.kind === "node" || entity.kind === "pool";
  return true;
}

function layoutEntities() {
  const entities = state.data.entities;
  const columns = [
    state.data.groups.nodes.filter((id) => entities[id]),
    state.data.groups.pools.filter((id) => entities[id] && !entities[id].parent_pool),
    state.data.groups.pools.filter((id) => entities[id]?.parent_pool),
    state.data.groups.assets.concat(state.data.groups.portfolios).filter((id) => entities[id])
  ];

  const positions = new Map();
  const width = 920;
  const height = 560;
  const xSlots = [120, 360, 590, 790];

  columns.forEach((ids, columnIndex) => {
    const visibleIds = ids.filter((id) => entityVisible(entities[id]));
    const gap = height / (visibleIds.length + 1 || 2);
    visibleIds.forEach((id, rowIndex) => {
      positions.set(id, {
        x: xSlots[columnIndex],
        y: gap * (rowIndex + 1)
      });
    });
  });

  return { positions, width, height };
}

function renderGraph() {
  const svg = document.getElementById("graphSvg");
  svg.innerHTML = "";

  const { positions, width, height } = layoutEntities();
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#a9b3a5"></path>
    </marker>
    <marker id="arrowActive" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#1f7a4d"></path>
    </marker>
  `;
  svg.appendChild(defs);

  for (const edge of state.data.edges) {
    if (!positions.has(edge.from) || !positions.has(edge.to)) continue;
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    const active = state.selectedId && (edge.from === state.selectedId || edge.to === state.selectedId);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const mid = Math.max(40, Math.abs(to.x - from.x) * 0.45);
    path.setAttribute("d", `M ${from.x} ${from.y} C ${from.x + mid} ${from.y}, ${to.x - mid} ${to.y}, ${to.x} ${to.y}`);
    path.setAttribute("fill", "none");
    path.setAttribute("class", `edge ${active ? "active" : ""}`);
    path.setAttribute("marker-end", active ? "url(#arrowActive)" : "url(#arrow)");
    svg.appendChild(path);
  }

  for (const [id, position] of positions.entries()) {
    const entity = state.data.entities[id];
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.addEventListener("click", () => selectEntity(id));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectEntity(id);
    });

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", position.x);
    circle.setAttribute("cy", position.y);
    circle.setAttribute("r", state.selectedId === id ? 20 : entity.kind === "pool" ? 18 : 14);
    circle.setAttribute("fill", scoreColor(entity.score, entity.kind));
    circle.setAttribute("class", "node-circle");
    group.appendChild(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", position.x);
    label.setAttribute("y", position.y + 34);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "node-label");
    label.textContent = shortName(entity.name ?? id);
    group.appendChild(label);

    const score = document.createElementNS("http://www.w3.org/2000/svg", "text");
    score.setAttribute("x", position.x);
    score.setAttribute("y", position.y + 4);
    score.setAttribute("text-anchor", "middle");
    score.setAttribute("fill", "#fff");
    score.setAttribute("font-size", "10");
    score.setAttribute("font-weight", "800");
    score.textContent = typeof entity.score === "number" ? entity.score.toFixed(1) : "";
    group.appendChild(score);

    svg.appendChild(group);
  }
}

function shortName(name) {
  return name
    .replace(" Pool", "")
    .replace("A-share", "A")
    .replace("Bitcoin", "BTC")
    .replace("Default User Portfolio", "Portfolio");
}

function renderDetails() {
  const details = document.getElementById("details");
  const kind = document.getElementById("entityKind");
  const entity = state.data.entities[state.selectedId];

  if (!entity) {
    kind.textContent = "None";
    kind.className = "badge muted-badge";
    details.className = "details-empty";
    details.textContent = "Select a pool or node to inspect score drivers.";
    return;
  }

  kind.textContent = entity.kind;
  kind.className = "badge";
  details.className = "";

  const incoming = state.data.edges.filter((edge) => edge.to === entity.id);
  const outgoing = state.data.edges.filter((edge) => edge.from === entity.id);
  const drivers = (entity.contributors ?? []).slice(0, 6);

  details.innerHTML = `
    <div>
      <h3>${entity.name ?? entity.id}</h3>
      <div class="score ${scoreClass(entity.score)}">${formatScore(entity.score)}</div>
      <p class="details-text">${entity.description ?? "No description provided."}</p>
    </div>
    <div class="detail-block">
      <h3>Top Drivers</h3>
      <div class="driver-list">
        ${drivers.length ? drivers.map(driverTemplate).join("") : "<p class=\"details-text\">No active contributors yet.</p>"}
      </div>
    </div>
    <div class="detail-block">
      <h3>Connections</h3>
      <p class="details-text">${incoming.length} incoming · ${outgoing.length} outgoing</p>
    </div>
    <div class="detail-block">
      <h3>Explanation</h3>
      <p class="details-text">${entity.explanation ?? "No explanation available."}</p>
    </div>
  `;
}

function driverTemplate(driver) {
  const cls = driver.contribution > 0.01 ? "positive" : driver.contribution < -0.01 ? "negative" : "neutral";
  return `
    <div class="driver">
      <div class="driver-main">
        <span>${driver.from}</span>
        <span class="score ${cls}">${driver.contribution.toFixed(2)}</span>
      </div>
      <div class="driver-channel">${driver.channel} · weight ${driver.weight}</div>
    </div>
  `;
}

function renderEdges() {
  const body = document.getElementById("edgeTable");
  body.innerHTML = state.data.edges.map((edge) => `
    <tr>
      <td>${edge.from}</td>
      <td>${edge.to}</td>
      <td>${edge.channel}</td>
      <td>${edge.weight}</td>
      <td>${edge.transform ?? "identity"}</td>
    </tr>
  `).join("");
}

function renderFlowReview() {
  const container = document.getElementById("flowReview");
  if (!container) return;
  const rows = state.flow?.sector_reviews ?? state.flow?.reviews ?? [];
  if (!rows.length) {
    container.className = "flow-review flow-empty";
    container.textContent = "No sector flow review data is available yet.";
    return;
  }

  const sorted = [...rows].sort((a, b) => (b.flow_score ?? b.score ?? 0) - (a.flow_score ?? a.score ?? 0));
  container.className = "flow-review";
  container.innerHTML = sorted.map((row, index) => {
    const score = row.flow_score ?? row.score ?? 0;
    const sector = row.pool_id ?? row.sector_id ?? row.id ?? "unknown";
    const confidence = row.confidence ?? row.data_confidence ?? null;
    const direction = row.flow_direction ?? row.direction ?? "review";
    const drivers = (row.top_drivers ?? row.driving_factors ?? row.drivers ?? []).slice(0, 3);
    return `
      <button class="flow-row" type="button" data-sector="${sector}">
        <span class="flow-rank">${index + 1}</span>
        <span class="flow-sector">${sector}</span>
        <span class="score ${scoreClass(score)}">${formatScore(score)}</span>
        <span class="flow-meta">${row.label ?? direction}${confidence === null ? "" : ` · conf ${formatScore(confidence)}`}</span>
        <span class="flow-drivers">${drivers.map((driver) => driver.component ?? driver.factor ?? driver.node_id ?? driver.id ?? driver).join(" · ")}</span>
      </button>
    `;
  }).join("");

  container.querySelectorAll(".flow-row").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.data.entities[button.dataset.sector]) selectEntity(button.dataset.sector);
    });
  });
}

function selectEntity(id) {
  state.selectedId = id;
  renderPoolCards();
  renderGraph();
  renderDetails();
}

function bindControls() {
  document.getElementById("resetView").addEventListener("click", () => {
    state.selectedId = null;
    state.filter = "all";
    document.querySelectorAll(".segment").forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === "all");
    });
    renderAll();
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll(".segment").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      renderGraph();
    });
  });
}

function renderAll() {
  renderHeader();
  renderPoolCards();
  renderGraph();
  renderDetails();
  renderFlowReview();
  renderEdges();
}

state.data = await loadDashboard();
state.flow = await loadFlowReview();
bindControls();
renderAll();
