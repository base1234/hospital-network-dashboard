// Simple, explainable propagation model that works with your current asset/link shapes

// Risk contributed by a node itself (0..1)
export function nodeBaseRisk(asset) {
  const cvss = (asset.vuln ?? 0) / 10;       // 0..1
  const unpatched = 1 - (asset.patch ?? 0);  // 0..1
  const statusMul = asset.status === "outage" ? 1.25 : asset.status === "degraded" ? 1.1 : 1.0;
  return Math.max(0, Math.min(1, (0.55 * cvss + 0.45 * unpatched) * statusMul));
}

// Probability to traverse an edge (direction-agnostic here)
function edgePassProb(edge, fromAsset, toAsset, opts) {
  const base = opts.baseEdgeProb; // e.g. 0.45
  const lossMul = edge.loss > 0.5 ? 0.9 : 1.0; // dampen unreliable links
  const toHardening = 0.75 + 0.25 * (1 - (toAsset.patch ?? 0)); // patched nodes resist more
  const zFrom = fromAsset.zone || "";
  const zTo = toAsset.zone || "";
  const zoneMul =
    (zFrom.includes("DMZ") && (zTo.includes("Clinical") || zTo.includes("Admin"))) ? (opts.crossZonePenalty ?? 0.7) :
    (zFrom.includes("External") && zTo.includes("DMZ")) ? (opts.crossZonePenalty ?? 0.7) :
    1.0;

  return Math.max(0, Math.min(1, base * lossMul * zoneMul * toHardening));
}

// Build adjacency
function buildAdj(assets, links) {
  const byId = new Map(assets.map(a => [a.id, a]));
  const g = new Map();
  for (const a of assets) g.set(a.id, []);
  for (const e of links) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    g.get(e.source).push({ edge: e, neighborId: e.target });
    g.get(e.target).push({ edge: e, neighborId: e.source });
  }
  return { byId, g };
}

// BFS with decay; returns Map<assetId, risk 0..1>
export function computePropagation({
  seeds,
  assets,
  links,
  steps = 3,
  baseEdgeProb = 0.45,
  decayPerHop = 0.8,
  crossZonePenalty = 0.7,
}) {
  const { byId, g } = buildAdj(assets, links);
  const risk = new Map();
  const q = [];

  for (const seedId of seeds) {
    const a = byId.get(seedId);
    if (!a) continue;
    const r0 = nodeBaseRisk(a);
    risk.set(seedId, Math.max(risk.get(seedId) || 0, r0));
    q.push({ id: seedId, r: r0, depth: 0 });
  }

  while (q.length) {
    const { id, r, depth } = q.shift();
    if (depth >= steps) continue;
    const from = byId.get(id);
    for (const { edge, neighborId } of g.get(id) || []) {
      const to = byId.get(neighborId);
      if (!to) continue;
      const pEdge = edgePassProb(edge, from, to, { baseEdgeProb, crossZonePenalty });
      const rNext = r * pEdge * decayPerHop;
      if (rNext <= 0.01) continue;
      if (rNext > (risk.get(neighborId) || 0)) {
        risk.set(neighborId, rNext);
        q.push({ id: neighborId, r: rNext, depth: depth + 1 });
      }
    }
  }
  return risk;
}

// Convenience for edge highlighting: edges whose endpoints are “hot”
export function edgesAbove(riskMap, links, threshold = 0.2) {
  const hot = new Set([...riskMap.entries()].filter(([, v]) => v >= threshold).map(([k]) => k));
  return links.filter(e => hot.has(e.source) && hot.has(e.target)).map(e => e.id);
}
