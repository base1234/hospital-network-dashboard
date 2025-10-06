// ===============================
// File: src/mockData.js
// ===============================
import * as d3 from "d3";
import { TYPE, ZONE, STATUS, SEV, clamp } from "./domain";

const rngSeed = (s) => d3.randomLcg(s);
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

export function genAssets(N = 42, seed = 2025) {
  const r = rngSeed(seed), types = Object.values(TYPE);
  return Array.from({ length: N }, (_, i) => {
    const type = types[Math.floor(r() * types.length)];

    const zone = [TYPE.Firewall, TYPE.Router, TYPE.Switch, TYPE.WiFiAP].includes(type)
      ? ZONE.DMZ
      : type === TYPE.Workstation
      ? ZONE.Admin
      : r() < 0.65
      ? ZONE.Clinical
      : ZONE.Admin;

    const id = `${type.slice(0, 2).toLowerCase()}${String(i).padStart(2, "0")}`;
    const status = r() < 0.05 ? STATUS.outage : r() < 0.22 ? STATUS.degraded : STATUS.healthy;
    const vuln = +(r() * 10).toFixed(1);

    const basePatch =
      type === TYPE.IoMT ? 0.75 : [TYPE.Database, TYPE.Server, TYPE.EHR].includes(type) ? 0.82 : type === TYPE.Workstation ? 0.78 : 0.86;

    const patch = +(clamp(basePatch + (r() - 0.5) * 0.3, 0, 1)).toFixed(2);
    const net = Math.round(([TYPE.Router, TYPE.Switch].includes(type) ? 900 : type === TYPE.Workstation ? 40 : 300) + r() * 800);

    return { id, name: `${type} ${i}`, type, zone, status, vuln, patch, net };
  });
}

export function genLinks(assets, seed = 2026) {
  const r = rngSeed(seed);
  const ids = (z) => assets.filter((a) => String(a.zone).startsWith(z)).map((a) => a.id);
  const zones = { Clinical: ids("Clinical"), Admin: ids("Admin"), DMZ: ids("DMZ"), External: [] };
  const fws = assets.filter((a) => a.type === TYPE.Firewall).map((a) => a.id);

  const seen = new Set();
  const add = (a, b) => {
    if (!a || !b || a === b) return null;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`; if (seen.has(key)) return null; seen.add(key);
    const lat = Math.round(4 + r() * 16);
    const loss = +(clamp(0.1 + r() * 0.6, 0, 5)).toFixed(2);
    return { id: `L_${key}`, source: a, target: b, lat, loss };
  };
  const links = [];

  const connectWithin = (arr) => { for (let i = 1; i < arr.length; i++) { const e = add(arr[i], arr[Math.floor(r() * i)]); if (e) links.push(e); } };
  connectWithin(zones.Clinical);
  connectWithin(zones.Admin);
  connectWithin(zones.DMZ);

  const fwFallback = fws[0] || pick(r, zones.DMZ) || pick(r, zones.Clinical) || pick(r, zones.Admin);
  for (let i = 0; i < Math.max(4, Math.round(assets.length * 0.15)); i++) {
    const e = add(`ext${i}`, fwFallback);
    if (e) links.push(e);
  }

  for (const z of [zones.Clinical, zones.Admin]) {
    for (let k = 0; k < Math.max(1, Math.round(z.length * 0.2)); k++) {
      const e = add(pick(r, z), pick(r, fws) || fwFallback);
      if (e) links.push(e);
    }
  }
  return links;
}

export function genIncidents(assets, days = 30, seed = 2027) {
  const r = rngSeed(seed);
  const now = Date.now(), start = now - days * 86400000;
  const N = Math.floor(40 + r() * 40);
  const out = [];
  for (let i = 0; i < N; i++) {
    const created = start + Math.floor(r() * (now - start));
    const detectLagMin = 5 + r() * 240, respondLagMin = 20 + r() * 720;
    out.push({
      id: `I${i}`,
      created,
      detected: created + detectLagMin * 60000,
      responded: created + (detectLagMin + respondLagMin) * 60000,
      severity: SEV[Math.floor(r() * 4)],
      assetId: assets[Math.floor(r() * assets.length)].id,
      title: `Incident ${i}`,
    });
  }
  return out.sort((a, b) => a.created - b.created);
}

export function genAlerts(assets, minutes = 180, seed = 2028) {
  const r = rngSeed(seed);
  const now = Date.now(), start = now - minutes * 60000;
  const N = Math.floor(250 + r() * 150);
  const out = [];
  for (let i = 0; i < N; i++) {
    const t = start + Math.floor(r() * (now - start));
    out.push({ id: `A${i}`, time: t, severity: SEV[Math.floor(r() * 4)], assetId: assets[Math.floor(r() * assets.length)].id, title: `Alert ${i}` });
  }
  return out.sort((a, b) => a.time - b.time);
}
