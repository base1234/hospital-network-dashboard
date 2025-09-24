// SecurityOpsWithTopology.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Graph } from "@antv/g6";

/**
 * Security Ops Dashboard — Hospital Network
 * - Built-in G6 shapes (no external images)
 * - Zones: External → DMZ/Perimeter → Clinical / Admin
 * - Hospital device types (EHR, PACS, HL7, Med IoT, AD/IdP, VPN, etc.)
 * - Seeded spine so topology always connects (no floating nodes)
 * - Metrics & charts preserved; risk overlay supported
 */

/* ============================= Domain ============================= */
const TYPE = {
  Firewall: "Firewall",
  Router: "Router",
  Switch: "Core Switch",
  ServerEHR: "EHR Server",
  ServerPACS: "PACS Server",
  HL7: "HL7/Interface Engine",
  DB: "Clinical DB",
  MedIoT: "Medical IoT",
  Workstation: "Clinician WS",
  RadiologyWS: "Radiology WS",
  AD: "AD/IdP",
  App: "App Server",
  VPN: "VPN Gateway",
  Internet: "Internet",
};

const ZONE = {
  External: "External",
  DMZ: "DMZ / Perimeter",
  Clinical: "Clinical",
  Admin: "Admin",
};

const STATUS = { healthy: "healthy", degraded: "degraded", outage: "outage" };
const SEV = ["low", "medium", "high", "critical"];
const SEV_COLOR = { low: "#64748b", medium: "#0ea5e9", high: "#f59e0b", critical: "#dc2626" };
const STATUS_STROKE = { [STATUS.healthy]:"#16a34a", [STATUS.degraded]:"#f59e0b", [STATUS.outage]:"#dc2626" };

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const median = (arr) => (arr.length
  ? ((arr = [...arr].sort((a,b)=>a-b)), arr.length%2 ? arr[(arr.length-1)/2] : (arr[arr.length/2-1]+arr[arr.length/2])/2)
  : 0);
const rngSeed = (s) => d3.randomLcg(s);

/* ============================= Shapes & Colors ============================= */
// Built-in shapes: circle, rect, ellipse, diamond, triangle, star, hexagon, donut
const SHAPE_BY_TYPE = {
  [TYPE.Firewall]: "hexagon",
  [TYPE.Router]: "diamond",
  [TYPE.Switch]: "triangle",
  [TYPE.ServerEHR]: "rect",
  [TYPE.ServerPACS]: "star",
  [TYPE.HL7]: "ellipse",
  [TYPE.DB]: "donut",
  [TYPE.MedIoT]: "circle",
  [TYPE.Workstation]: "circle",
  [TYPE.RadiologyWS]: "ellipse",
  [TYPE.AD]: "rect",
  [TYPE.App]: "rect",
  [TYPE.VPN]: "diamond",
  [TYPE.Internet]: "circle",
};

// palette by *type* (shape+color differentiate when shapes repeat)
const TYPE_COLOR = {
  [TYPE.Firewall]: "#f97316",
  [TYPE.Router]: "#2563eb",
  [TYPE.Switch]: "#0891b2",
  [TYPE.ServerEHR]: "#16a34a",
  [TYPE.ServerPACS]: "#c026d3",
  [TYPE.HL7]: "#0ea5e9",
  [TYPE.DB]: "#0891b2",
  [TYPE.MedIoT]: "#22c55e",
  [TYPE.Workstation]: "#6366f1",
  [TYPE.RadiologyWS]: "#ef4444",
  [TYPE.AD]: "#111827",
  [TYPE.App]: "#10b981",
  [TYPE.VPN]: "#fb7185",
  [TYPE.Internet]: "#475569",
};

const safeShape = (t) => SHAPE_BY_TYPE[t] || "circle";
const typeFill  = (t) => TYPE_COLOR[t] || "#94a3b8";

/* ============================= Mock Data (Hospital) ============================= */
function enrichMetrics(a, r) {
  const statusRand = r();
  a.status = statusRand < 0.05 ? STATUS.outage : statusRand < 0.22 ? STATUS.degraded : STATUS.healthy;
  a.vuln = +(r() * 10).toFixed(1);
  const basePatch =
    a.type === TYPE.Workstation || a.type === TYPE.MedIoT ? 0.75 :
    a.type === TYPE.DB || a.type === TYPE.ServerPACS || a.type === TYPE.ServerEHR ? 0.82 : 0.86;
  a.patch = +(clamp(basePatch + (r() - 0.5) * 0.25, 0, 1)).toFixed(2);
  a.net = Math.round((a.type === TYPE.Router || a.type === TYPE.Switch ? 900 : a.type === TYPE.Workstation ? 60 : 320) + r() * 700);
  return a;
}

function genAssets(N = 44, seed = 2025) {
  const r = rngSeed(seed);

  // Seed a minimal, realistic hospital spine so links always have anchors
  const seeded = [
    { id:"inet", name:"Internet",      type: TYPE.Internet, zone: ZONE.External },
    { id:"vpn0", name:"VPN Gateway",   type: TYPE.VPN,      zone: ZONE.DMZ },
    { id:"rt0",  name:"Edge Router",   type: TYPE.Router,   zone: ZONE.DMZ },
    { id:"fw0",  name:"Firewall A",    type: TYPE.Firewall, zone: ZONE.DMZ },
    { id:"fw1",  name:"Firewall B",    type: TYPE.Firewall, zone: ZONE.DMZ },
    { id:"sw0",  name:"Core Switch",   type: TYPE.Switch,   zone: ZONE.Clinical },
    { id:"ehr0", name:"EHR Server",    type: TYPE.ServerEHR,zone: ZONE.Clinical },
    { id:"pacs0",name:"PACS Server",   type: TYPE.ServerPACS, zone: ZONE.Clinical },
    { id:"hl7",  name:"HL7 Engine",    type: TYPE.HL7,      zone: ZONE.Clinical },
    { id:"db0",  name:"Clinical DB",   type: TYPE.DB,       zone: ZONE.Clinical },
    { id:"ad0",  name:"AD/IdP",        type: TYPE.AD,       zone: ZONE.Admin },
    { id:"app0", name:"App Server",    type: TYPE.App,      zone: ZONE.Admin },
  ];

  // Fill with clinical/admin edges & devices
  let i = 1;
  while (seeded.length < N) {
    const pick = [
      TYPE.MedIoT, TYPE.MedIoT, TYPE.MedIoT,           // many IoT devices
      TYPE.Workstation, TYPE.RadiologyWS, TYPE.Workstation,
      TYPE.ServerEHR, TYPE.ServerPACS, TYPE.HL7, TYPE.DB,
      TYPE.App, TYPE.AD,
    ][Math.floor(r()*12)];

    const zone =
      pick === TYPE.MedIoT || pick === TYPE.ServerEHR || pick === TYPE.ServerPACS || pick === TYPE.HL7 || pick === TYPE.DB || pick === TYPE.RadiologyWS
        ? ZONE.Clinical
        : pick === TYPE.App || pick === TYPE.AD
        ? ZONE.Admin
        : ZONE.Clinical;

    const id = `${pick.split(" ").join("").slice(0,3).toLowerCase()}${String(i).padStart(2,"0")}`;
    seeded.push({ id, name: `${pick} ${i}`, type: pick, zone });
    i++;
  }

  // Enrich metrics
  return seeded.map(a => enrichMetrics(a, r));
}

function genLinks(assets, seed = 2026) {
  const r = rngSeed(seed);
  const ext = assets.filter(a=>a.zone===ZONE.External).map(a=>a.id);
  const dmz = assets.filter(a=>a.zone===ZONE.DMZ).map(a=>a.id);
  const clin = assets.filter(a=>a.zone===ZONE.Clinical).map(a=>a.id);
  const admin= assets.filter(a=>a.zone===ZONE.Admin).map(a=>a.id);

  const idByType = (t) => assets.find(a=>a.type===t)?.id;
  const router = idByType(TYPE.Router);
  const coreSw = idByType(TYPE.Switch);
  const fwA = assets.find(a=>a.id==="fw0")?.id || assets.find(a=>a.type===TYPE.Firewall)?.id;
  const fwB = assets.find(a=>a.id==="fw1")?.id || assets.filter(a=>a.type===TYPE.Firewall)[1]?.id;

  const anyNode = assets[0]?.id;

  const seen = new Set();
  const add = (a,b) => {
    if (!a || !b || a === b) return null;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const lat = Math.max(1, Math.round(4 + r()*16));
    const loss = +(clamp(0.08 + r()*0.4, 0, 2).toFixed(2));
    return { id:`L_${key}`, source:a, target:b, lat, loss };
  };

  const links = [];

  // External → DMZ
  const dmzAnchor = router || fwA || dmz[0] || anyNode;
  for (const e of ext) { const l = add(e, dmzAnchor); if (l) links.push(l); }

  // DMZ mesh & DMZ → Clinical core
  for (let i = 1; i < dmz.length; i++) {
    const l = add(dmz[i], dmz[Math.floor(r()*i)]); if (l) links.push(l);
  }
  const clinicalAnchor = coreSw || clin[0] || anyNode;
  for (const f of [fwA, fwB].filter(Boolean)) { const l = add(f, clinicalAnchor); if (l) links.push(l); }
  if (router) { const l = add(router, fwA || clinicalAnchor); if (l) links.push(l); }

  // Clinical spoke
  for (const c of clin) { const l = add(c, clinicalAnchor); if (l) links.push(l); }

  // Admin spoke (connect to core switch)
  const adminAnchor = clinicalAnchor;
  for (const a of admin) { const l = add(a, adminAnchor); if (l) links.push(l); }

  // A few cross ties
  for (let k=0; k<Math.round(assets.length*0.15); k++) {
    const a = assets[Math.floor(r()*assets.length)].id;
    const b = assets[Math.floor(r()*assets.length)].id;
    const l = add(a,b); if (l) links.push(l);
  }

  return links;
}

function genIncidents(assets, days = 30, seed = 2027) {
  const r = rngSeed(seed);
  const now = Date.now(), start = now - days*86400000;
  const N = Math.floor(45 + r()*35);
  const out = [];
  for (let i=0; i<N; i++) {
    const created = start + Math.floor(r()*(now-start));
    const detectLagMin = 5 + r()*240, respondLagMin = 20 + r()*720;
    out.push({
      id:`I${i}`,
      created,
      detected: created + detectLagMin*60000,
      responded: created + (detectLagMin+respondLagMin)*60000,
      severity: SEV[Math.floor(r()*4)],
      assetId: assets[Math.floor(r()*assets.length)].id,
      title: `Incident ${i}`,
    });
  }
  return out.sort((a,b)=>a.created-b.created);
}

function genAlerts(assets, minutes = 180, seed = 2028) {
  const r = rngSeed(seed);
  const now = Date.now(), start = now - minutes*60000;
  const N = Math.floor(280 + r()*140);
  const out = [];
  for (let i=0;i<N;i++){
    const t = start + Math.floor(r()*(now-start));
    out.push({
      id:`A${i}`,
      time:t,
      severity: SEV[Math.floor(r()*4)],
      assetId: assets[Math.floor(r()*assets.length)].id,
      title: `Alert ${i}`,
    });
  }
  return out.sort((a,b)=>a.time-b.time);
}

/* ============================= Metrics ============================= */
function metricPatchCompliance(assets, patchTarget = 0.9) {
  const total = assets.length || 1;
  const compliant = assets.filter(a => (a.patch ?? 0) >= patchTarget).length;
  return { compliancePct: Math.round((compliant/total)*100), total, compliant, targetPct: Math.round(patchTarget*100) };
}
const metricMeanCVSS = (assets) => Math.round(((d3.mean(assets, a => a?.vuln ?? 0) || 0) * 10)) / 10;
function metricAvailabilitySLA({ agreedServiceMinutes, downtimeMinutes }) {
  const ast = Math.max(1, agreedServiceMinutes);
  const dt = clamp(downtimeMinutes || 0, 0, ast);
  return Math.round(((ast - dt) / ast) * 100 * 100) / 100;
}
const metricETA = (backlog, perDay) => (perDay <= 0 ? Infinity : Math.ceil(backlog / perDay));
function metricMTTx(incidents) {
  const dMins = incidents.filter(i => i.detected >= i.created).map(i => (i.detected - i.created) / 60000);
  const rMins = incidents.filter(i => i.responded >= i.detected).map(i => (i.responded - i.detected) / 60000);
  return { MTTDmin: Math.round(median(dMins)), MTTRmin: Math.round(median(rMins)) };
}
function metricAlertCounts(alerts, winMin = 60) {
  const since = Date.now() - winMin * 60000;
  const recent = alerts.filter(a => a.time >= since);
  const counts = { low:0, medium:0, high:0, critical:0 };
  for (const a of recent) counts[a.severity] = (counts[a.severity] || 0) + 1;
  return { windowMin: winMin, ...counts, total: recent.length };
}
function criticality(asset) {
  const exposure = 0.5*(asset.vuln/10) + 0.5*(1 - asset.patch);
  const statusMul = asset.status === STATUS.outage ? 1.25 : asset.status === STATUS.degraded ? 1.1 : 1;
  return Math.round(clamp(100*exposure*statusMul, 0, 100));
}

/* ============================= Small UI ============================= */
function KPI({ label, value, color }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, textAlign: "center" }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || "inherit" }}>{value}</div>
    </div>
  );
}
function Card({ title, children, right, style }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, ...(style || {}) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>{right}
      </div>
      {children}
    </div>
  );
}

/* ============================= G6 helpers ============================= */
function gHas(g, fn) { return g && typeof g[fn] === "function"; }
function gDestroyed(g) { return !g || g.destroyed; }
function gGetData(g) { try { return g.getData?.() || {}; } catch { return {}; } }
function findItemsByIds(g, ids) { const find = g.findById?.bind(g); return find ? ids.map(id => { try { return find(id); } catch { return null; } }).filter(Boolean) : []; }
function getNodeItems(g) { if (gHas(g,"getAllNodes")) return g.getAllNodes(); if (gHas(g,"getNodes")) return g.getNodes(); const ids=(gGetData(g).nodes||[]).map(n=>n.id); return findItemsByIds(g,ids); }
function getEdgeItems(g) { if (gHas(g,"getAllEdges")) return g.getAllEdges(); if (gHas(g,"getEdges")) return g.getEdges(); const ids=(gGetData(g).edges||[]).map(e=>e.id); return findItemsByIds(g,ids); }
function clearState(g, state) {
  const clear = (it) => { try { g.clearItemStates?.(it, [state]); g.setItemState?.(it, state, false); } catch {} };
  getNodeItems(g).forEach(clear); getEdgeItems(g).forEach(clear);
}

/* ============================= Main ============================= */
export default function SecurityOpsWithTopology() {
  // Data
  const [assets] = useState(() => genAssets(44, 2025));
  const [links]  = useState(() => genLinks(assets, 2026));
  const [incidents] = useState(() => genIncidents(assets, 30, 2027));
  const [alerts] = useState(() => genAlerts(assets, 180, 2028));

  // Controls
  const [patchTarget, setPatchTarget] = useState(0.9);
  const [patchThroughput, setPatchThroughput] = useState(8);
  const [monthlyDowntimeMin, setMonthlyDowntimeMin] = useState(22);
  const [alertWindow, setAlertWindow] = useState(60);
  const [showRiskOverlay, setShowRiskOverlay] = useState(true);

  // Metrics
  const patch = useMemo(() => metricPatchCompliance(assets, patchTarget), [assets, patchTarget]);
  const meanCvss = useMemo(() => metricMeanCVSS(assets), [assets]);
  const backlog = useMemo(() => assets.filter(a => (a.patch ?? 0) < patchTarget).length, [assets, patchTarget]);
  const etaDays = useMemo(() => metricETA(backlog, patchThroughput), [backlog, patchThroughput]);
  const availabilityPct = useMemo(() => metricAvailabilitySLA({ agreedServiceMinutes: 30*24*60, downtimeMinutes: monthlyDowntimeMin }), [monthlyDowntimeMin]);
  const { MTTDmin, MTTRmin } = useMemo(() => metricMTTx(incidents), [incidents]);
  const alertCounts = useMemo(() => metricAlertCounts(alerts, alertWindow), [alerts, alertWindow]);

  const nonCompliantByType = useMemo(() => {
    const byType = d3.rollups(assets, v => v.filter(a => (a.patch ?? 0) < patchTarget).length, a => a.type);
    return byType.map(([type, non]) => ({ type, non })).filter(d => d.non > 0).sort((a,b)=>d3.descending(a.non,b.non));
  }, [assets, patchTarget]);
  // Top-K view + "Other" bucket to reduce clutter
	const nonCompliantTop = useMemo(() => {
	  const TOPK = 8;
	  const sorted = [...nonCompliantByType]; // already sorted desc
	  const top = sorted.slice(0, TOPK);
	  const otherSum = d3.sum(sorted.slice(TOPK), d => d.non) || 0;
	  return otherSum > 0 ? [...top, { type: "Other", non: otherSum }] : top;
	}, [nonCompliantByType]);


  const incidentsByDay = useMemo(() => {
    const days = d3.rollups(incidents, v => v.length, i => d3.timeDay.floor(new Date(i.created)).getTime());
    return days.map(([t,c]) => ({ t:+t, c })).sort((a,b)=>a.t-b.t);
  }, [incidents]);

  const severityCounts = useMemo(() => {
    const counts = d3.rollups(alerts, v => v.length, a => a.severity);
    const map = new Map(counts);
    return SEV.map(s => ({ sev: s, c: map.get(s) || 0 }));
  }, [alerts]);

  // Risk overlay list
  const riskyIds = useMemo(() => {
    return assets.map(a => ({ id:a.id, s:criticality(a) }))
      .sort((x,y)=>d3.descending(x.s,y.s))
      .slice(0, Math.max(6, Math.round(assets.length*0.2)))
      .map(x=>x.id);
  }, [assets]);

  // Refs
  const topoRef = useRef(null);
  const graphRef = useRef(null);
  const sevRef = useRef(null);
  const incRef = useRef(null);
  const compRef = useRef(null);
  const [selected, setSelected] = useState(null);

  /* ============================= G6 Topology ============================= */
  useEffect(() => {
    const el = topoRef.current;
    if (!el) return;

    if (graphRef.current && !graphRef.current.destroyed) {
      try { graphRef.current.destroy(); } catch {}
      graphRef.current = null;
    }

    let disposed = false;
    let { width, height } = el.getBoundingClientRect();
    if (!width || !height) { width = el.clientWidth || 960; height = el.clientHeight || 520; }

    const graph = new Graph({
      container: el,
      width, height,
      pixelRatio: window.devicePixelRatio || 1,
      layout: { type: "force", preventOverlap: true, nodeStrength: 140, linkDistance: 100 },
      modes: { default: ["drag-node", "zoom-canvas", "drag-canvas"] },
      defaultNode: {
        size: 42,
        style: { lineWidth: 3, fill: "#e2e8f0", stroke: "#334155", cursor: "pointer" },
        stateStyles: {
          hover: { shadowColor: "#94a3b8", shadowBlur: 10 },
          risk:  { shadowColor: "#dc2626", shadowBlur: 22, lineWidth: 4, stroke: "#dc2626" },
        },
      },
      defaultEdge: {
        style: { endArrow: true, stroke: "#94a3b8" },
        stateStyles: { risk: { stroke: "#dc2626", lineWidth: 2, lineDash: [6,6] } },
      },
      defaultCombo: {
        type: "rect",
        padding: 16,
        style: { fill: "#f8fafc", stroke: "#CBD5E1", lineWidth: 1 },
        labelCfg: { position: "top", style: { fill: "#0f172a", fontWeight: 700 } },
      },
    });
    graphRef.current = graph;

    const combos = [
      { id: ZONE.External, label: "External" },
      { id: ZONE.DMZ,      label: "DMZ / Perimeter" },
      { id: ZONE.Clinical, label: "Clinical" },
      { id: ZONE.Admin,    label: "Admin" },
    ];

    const nodes = assets.map(a => ({
      id: a.id,
      label: a.name,
      type: safeShape(a.type),
      comboId: a.zone,
      size: [TYPE.Firewall, TYPE.Router, TYPE.Switch].includes(a.type) ? 48 : 40,
      deviceType: a.type, zone: a.zone, vuln: a.vuln, patch: a.patch, status: a.status,
      style: {
        fill: typeFill(a.type),
        stroke: STATUS_STROKE[a.status] || "#334155",
        lineWidth: 3,
        radius: 8,
        cursor: "pointer",
        // For donut, tint the inner ring so it doesn't look empty
        ...(safeShape(a.type) === "donut" ? { innerR: 0.55, innerRFill: "#f1f5f9" } : {}),
      },
      labelCfg: { position: "bottom", offset: 6, style: { fontSize: 11, fill: "#0f172a" } },
    }));

    const edges = links.map(l => ({
      id: l.id, source: l.source, target: l.target,
      label: `${l.lat} ms | ${l.loss}%`,
      latency: l.lat, loss: l.loss,
      style: { stroke: l.loss > 0.5 ? "#dc2626" : "#94a3b8", lineDash: l.loss > 0.5 ? [6,6] : undefined, endArrow: true },
      labelCfg: { autoRotate: true, style: { fontSize: 11, fill: "#475569" } },
    }));

    const run = async () => {
      if (disposed) return;
      try { graph.setData({ nodes, edges, combos }); await graph.render?.(); } catch {}
      if (disposed || gDestroyed(graph)) return;

      graph.once?.("afterrender", () => {
        if (disposed || gDestroyed(graph)) return;
        try { graph.fitCenter?.(); graph.fitView?.(20); } catch {}
      });

      graph.on?.("node:mouseenter", e => !disposed && !gDestroyed(graph) && graph.setItemState?.(e.item, "hover", true));
      graph.on?.("node:mouseleave", e => !disposed && !gDestroyed(graph) && graph.setItemState?.(e.item, "hover", false));
      graph.on?.("node:click", evt => {
        if (disposed || gDestroyed(graph)) return;
        const m = evt.item?.getModel?.(); if (!m) return;
        setSelected({ kind:"node", id:m.id, name:m.label, type:m.deviceType, zone:m.comboId, vuln:m.vuln, patch:m.patch, status:m.status });
      });
      graph.on?.("edge:click", evt => {
        if (disposed || gDestroyed(graph)) return;
        const m = evt.item?.getModel?.(); if (!m) return;
        setSelected({ kind:"edge", id:m.id, source:m.source, target:m.target, latency:m.latency, loss:m.loss });
      });
      graph.on?.("canvas:click", () => { if (!disposed && !gDestroyed(graph)) setSelected(null); });
    };
    run();

    // Resize
    const resize = (w,h) => { if (gDestroyed(graph)) return; try { (graph.setSize || graph.changeSize)?.call(graph, w,h); } catch {} };
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        const { width:w, height:h } = entries[0].contentRect;
        if (w && h) resize(w,h);
      });
      ro.observe(el);
    }

    return () => { disposed = true; if (ro) ro.disconnect(); try { graph.destroy?.(); } catch {}; graphRef.current = null; };
  }, [assets, links]);

  // Risk overlay
  useEffect(() => {
    const g = graphRef.current;
    if (gDestroyed(g)) return;
    clearState(g, "risk");
    if (!showRiskOverlay) { try { g.paint?.(); } catch {} return; }

    const risky = new Set(riskyIds);
    for (const node of getNodeItems(g)) {
      const id = node?.getID?.() ?? node?.getModel?.()?.id;
      if (id && risky.has(id)) { try { g.setItemState?.(node, "risk", true); } catch {} }
    }
    for (const edge of getEdgeItems(g)) {
      const m = edge?.getModel?.() || {};
      if (m.source && m.target && risky.has(m.source) && risky.has(m.target)) {
        try { g.setItemState?.(edge, "risk", true); } catch {}
      }
    }
    try { g.paint?.(); } catch {}
  }, [riskyIds, showRiskOverlay]);

  /* ============================= Charts ============================= */
  useEffect(() => {
    const svg = d3.select(sevRef.current); if (svg.empty()) return;
    const w = svg.node().clientWidth || 360, h = 200, m = { t:10, r:10, b:36, l:48 };
    svg.attr("viewBox", `0 0 ${w} ${h}`).selectAll("*").remove();
    const x = d3.scaleBand().domain(SEV).range([m.l, w-m.r]).padding(0.25);
    const domainY = [0, d3.max(severityCounts, d=>d.c) || 1];
    const y = d3.scaleLinear().domain(domainY).nice().range([h-m.b, m.t]);
    const g = svg.append("g");
    g.append("g").attr("transform", `translate(0,${h-m.b})`).call(d3.axisBottom(x));
    g.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5));
    g.selectAll("rect").data(severityCounts).enter().append("rect")
      .attr("x", d=>x(d.sev)).attr("y", d=>y(d.c))
      .attr("width", x.bandwidth()).attr("height", d=>h-m.b-y(d.c))
      .attr("fill", d=>SEV_COLOR[d.sev]);
    g.append("text").attr("x", m.l-40).attr("y", m.t-4).attr("font-size", 12).attr("fill", "#475569").text("# Alerts");
    g.append("text").attr("x", (m.l+(w-m.r))/2).attr("y", h-6).attr("text-anchor","middle").attr("font-size", 12).attr("fill", "#475569").text("Severity (window=180m)");
  }, [severityCounts]);

  useEffect(() => {
    const svg = d3.select(incRef.current); if (svg.empty()) return;
    const w = svg.node().clientWidth || 360, h = 200, m = { t:10, r:10, b:36, l:52 };
    svg.attr("viewBox", `0 0 ${w} ${h}`).selectAll("*").remove();
    const x = d3.scaleTime().domain(d3.extent(incidentsByDay, d=>new Date(d.t)) || [new Date(), new Date()]).range([m.l, w-m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(incidentsByDay, d=>d.c) || 1]).nice().range([h-m.b, m.t]);
    const g = svg.append("g");
    g.append("g").attr("transform", `translate(0,${h-m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%b %d")));
    g.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5));
    const line = d3.line().x(d=>x(new Date(d.t))).y(d=>y(d.c)).curve(d3.curveMonotoneX);
    g.append("path").datum(incidentsByDay).attr("fill","none").attr("stroke","currentColor").attr("strokeWidth",2).attr("d", line);
    g.append("text").attr("transform", `translate(${m.l-44},${(h-m.b+m.t)/2}) rotate(-90)`).attr("text-anchor","middle").attr("font-size", 12).attr("fill","#475569").text("# Incidents / day");
  }, [incidentsByDay]);

  useEffect(() => {
  const svg = d3.select(compRef.current);
  if (svg.empty()) return;

  // Responsive width; dynamic height to fit bars comfortably
  const data = nonCompliantTop;
  const w = svg.node().clientWidth || 420;
  const barH = 26;              // per-bar height
  const barGap = 8;             // gap between bars
  const m = { t: 16, r: 24, b: 24, l: 140 }; // leave room for long labels
  const h = m.t + m.b + data.length * (barH + barGap);

  svg.attr("viewBox", `0 0 ${w} ${h}`).selectAll("*").remove();

  // Scales
  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.non) || 1])
    .nice()
    .range([m.l, w - m.r]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.type))
    .range([m.t, h - m.b])
    .paddingInner(0.25)
    .paddingOuter(0.05);

  const g = svg.append("g");

  // Axes
  const yAxis = d3.axisLeft(y).tickSize(0);
  const xAxis = d3.axisBottom(x).ticks(5).tickFormat(d3.format("d"));

  g.append("g")
    .attr("transform", `translate(0,${h - m.b})`)
    .call(xAxis)
    .call(g => g.selectAll("text").style("font-size", "12px"));

  g.append("g")
    .attr("transform", `translate(${m.l},0)`)
    .call(yAxis)
    .call(g => g.selectAll("text").style("font-size", "12px"))
    .call(g => g.select(".domain").remove());

  // Bars
  const bar = g.selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", x(0))
    .attr("y", d => (y(d.type) ?? 0) + (y.bandwidth() - barH) / 2)
    .attr("width", d => x(d.non) - x(0))
    .attr("height", barH)
    .attr("fill", "#dc2626")
    .attr("rx", 6).attr("ry", 6);

  // Value labels at end of bars
  g.selectAll("text.value")
    .data(data)
    .enter()
    .append("text")
    .attr("x", d => x(d.non) + 6)
    .attr("y", d => (y(d.type) ?? 0) + y.bandwidth() / 2 + 4)
    .attr("font-size", 12)
    .attr("fill", "#0f172a")
    .text(d => d.non);

  // Axis titles
  svg.append("text")
    .attr("x", w / 2)
    .attr("y", h - 4)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("fill", "#475569")
    .text("# Non-compliant assets (Top-8 + Other)");

  svg.append("text")
    .attr("x", m.l - 8)
    .attr("y", m.t - 6)
    .attr("text-anchor", "end")
    .attr("font-size", 12)
    .attr("fill", "#475569")
    .text("Device type");
}, [nonCompliantTop]);


  /* ============================= Layout ============================= */
  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "auto", fontFamily: "Inter, system-ui, Arial, sans-serif" }}>
      <div style={{ padding: 16, maxWidth: 1440, margin: "0 auto" }}>
        <h2 style={{ margin: 0 }}>Hospital Security Ops — Metrics + Topology</h2>
        <div style={{ margin: "6px 0 16px", fontSize: 14, color: "#475569" }}>
          Zones: External → DMZ/Perimeter → Clinical / Admin • Device type by <b>shape</b>, role by <b>color</b>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
          <KPI label={`Patch Compliance (≥${patch.targetPct}%)`} value={`${patch.compliancePct}%`} />
          <KPI label="Mean CVSS (0–10)" value={meanCvss} />
          <KPI label="Patch Backlog" value={backlog} />
          <KPI label="Patch ETA (days)" value={etaDays === Infinity ? "∞" : etaDays} />
          <KPI label="Availability (SLA, %)" value={`${availabilityPct}%`} />
          <KPI label="MTTD / MTTR (min)" value={`${MTTDmin} / ${MTTRmin}`} />
        </div>

        {/* Controls (A11y: labeled inputs) */}
<Card title="What-If Controls" style={{ marginTop: 12 }}>
  <fieldset
    aria-describedby="controls-help"
    style={{ border: 0, padding: 0, margin: 0 }}
  >
    <legend style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(1px,1px,1px,1px)" }}>
      Simulation controls
    </legend>
    <p id="controls-help" style={{ marginTop: 0, marginBottom: 12, color: "#475569", fontSize: 13 }}>
      Adjust patch targets, throughput, downtime, and alert window. All sliders have live values.
    </p>

    <div
      role="group"
      aria-label="Sliders"
      style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, alignItems: "center", fontSize: 13 }}
    >
      {/* Patch target */}
      <div>
        <label htmlFor="patchTarget" style={{ display: "block", marginBottom: 4 }}>
          <b>Patch target</b> <span aria-live="polite">({Math.round(patchTarget * 100)}%)</span>
        </label>
        <input
          id="patchTarget"
          name="patchTarget"
          type="range"
          min="0.7"
          max="0.98"
          step="0.01"
          value={patchTarget}
          onChange={(e) => setPatchTarget(parseFloat(e.target.value))}
          style={{ width: "100%" }}
          aria-valuemin={0.7}
          aria-valuemax={0.98}
          aria-valuenow={patchTarget}
          aria-valuetext={`${Math.round(patchTarget * 100)} percent`}
        />
      </div>

      {/* Patch throughput */}
      <div>
        <label htmlFor="patchThroughput" style={{ display: "block", marginBottom: 4 }}>
          <b>Patch throughput</b> <span aria-live="polite">({patchThroughput}/day)</span>
        </label>
        <input
          id="patchThroughput"
          name="patchThroughput"
          type="range"
          min="1"
          max="30"
          step="1"
          value={patchThroughput}
          onChange={(e) => setPatchThroughput(parseInt(e.target.value, 10))}
          style={{ width: "100%" }}
          aria-valuemin={1}
          aria-valuemax={30}
          aria-valuenow={patchThroughput}
          aria-valuetext={`${patchThroughput} per day`}
        />
      </div>

      {/* Monthly downtime */}
      <div>
        <label htmlFor="monthlyDowntime" style={{ display: "block", marginBottom: 4 }}>
          <b>Monthly downtime</b> <span aria-live="polite">({monthlyDowntimeMin} min)</span>
        </label>
        <input
          id="monthlyDowntime"
          name="monthlyDowntime"
          type="range"
          min="0"
          max="300"
          step="1"
          value={monthlyDowntimeMin}
          onChange={(e) => setMonthlyDowntimeMin(parseInt(e.target.value, 10))}
          style={{ width: "100%" }}
          aria-valuemin={0}
          aria-valuemax={300}
          aria-valuenow={monthlyDowntimeMin}
          aria-valuetext={`${monthlyDowntimeMin} minutes`}
        />
      </div>

      {/* Alert window */}
      <div>
        <label htmlFor="alertWindow" style={{ display: "block", marginBottom: 4 }}>
          <b>Alerts window</b> <span aria-live="polite">({alertWindow} m)</span>
        </label>
        <input
          id="alertWindow"
          name="alertWindow"
          type="range"
          min="15"
          max="240"
          step="5"
          value={alertWindow}
          onChange={(e) => setAlertWindow(parseInt(e.target.value, 10))}
          style={{ width: "100%" }}
          aria-valuemin={15}
          aria-valuemax={240}
          aria-valuenow={alertWindow}
          aria-valuetext={`${alertWindow} minutes`}
        />
      </div>

      {/* Risk overlay toggle */}
      <div>
        <label htmlFor="riskOverlay" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#334155" }}>
          <input
            id="riskOverlay"
            name="riskOverlay"
            type="checkbox"
            checked={showRiskOverlay}
            onChange={(e) => setShowRiskOverlay(e.target.checked)}
          />
          Show risk overlay on topology
        </label>
      </div>
    </div>
  </fieldset>
</Card>


        {/* Topology + Side panel */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 12 }}>
          <Card title="Hospital Network Topology (External → DMZ → Clinical/Admin)">
            <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 12 }}>
              <div ref={topoRef} style={{ width: "100%", height: "60vh", minHeight: 360, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }} />
              <div style={{ height: "60vh", minHeight: 360, border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#f8fafc", overflowY: "auto", fontSize: 13 }}>
                {!selected ? (
                  <>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Legend</div>
                    <div style={{ marginBottom: 8 }}>Nodes grouped by zone. Device <b>type</b> → shape, role color by <b>type</b>.</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {Object.entries(SHAPE_BY_TYPE).map(([name, shape]) => (
                        <li key={name}><span style={{ display:"inline-block", width:10, height:10, background: TYPE_COLOR[name] || "#94a3b8", borderRadius:2, marginRight:6 }} /> <b>{name}</b>: {shape}</li>
                      ))}
                    </ul>
                    <div style={{ marginTop: 12 }}>
                      <div><span style={{ color: "#16a34a" }}>●</span> Healthy &nbsp; <span style={{ color: "#f59e0b" }}>●</span> Degraded &nbsp; <span style={{ color: "#dc2626" }}>●</span> Outage</div>
                      <div>Dashed red edges show higher loss.</div>
                    </div>
                  </>
                ) : selected.kind === "node" ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 800 }}>Asset details</div>
                      <button onClick={() => setSelected(null)} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", background: "#fff" }}>Clear</button>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>{selected.name}</div>
                    <div><b>Type:</b> {selected.type}</div>
                    <div><b>Zone:</b> {selected.zone}</div>
                    <div><b>Status:</b> {selected.status}</div>
                    <div><b>Patch:</b> {Math.round((selected.patch || 0) * 100)}%</div>
                    <div><b>CVSS:</b> {selected.vuln}</div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 800 }}>Link details</div>
                      <button onClick={() => setSelected(null)} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", background: "#fff" }}>Clear</button>
                    </div>
                    <div style={{ marginTop: 8 }}><b>From:</b> {selected.source}</div>
                    <div><b>To:</b> {selected.target}</div>
                    <div><b>Latency:</b> {selected.latency} ms</div>
                    <div><b>Loss:</b> {selected.loss}%</div>
                    <div style={{ marginTop: 8, color: "#64748b" }}>Dashed + red edges indicate higher loss.</div>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Charts column */}
          <div style={{ display: "grid", gridTemplateRows: "repeat(3, 1fr)", gap: 12 }}>
            <Card title="Alert severity distribution"><svg ref={sevRef} style={{ width: "100%", height: 220 }} /></Card>
            <Card title="Incidents per day (last 30d)"><svg ref={incRef} style={{ width: "100%", height: 220 }} /></Card>
            <Card title="Non-compliant assets — Top-8 types (+ Other)"><svg ref={compRef} style={{ width: "100%", height: 240 }} />
			</Card>

          </div>
        </div>

        {/* Patch priority table */}
        <Card title="Patch Priority (top 15 by CVSS then lowest patch %)" style={{ marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Asset", "Type", "Zone", "CVSS", "Patch %", "Status"].map((h) => (
                  <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "6px 4px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...assets]
                .filter(a => (a.patch ?? 0) < patchTarget)
                .sort((a,b)=> d3.descending(a.vuln, b.vuln) || d3.ascending(a.patch, b.patch))
                .slice(0, 15)
                .map(a => (
                  <tr key={a.id}>
                    <td style={{ padding: "6px 4px" }}>{a.name}</td>
                    <td style={{ padding: "6px 4px" }}>{a.type}</td>
                    <td style={{ padding: "6px 4px" }}>{a.zone}</td>
                    <td style={{ padding: "6px 4px" }}>{a.vuln}</td>
                    <td style={{ padding: "6px 4px" }}>{Math.round((a.patch || 0) * 100)}%</td>
                    <td style={{ padding: "6px 4px" }}>{a.status}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>

        {/* Recent alerts (windowed) */}
        <Card title={`Recent alerts (last ${alertCounts.windowMin}m)`} style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8, color: "#334155", fontSize: 13 }}>
            Totals — <b>Critical:</b> {alertCounts.critical} &nbsp; <b>High:</b> {alertCounts.high} &nbsp; <b>Medium:</b> {alertCounts.medium} &nbsp; <b>Low:</b> {alertCounts.low}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Time", "Asset", "Title", "Severity"].map((h) => (
                  <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "6px 4px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts
                .filter(a => a.time >= Date.now() - alertWindow*60000)
                .slice(-60)
                .reverse()
                .map(a => (
                  <tr key={a.id}>
                    <td style={{ padding: "6px 4px" }}>{new Date(a.time).toLocaleTimeString()}</td>
                    <td style={{ padding: "6px 4px" }}>{a.assetId}</td>
                    <td style={{ padding: "6px 4px" }}>{a.title}</td>
                    <td style={{ padding: "6px 4px", color: SEV_COLOR[a.severity] }}>{a.severity}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
