// ===============================
// File: src/metrics.js
// ===============================
import * as d3 from "d3";
import { clamp, median } from "./domain";

export function metricPatchCompliance(assets, patchTarget = 0.9) {
  const total = assets.length || 1;
  const compliant = assets.filter((a) => (a.patch ?? 0) >= patchTarget).length;
  return { compliancePct: Math.round((compliant / total) * 100), total, compliant, targetPct: Math.round(patchTarget * 100) };
}
export const metricMeanCVSS = (assets) => Math.round(((d3.mean(assets, (a) => a?.vuln ?? 0) || 0) * 10)) / 10;
export function metricAvailabilitySLA({ agreedServiceMinutes, downtimeMinutes }) {
  const ast = Math.max(1, agreedServiceMinutes);
  const dt = clamp(downtimeMinutes || 0, 0, ast);
  return Math.round(((ast - dt) / ast) * 100 * 100) / 100;
}
export const metricETA = (backlog, perDay) => (perDay <= 0 ? Infinity : Math.ceil(backlog / perDay));
export function metricMTTx(incidents) {
  const dMins = incidents.filter((i) => i.detected >= i.created).map((i) => (i.detected - i.created) / 60000);
  const rMins = incidents.filter((i) => i.responded >= i.detected).map((i) => (i.responded - i.detected) / 60000);
  return { MTTDmin: Math.round(median(dMins)), MTTRmin: Math.round(median(rMins)) };
}
export function metricAlertCounts(alerts, winMin = 60) {
  const since = Date.now() - winMin * 60000;
  const recent = alerts.filter((a) => a.time >= since);
  const counts = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const a of recent) counts[a.severity] = (counts[a.severity] || 0) + 1;
  return { windowMin: winMin, ...counts, total: recent.length };
}
export function criticality(asset) {
  const exposure = 0.5 * (asset.vuln / 10) + 0.5 * (1 - asset.patch);
  const statusMul = asset.status === "outage" ? 1.25 : asset.status === "degraded" ? 1.1 : 1;
  return Math.round(clamp(100 * exposure * statusMul, 0, 100));
}