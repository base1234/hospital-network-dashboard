// ===============================
// File: src/decision/explain.js
// ===============================
const clamp01 = (x)=>Math.max(0,Math.min(1,x));
const pct = (x)=>`${Math.round(clamp01(x)*100)}%`;
const fmtMins = (m)=> (m>=60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`);

function sevWord(cvss){ if(cvss>=9) return "very serious"; if(cvss>=7) return "serious"; if(cvss>=4) return "moderate"; return "low"; }
function likelihoodWord(epss){ if(epss>=0.75) return "very likely to be exploited soon"; if(epss>=0.4) return "likely to be exploited"; if(epss>=0.1) return "could be exploited"; return "unlikely to be exploited"; }
function impactWord(bia){ if(bia>=0.8) return "critical to operations"; if(bia>=0.5) return "important to operations"; if(bia>=0.2) return "helpful but not critical"; return "low impact"; }
function topoWord(topo,isSpof,lost){ if(isSpof) return "removing it would break part of the network"; if(lost>0) return "it connects important parts of the network"; if(topo>=0.66) return "it sits in a busy part of the network"; if(topo>=0.33) return "it’s somewhat connected"; return "it’s on the edge of the network"; }

function actionWord(a){ if(a==="Patch Now (Emergency)") return "Patch now"; if(a==="Block") return "Do not patch yet"; return "Schedule patch"; }

export function explainForHumans(asset, bundle, finalDecision) {
  if (!asset || !bundle) return null;
  const ex = bundle.explain || {};
  const cvssBase = Number.isFinite(ex.cvssBase) ? ex.cvssBase : (asset.vuln ?? 0);
  const epss = clamp01(ex.epss ?? asset.epss ?? 0);
  const bia = clamp01(ex.bia ?? asset.businessImpact ?? 0.5);
  const isKev = !!ex.isKev;

  const severityText = sevWord(cvssBase);
  const likelihoodText = likelihoodWord(epss);
  const impactText = impactWord(bia);
  const topoText = topoWord(ex.topo ?? 0, bundle.impact?.isSpof, bundle.impact?.lostZoneBridges || 0);

  const headline = finalDecision?.action==="Block"
      ? `Do not patch ${asset.name} yet`
      : finalDecision?.action==="Patch Now (Emergency)"
      ? `Patch ${asset.name} now`
      : `Schedule patch for ${asset.name}`;

  const whenLine = finalDecision?.startAt
      ? `Start now and expect about ${fmtMins(bundle.duration?.p50 || 30)}.`
      : finalDecision?.when
      ? `Target window: ${finalDecision.when}. Estimated ${fmtMins(bundle.duration?.p50 || 30)} (up to ${fmtMins(bundle.duration?.p90 || 45)}).`
      : bundle.dueAt
      ? `Due by ${bundle.dueAt.toLocaleString()} (${Math.max(0, bundle.timeLeftDays)} days left).`
      : null;

  const why = [];
  why.push(`The issue is ${severityText} (technical score ${cvssBase}/10).`);
  if (isKev) why.push("It’s on the government’s known-exploited list.");
  why.push(`It is ${likelihoodText} (${pct(epss)} chance).`);
  why.push(`This device is ${impactText}.`);
  why.push(`In the network, ${topoText}.`);
  if (bundle.impact?.isSpof) {
    why.push("Taking it offline could split the network; use a failover plan.");
  } else if ((bundle.impact?.disconnected?.length || 0) > 0) {
    why.push(`If offline, about ${bundle.impact.disconnected.length} other device(s) could be isolated.`);
  }

  const how = [];
  if (bundle.plan?.method) {
    const map = {
      "HA-failover": "Switch traffic to the standby/peer, patch, then switch back.",
      "drain-and-patch": "Drain it from the load balancer, patch, verify, then return to service.",
      "replica-switchover": "Promote a replica, patch the primary, then rejoin.",
      "rolling": "Patch a small batch at a time to limit impact.",
      "standard": "Follow the standard maintenance steps.",
    };
    how.push(map[bundle.plan.method] || "Follow the standard maintenance steps.");
  }
  (bundle.plan?.steps || []).forEach(s => how.push(s));

  const riskLine =
    finalDecision?.action==="Block" ? "Risk of outage is too high right now. Prepare a safer plan first."
    : (bundle.plan?.risk==="high" || bundle.impact?.isSpof) ? "Risk is high; ensure backups, failover and a tested rollback."
    : (bundle.plan?.risk==="elevated") ? "Risk is elevated; notify stakeholders and ensure backups."
    : "Risk is manageable with the plan shown.";

  return { headline, action: actionWord(finalDecision?.action), when: whenLine, why, how, risk: riskLine };
}
