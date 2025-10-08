// ===============================
// File: src/decision/duration.js
// ===============================
const BASELINE = {
  Firewall:      { p50: 35, p90: 50 },
  Router:        { p50: 30, p90: 45 },
  Switch:        { p50: 25, p90: 40 },
  Server:        { p50: 25, p90: 40 },
  Database:      { p50: 40, p90: 60 },
  "HL7 Engine":  { p50: 35, p90: 55 },
  PACS:          { p50: 35, p90: 55 },
  EHR:           { p50: 40, p90: 65 },
  "Medical IoT": { p50: 20, p90: 35 },
  "WiFi AP":     { p50: 20, p90: 35 },
  Workstation:   { p50: 15, p90: 25 },
};

function median(a){ if(!a?.length) return 0; const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }
function pctl(a,p){ if(!a?.length) return 0; const s=[...a].sort((x,y)=>x-y); const i=Math.min(s.length-1, Math.max(0, Math.round((p/100)*(s.length-1)))); return s[i]; }

export function estimatePatchDuration(asset, history = []) {
  const base = BASELINE[asset.type] || { p50: 30, p90: 45 };
  if (!history.length) return { ...base, breakdown: ["Prep 5m","Apply 10-20m","Reboot/Verify 5-15m"] };

  const mins = history.filter(x => Number.isFinite(x) && x > 0);
  if (!mins.length) return { ...base, breakdown: ["Prep 5m","Apply 10-20m","Reboot/Verify 5-15m"] };

  const p50 = Math.round(median(mins));
  const p90 = Math.round(pctl(mins, 90));
  return { p50, p90, breakdown: ["Derived from historical patches"] };
}
