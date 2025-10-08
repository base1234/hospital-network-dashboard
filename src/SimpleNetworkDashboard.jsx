// ===============================
// File: src/SecurityOpsWithTopology.jsx
// ===============================
import React, { useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import * as d3 from "d3";

import { TYPE, ZONE, STATUS, SHAPE_MAP, BUILTIN_NODE_TYPES, COLOR, SEV, SEV_COLOR } from "./domain.js";
import { genAssets, genLinks, genIncidents, genAlerts } from "./mockData.js";
import { metricPatchCompliance, metricMeanCVSS, metricETA, metricAvailabilitySLA, metricMTTx } from "./metrics.js";

import KPI from "./ui/KPI.jsx";
import Card from "./ui/Card.jsx";
import SeverityBar from "./charts/SeverityBar.jsx";
import IncidentsLine from "./charts/IncidentsLine.jsx";
import NonComplianceBar from "./charts/NonComplianceBar.jsx";
import { useG6Graph } from "./topology/useG6Graph.js";

import { scorePatchPriority, costOfDelay, suggestNextWindow } from "./decision/engine.js";
import { estimatePatchDuration } from "./decision/duration.js";
import { offlineImpact } from "./decision/simulate.js";
import { suggestPatchPlan } from "./decision/plan.js";
import { decide } from "./decision/decide.js";
import { explainForHumans } from "./decision/explain.js";
import PlainExplainer from "./ui/PlainExplainer.jsx";
 // Topology models
import { TYPE_ICON, FALLBACK_ICON } from "./topology/icons.js";

const safeType = (deviceType) => {
  const t = SHAPE_MAP[deviceType] || "circle";
  return BUILTIN_NODE_TYPES.has(t) ? t : "circle";
};

export default function SecurityOpsWithTopology() {
  // Data (mocked for now)
  const [assets] = useState(() => genAssets(42, 2025));
  const [links] = useState(() => genLinks(assets, 2026));
  const [incidents] = useState(() => genIncidents(assets, 30, 2027));
  const [alerts] = useState(() => genAlerts(assets, 180, 2028));

  // Controls
  const [patchTarget, setPatchTarget] = useState(0.9);
  const [patchThroughput, setPatchThroughput] = useState(8);
  const [monthlyDowntimeMin, setMonthlyDowntimeMin] = useState(22);
  const [alertWindow, setAlertWindow] = useState(60);

  // Metrics
  const patch = useMemo(() => metricPatchCompliance(assets, patchTarget), [assets, patchTarget]);
  const meanCvss = useMemo(() => metricMeanCVSS(assets), [assets]);
  const backlog = useMemo(() => assets.filter((a) => (a.patch ?? 0) < patchTarget).length, [assets, patchTarget]);
  const etaDays = useMemo(() => metricETA(backlog, patchThroughput), [backlog, patchThroughput]);
  const availabilityPct = useMemo(
    () => metricAvailabilitySLA({ agreedServiceMinutes: 30 * 24 * 60, downtimeMinutes: monthlyDowntimeMin }),
    [monthlyDowntimeMin]
  );
  const { MTTDmin, MTTRmin } = useMemo(() => metricMTTx(incidents), [incidents]);
  const alertCounts = useMemo(() => {
    const since = Date.now() - alertWindow * 60000;
    const recent = alerts.filter((a) => a.time >= since);
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const a of recent) counts[a.severity] = (counts[a.severity] || 0) + 1;
    return { windowMin: alertWindow, ...counts, total: recent.length };
  }, [alerts, alertWindow]);

  const nonCompliantByType = useMemo(() => {
    const byType = d3.rollups(assets, (v) => v.filter((a) => (a.patch ?? 0) < patchTarget).length, (a) => a.type);
    return byType
      .map(([type, non]) => ({ type, non }))
      .filter((d) => d.non > 0)
      .sort((a, b) => d3.descending(a.non, b.non));
  }, [assets, patchTarget]);

  const incidentsByDay = useMemo(() => {
    const days = d3.rollups(incidents, (v) => v.length, (i) => d3.timeDay.floor(new Date(i.created)).getTime());
    return days.map(([t, c]) => ({ t: +t, c })).sort((a, b) => a.t - b.t);
  }, [incidents]);

  const severityCounts = useMemo(() => {
    const counts = d3.rollups(alerts, (v) => v.length, (a) => a.severity);
    const map = new Map(counts);
    return SEV.map((s) => ({ sev: s, c: map.get(s) || 0 }));
  }, [alerts]);

// 🔍 Log which TYPEs don’t have icons mapped
/*useEffect(() => {
  const missing = new Set();
  for (const a of assets) {
    if (!TYPE_ICON[a.type]) missing.add(a.type);
  }
  if (missing.size) {
    console.warn("[icons] Missing TYPE_ICON for:", [...missing]);
  }
}, [assets]);

// 🔍 Log a few URLs to sanity-check paths (open them in the console)
useEffect(() => {
  console.log("[icons] sample URLs", {
    firewall: TYPE_ICON[TYPE.Firewall],
    router: TYPE_ICON[TYPE.Router],
    switch: TYPE_ICON[TYPE.Switch],
    external: ZONE_ICON.External,
    fallback: FALLBACK_ICON,  // if you added one
  });
}, []);*/
 

// assets -> image nodes
// assets -> image nodes
const assetNodes = useMemo(
  () => assets.map((a) => {
    const url = (TYPE_ICON[a.type] || FALLBACK_ICON);
    return {
      id: a.id,
      label: `${a.name} [${a.zone}]`,
      type: "image",
      // top-level for compatibility
      src: url,
      img: url,
      style: { src: url, img: url, width: 40, height: 40 },   // <- key change
      comboId: a.zone,
      deviceType: a.type,
      zone: a.zone,
      vuln: a.vuln,
      patch: a.patch,
      status: a.status,
      labelCfg: { position: "bottom", offset: 6, style: { fontSize: 11, fill: "#0f172a" } },
    };
  }),
  [assets]
);


// external stub nodes
const externalStubNodes = useMemo(() => {
  const ids = new Set();
  for (const e of links) {
    if (String(e.source).startsWith("ext")) ids.add(e.source);
    if (String(e.target).startsWith("ext")) ids.add(e.target);
  }
  return Array.from(ids).map((id) => ({
    id,
    label: "External",
    type: "diamond",                 // shape, not image
    size: 30,
    style: { fill: "#e2e8f0", stroke: "#dc2626", lineWidth: 2 },
    comboId: ZONE.External,
    deviceType: "External",
    zone: ZONE.External,
    labelCfg: { position: "bottom", offset: 4, style: { fontSize: 10, fill: "#0f172a" } },
  }));
}, [links]);




  /*const nodes = useMemo(() => {
  const all = [...assetNodes, ...externalStubNodes].map(n => {
    const url = n.img || n.style?.img || FALLBACK_ICON;
    return {
      ...n,
      type: "image",
      img: url,
      style: { ...(n.style || {}), img: url, width: n.style?.width ?? 40, height: n.style?.height ?? 40 },
    };
  });

  const bad = all.filter(n => !n.img);
  if (bad.length) console.warn("[g6] dropping nodes missing img:", bad.map(n => n.id));
  return all;
}, [assetNodes, externalStubNodes]);*/
const nodes = useMemo(() => [...assetNodes, ...externalStubNodes], [assetNodes, externalStubNodes]);


useEffect(() => {
  const imgNode = nodes.find(n => n.type === "image");
  if (!imgNode) {
    console.warn("[sanity] no image nodes in data");
    return;
  }
  const url = imgNode.style?.src || imgNode.style?.img;
  console.log("[sanity] first image node", { id: imgNode.id, url });

  // try loading the URL to catch 404/CORS quickly
  const probe = new Image();
  probe.onload = () => console.log("[sanity] image loads OK:", url);
  probe.onerror = () => console.error("[sanity] image FAILED to load:", url);
  probe.src = url;
}, [nodes]);

  const edges = useMemo(() => {
    const idset = new Set(nodes.map((n) => n.id));
    return links
      .filter((l) => idset.has(l.source) && idset.has(l.target))
      .map((l) => ({
        id: l.id,
        source: l.source,
        target: l.target,
        latency: l.lat, // attach metrics to edge model
        loss: l.loss,   // attach metrics to edge model
        label: `${l.lat} ms | ${l.loss}%`,
        style: { stroke: l.loss > 0.5 ? "#dc2626" : "#94a3b8", lineDash: l.loss > 0.5 ? [6, 6] : undefined, endArrow: true },
        labelCfg: { autoRotate: true, style: { fontSize: 11, fill: "#475569" } },
      }));
  }, [links, nodes]);

  const combos = useMemo(
    () => [
      { id: ZONE.External, label: "External", style: { fill: "#fef2f2", stroke: "#dc2626", fillOpacity: 0.6 } },
      { id: ZONE.DMZ, label: "DMZ / Perimeter", style: { fill: "#fff7ed", stroke: "#f59e0b", fillOpacity: 0.6 } },
      { id: ZONE.Clinical, label: "Clinical", style: { fill: "#eff6ff", stroke: "#2563eb", fillOpacity: 0.6 } },
      { id: ZONE.Admin, label: "Admin", style: { fill: "#f0fdf4", stroke: "#16a34a", fillOpacity: 0.6 } },
    ],
    []
  );
  
  

  // G6 lifecycle
  const topoRef = useRef(null);
  const [selected, setSelected] = useState(null);
  useG6Graph({ container: topoRef, nodes, edges, combos, onSelect: setSelected });
  
  // The asset the user clicked
const selectedAsset = useMemo(
  () => (selected?.kind === "node" ? assets.find(a => a.id === selected.id) : null),
  [selected, assets]
);

// Build the signals only when a node is selected
const decisionBundle = useMemo(() => {
  if (!selectedAsset) return null;

  const ctx = {
    nodes,    // <-- from your useMemo above
    edges,    // <-- from your useMemo above
    intel: {
      // optional future feeds:
      // kevSet: new Set(["CVE-2025-12345"]),
      // kevDueByCve: new Map([["CVE-2025-12345", "2025-10-21T23:59:59Z"]]),
      // epssByCve: new Map([["CVE-2025-12345", 0.81]]),
      // businessImpactById: new Map([[selectedAsset.id, 0.9]]),
    },
  };

  const { priority, explain } = scorePatchPriority(selectedAsset, ctx);
  const { cod, sev, dueAt, timeLeftDays } = costOfDelay(selectedAsset, 7, ctx);
  const windowRec = suggestNextWindow(selectedAsset, ctx);
  const duration  = estimatePatchDuration(selectedAsset, []); // pass history array if you have it
  const impact    = offlineImpact(nodes, edges, selectedAsset.id);
  const plan      = suggestPatchPlan(selectedAsset, { explain, timeLeftDays }, impact);

  return { priority, explain, cod7d: cod, sev, dueAt, timeLeftDays, windowRec, duration, impact, plan };
}, [selectedAsset, nodes, edges]);

const finalDecision = useMemo(
  () => (decisionBundle ? decide(selectedAsset, decisionBundle) : null),
  [decisionBundle, selectedAsset]
);

const story = useMemo(
  () => (decisionBundle ? explainForHumans(selectedAsset, decisionBundle, finalDecision) : null),
  [decisionBundle, finalDecision, selectedAsset]
);


  return (
    <div className="h-screen w-screen overflow-auto font-sans">
      <div className="p-4 max-w-[1440px] mx-auto">
        <h2 className="m-0 text-xl font-semibold">Security Ops — Hospital Topology (Icons)</h2>
        <div className="mt-1 mb-4 text-sm text-slate-600">Patch • CVSS • SLA • MTTD/MTTR • Alerts • Segmented Topology (External ↔ DMZ ↔ Clinical/Admin)</div>

        {/* KPIs */}
        <div className="grid grid-cols-6 gap-3">
          <KPI label={`Patch Compliance (≥${patch.targetPct}%)`} value={`${patch.compliancePct}%`} />
          <KPI label="Mean CVSS (0–10)" value={meanCvss} />
          <KPI label="Patch Backlog" value={backlog} />
          <KPI label="Patch ETA (days)" value={etaDays === Infinity ? "∞" : etaDays} />
          <KPI label="Availability (SLA, %)" value={`${availabilityPct}%`} />
          <KPI label="MTTD / MTTR (min)" value={`${MTTDmin} / ${MTTRmin}`} />
        </div>

        {/* What-if Controls */}
        <Card title="What-If Controls" className="mt-3">
          <div className="grid grid-cols-5 gap-3 items-center text-sm">
            <div>
              <label htmlFor="patchTarget" className="block font-semibold mb-1">Patch target ({Math.round(patchTarget * 100)}%)</label>
              <input id="patchTarget" type="range" min="0.7" max="0.98" step="0.01" value={patchTarget}
                onChange={(e) => setPatchTarget(parseFloat(e.target.value))} className="w-full" />
            </div>
            <div>
              <label htmlFor="patchThroughput" className="block font-semibold mb-1">Patch throughput ({patchThroughput}/day)</label>
              <input id="patchThroughput" type="range" min="1" max="30" step="1" value={patchThroughput}
                onChange={(e) => setPatchThroughput(parseInt(e.target.value))} className="w-full" />
            </div>
            <div>
              <label htmlFor="monthlyDowntime" className="block font-semibold mb-1">Monthly downtime ({monthlyDowntimeMin} min)</label>
              <input id="monthlyDowntime" type="range" min="0" max="300" step="1" value={monthlyDowntimeMin}
                onChange={(e) => setMonthlyDowntimeMin(parseInt(e.target.value))} className="w-full" />
            </div>
            <div>
              <label htmlFor="alertWindow" className="block font-semibold mb-1">Alerts window ({alertWindow}m)</label>
              <input id="alertWindow" type="range" min="15" max="240" step="5" value={alertWindow}
                onChange={(e) => setAlertWindow(parseInt(e.target.value))} className="w-full" />
            </div>
            <label className="inline-flex items-center gap-2 text-slate-700">
              <input type="checkbox" defaultChecked aria-label="Show risk overlay" />
              Show risk overlay (reserved)
            </label>
          </div>
        </Card>

        {/* Topology + Side panel */}
        <div className="grid grid-cols-[2fr_1fr] gap-3 mt-3">
          <Card title="Segmented Network Topology (External ↔ DMZ ↔ Clinical/Admin)">
            <div className="grid grid-cols-[3fr_1fr] gap-3">
              <div ref={topoRef} className="w-full h-[60vh] min-h-[360px] bg-white border border-slate-200 rounded-lg" />
              <div className="h-[60vh] min-h-[360px] border border-slate-200 rounded-lg p-3 bg-slate-50 overflow-y-auto text-sm">
                {!selected ? (
                  <>
                    <div className="font-extrabold mb-2">Legend</div>
                    <div className="font-bold mb-1.5">Zones</div>
                    <div><span className="inline-block w-3 h-3 bg-red-50 border border-red-600 mr-1.5" />External</div>
                    <div><span className="inline-block w-3 h-3 bg-orange-50 border border-orange-500 mr-1.5" />DMZ / Perimeter</div>
                    <div><span className="inline-block w-3 h-3 bg-blue-50 border border-blue-600 mr-1.5" />Clinical</div>
                    <div><span className="inline-block w-3 h-3 bg-green-50 border border-green-600 mr-1.5" />Admin</div>

                    <div className="font-bold mt-2 mb-1.5">Devices (icon)</div>
					<div className="grid grid-cols-2 gap-2">
					  {Object.entries(TYPE_ICON).map(([type, url]) => (
						<div key={type} className="flex items-center gap-2">
						  <img src={url} alt={type} width={16} height={16} style={{ display: "inline-block" }} />
						  <span>{type}</span>
						</div>
					  ))}
					</div>

                    <div className="font-bold mt-2 mb-1.5">Status (border)</div>
                    <div><span className="text-green-600">●</span> Healthy &nbsp; <span className="text-amber-500">●</span> Degraded &nbsp; <span className="text-red-600">●</span> Outage</div>

                    <div className="font-bold mt-2 mb-1.5">Links</div>
                    <div>Solid gray = normal • Dashed red = high loss</div>
                  </>
                ) : selected.kind === "node" ? (
                  <>
                    <div className="flex items-center justify-between"><div className="font-extrabold">Asset details</div>
                      <button onClick={() => setSelected(null)} className="border border-slate-200 rounded-md px-2 py-1 bg-white">Clear</button></div>
                    <div className="text-base font-extrabold mt-2">{selected.name}</div>
                    <div><b>Type:</b> {selected.type}</div>
                    <div><b>Zone:</b> {selected.zone}</div>
                    <div><b>Status:</b> {selected.status}</div>
                    <div><b>Patch:</b> {Math.round((selected.patch || 0) * 100)}%</div>
                    <div><b>CVSS:</b> {selected.vuln}</div>
                  {/* ⬇️ Decision agent’s plain-English output */}
					{story ? (
					  <div style={{ marginTop: 12 }}>
						<PlainExplainer story={story} />
					  </div>
					) : null}
				  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between"><div className="font-extrabold">Link details</div>
                      <button onClick={() => setSelected(null)} className="border border-slate-200 rounded-md px-2 py-1 bg-white">Clear</button></div>
                    <div className="mt-2"><b>From:</b> {selected.source}</div>
                    <div><b>To:</b> {selected.target}</div>
                    <div><b>Latency:</b> {selected.latency} ms</div>
                    <div><b>Loss:</b> {selected.loss}%</div>
                    <div className="mt-2 text-slate-500">Dashed + red edges indicate higher loss.</div>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Charts column */}
          <div className="grid grid-rows-3 gap-3">
            <Card title="Alert severity distribution"><SeverityBar data={severityCounts} /></Card>
            <Card title="Incidents per day (last 30d)"><IncidentsLine data={incidentsByDay} /></Card>
            <Card title="Non-compliant assets by type (Top 8)"><NonComplianceBar data={nonCompliantByType.slice(0, 8)} /></Card>
          </div>
        </div>

        {/* Patch priority table */}
        <Card title="Patch Priority (top 15 by CVSS then lowest patch %)" className="mt-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>{["Asset", "Type", "Zone", "CVSS", "Patch %", "Status"].map((h) => (
                <th key={h} className="text-left border-b border-slate-200 px-1.5 py-1">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {[...assets]
                .filter((a) => (a.patch ?? 0) < patchTarget)
                .sort((a, b) => d3.descending(a.vuln, b.vuln) || d3.ascending(a.patch, b.patch))
                .slice(0, 15)
                .map((a) => (
                  <tr key={a.id}>
                    <td className="px-1.5 py-1">{a.name}</td>
                    <td className="px-1.5 py-1">{a.type}</td>
                    <td className="px-1.5 py-1">{a.zone}</td>
                    <td className="px-1.5 py-1">{a.vuln}</td>
                    <td className="px-1.5 py-1">{Math.round((a.patch || 0) * 100)}%</td>
                    <td className="px-1.5 py-1">{a.status}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>

        {/* Recent alerts (windowed) */}
        <Card title={`Recent alerts (last ${alertCounts.windowMin}m)`} className="mt-3">
          <div className="mb-2 text-sm text-slate-700">
            Totals — <b>Critical:</b> {alertCounts.critical} &nbsp; <b>High:</b> {alertCounts.high} &nbsp; <b>Medium:</b> {alertCounts.medium} &nbsp; <b>Low:</b> {alertCounts.low}
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>{["Time", "Asset", "Title", "Severity"].map((h) => (
                <th key={h} className="text-left border-b border-slate-200 px-1.5 py-1">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {alerts
                .filter((a) => a.time >= Date.now() - alertWindow * 60000)
                .slice(-60)
                .reverse()
                .map((a) => (
                  <tr key={a.id}>
                    <td className="px-1.5 py-1">{new Date(a.time).toLocaleTimeString()}</td>
                    <td className="px-1.5 py-1">{a.assetId}</td>
                    <td className="px-1.5 py-1">{a.title}</td>
                    <td className="px-1.5 py-1" style={{ color: SEV_COLOR[a.severity] }}>{a.severity}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
