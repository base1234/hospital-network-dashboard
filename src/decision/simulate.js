// ===============================
// File: src/decision/simulate.js
// ===============================
function buildAdj(nodes, edges, skipId = null) {
  const ok = new Set(nodes.map(n => n.id).filter(id => id !== skipId));
  const adj = new Map([...ok].map(id => [id, new Set()]));
  for (const e of edges) {
    const a = String(e.source), b = String(e.target);
    if (a === skipId || b === skipId) continue;
    if (ok.has(a) && ok.has(b)) {
      adj.get(a).add(b); adj.get(b).add(a);
    }
  }
  return adj;
}

export function articulationPoints(nodes, edges) {
  const adj = buildAdj(nodes, edges);
  let time = 0;
  const disc = new Map(), low = new Map(), parent = new Map(), ap = new Set();

  function dfs(u) {
    disc.set(u, ++time); low.set(u, disc.get(u));
    let child = 0;
    for (const v of adj.get(u)) {
      if (!disc.has(v)) {
        parent.set(v, u); child++; dfs(v);
        low.set(u, Math.min(low.get(u), low.get(v)));
        if ((!parent.has(u) && child > 1) || (parent.has(u) && low.get(v) >= disc.get(u))) ap.add(u);
      } else if (v !== parent.get(u)) {
        low.set(u, Math.min(low.get(u), disc.get(v)));
      }
    }
  }
  for (const id of adj.keys()) if (!disc.has(id)) dfs(id);
  return ap;
}

function components(nodes, edges, skipId = null) {
  const adj = buildAdj(nodes, edges, skipId);
  const seen = new Set(), comps = [];
  for (const id of adj.keys()) {
    if (seen.has(id)) continue;
    const q = [id], comp = [];
    seen.add(id);
    while (q.length) {
      const u = q.shift(); comp.push(u);
      for (const v of adj.get(u)) if (!seen.has(v)) { seen.add(v); q.push(v); }
    }
    comps.push(comp);
  }
  return comps;
}

function reachableZonePairs(nodes, edges, skipId = null) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const comps = components(nodes, edges, skipId);
  const pairs = new Set();
  const key = (a,b)=>a<=b?`${a}|${b}`:`${b}|${a}`;
  for (const comp of comps) {
    const zones = [...new Set(comp.map(id => byId.get(id)?.zone).filter(Boolean))];
    for (let i=0;i<zones.length;i++) for (let j=i+1;j<zones.length;j++) pairs.add(key(zones[i], zones[j]));
  }
  return pairs;
}

export function offlineImpact(nodes, edges, removeId) {
  if (!removeId) return { isSpof:false, disconnected:[], lostZoneBridges:0, cutEdges:0 };
  const before = reachableZonePairs(nodes, edges, null);
  const after  = reachableZonePairs(nodes, edges, removeId);
  const lost   = [...before].filter(k => !after.has(k));
  const cutEdges = edges.filter(e => e.source === removeId || e.target === removeId).length;

  const compsAfter = components(nodes, edges, removeId);
  const largest = compsAfter.reduce((m,c)=>c.length>m.length?c:m, []);
  const allIds = new Set(nodes.map(n=>n.id));
  const still = new Set(largest);
  const disconnected = [...allIds].filter(id => id !== removeId && !still.has(id));

  const ap = articulationPoints(nodes, edges);
  return { isSpof: ap.has(removeId), disconnected, lostZoneBridges: lost.length, cutEdges };
}
