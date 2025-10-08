// ===============================
// File: src/decision/engine.js
// ===============================
import { offlineImpact } from "./simulate.js";

const clamp01 = (x)=>Math.max(0,Math.min(1,x));
const now = ()=>new Date();

function defaultBusinessImpact(type) {
  if (/Firewall|EHR|Database/i.test(type)) return 0.9;
  if (/Router|HL7/i.test(type)) return 0.8;
  if (/Server|PACS/i.test(type)) return 0.7;
  if (/Switch|WiFi/i.test(type)) return 0.6;
  if (/Medical IoT/i.test(type)) return 0.5;
  if (/Workstation/i.test(type)) return 0.3;
  return 0.5;
}

function degreeCentrality(nodes, edges, id) {
  const count = edges.reduce((n,e)=>n + (e.source===id || e.target===id ? 1 : 0), 0);
  const maxDeg = nodes.length ? Math.max(1, ...nodes.map(n =>
    edges.reduce((m,e)=>m + (e.source===n.id || e.target===n.id ? 1 : 0), 0))) : 1;
  return clamp01(count / maxDeg);
}

function zoneBridgeBonus(nodes, edges, id) {
  const zById = new Map(nodes.map(n => [n.id, n.zone]));
  const adj = new Set();
  const zones = new Set();
  for (const e of edges) {
    if (e.source===id) { adj.add(e.target); zones.add(zById.get(e.target)); }
    if (e.target===id) { adj.add(e.source); zones.add(zById.get(e.source)); }
  }
  // 0..1: how many unique zones it touches (2+ means it bridges)
  return Math.min(1, Math.max(0, (zones.size - 1) / 2));
}

function slaDaysFromCvss(cvss) {
  if (cvss >= 9) return 7;
  if (cvss >= 7) return 15;
  if (cvss >= 4) return 30;
  return 60;
}

export function scorePatchPriority(asset, ctx) {
  const cvssBase = Number.isFinite(asset.vuln) ? asset.vuln : 0; // using your mock field
  // EPSS: try intel then fallback by severity bucket
  const epssFromIntel = (() => {
    const cves = asset.cves || [];
    const m = ctx?.intel?.epssByCve;
    if (!m || !cves.length) return null;
    const vals = cves.map(c => m.get?.(c)).filter(v => typeof v === "number");
    return vals.length ? Math.max(...vals) : null;
  })();
  const epss = clamp01(epssFromIntel ?? (cvssBase>=9?0.6:cvssBase>=7?0.35:cvssBase>=4?0.12:0.05));

  const bia = clamp01(asset.businessImpact ?? ctx?.intel?.businessImpactById?.get?.(asset.id) ?? defaultBusinessImpact(asset.type));

  const topoDeg  = degreeCentrality(ctx.nodes, ctx.edges, asset.id);
  const topoBr   = zoneBridgeBonus(ctx.nodes, ctx.edges, asset.id);
  const spof     = offlineImpact(ctx.nodes, ctx.edges, asset.id).isSpof;
  const topo     = clamp01(0.6*topoDeg + 0.4*topoBr + (spof?0.3:0));

  const kev = (() => {
    const kevSet = ctx?.intel?.kevSet;
    const cves = asset.cves || [];
    return !!(kevSet && cves.some(c => kevSet.has?.(c)));
  })();

  // Weighted score (0..1)
  const severity = clamp01(cvssBase/10);
  const score = clamp01(0.38*severity + 0.27*epss + 0.25*bia + 0.10*topo + (kev?0.08:0));

  // Bucket
  const priority = kev || score >= 0.8 ? "Emergency"
                   : score >= 0.6 ? "High"
                   : score >= 0.4 ? "Medium" : "Low";

  return { priority, score, explain: { cvssBase, epss, bia, topo, isKev: kev, isSpof: spof } };
}

export function costOfDelay(asset, days = 7, ctx) {
  const { explain } = scorePatchPriority(asset, ctx);
  const perDayRisk = explain.epss * (explain.cvssBase/10) * explain.bia; // ~prob*impact
  const cod = Math.round(perDayRisk * days * 100) / 100;

  // Due date from KEV–or–SLA
  let dueAt;
  if (ctx?.intel?.kevDueByCve && asset.cves?.length) {
    const dueList = asset.cves.map(c => ctx.intel.kevDueByCve.get?.(c)).filter(Boolean).map(d => new Date(d));
    dueAt = dueList.length ? new Date(Math.min(...dueList.map(d=>d.getTime()))) : null;
  }
  if (!dueAt) {
    const daysSla = slaDaysFromCvss(explain.cvssBase);
    dueAt = new Date(now().getTime() + daysSla*86400000);
  }
  const timeLeftDays = Math.ceil((dueAt - now())/86400000);
  return { cod, sev: explain.cvssBase, dueAt, timeLeftDays };
}

// Basic maintenance windows: weeknights 18:00-22:00, Sat/Sun 09:00-13:00 (local time)
function* upcomingWindows(limitDays = 21) {
  const start = new Date(); start.setMinutes(0,0,0);
  for (let d=0; d<limitDays; d++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate()+d);
    const wd = day.getDay(); // 0 Sun .. 6 Sat
    if (wd >= 1 && wd <= 5) { // weekdays
      const s = new Date(day); s.setHours(18,0,0,0);
      const e = new Date(day); e.setHours(22,0,0,0);
      yield { start:s, end:e, label: `${s.toLocaleString()} → ${e.toLocaleTimeString()}` };
    } else { // weekend
      const s = new Date(day); s.setHours(9,0,0,0);
      const e = new Date(day); e.setHours(13,0,0,0);
      yield { start:s, end:e, label: `${s.toLocaleString()} → ${e.toLocaleTimeString()}` };
    }
  }
}

export function suggestNextWindow(asset, ctx) {
  const it = upcomingWindows(28);
  const nowT = now().getTime();
  for (const w of it) {
    if (w.end.getTime() > nowT) return w;
  }
  return null;
}
