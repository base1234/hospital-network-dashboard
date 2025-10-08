// ===============================
// File: src/decision/plan.js
// ===============================
const isNet = (t) => /(Firewall|Router|Switch)/i.test(t);
const isDB  = (t) => /(Database)/i.test(t);
const isSrv = (t) => /(Server|EHR|HL7|PACS)/i.test(t);
const isEdge= (t) => /(WiFi AP|Workstation|Medical IoT)/i.test(t);

export function suggestPatchPlan(asset, decision, impact) {
  const recs = [];
  let method = "standard";
  let risk = "normal";

  const urgent = decision?.explain?.isKev || (decision?.timeLeftDays != null && decision.timeLeftDays <= 0);

  if (isNet(asset.type)) {
    if (impact.isSpof) {
      method = "HA-failover"; risk = "high";
      recs.push("Ensure an HA peer is healthy and in-sync.");
      recs.push("Fail traffic to peer; patch passive; verify; reverse roles; patch second.");
    } else {
      method = "rolling";
      recs.push("Drain/reroute adjacent links; patch; restore.");
    }
  } else if (isDB(asset.type)) {
    method = "replica-switchover";
    recs.push("Confirm recent backup/snapshot.");
    recs.push("Promote replica / switch primary; patch old primary; rejoin.");
  } else if (isSrv(asset.type)) {
    method = "drain-and-patch";
    recs.push("Remove from LB / drain sessions; patch; health-check; re-add.");
  } else if (isEdge(asset.type)) {
    method = "rolling";
    recs.push("Patch in small batches to limit client impact.");
  } else {
    recs.push("Follow standard maintenance SOP for this class.");
  }

  if (urgent) recs.push("Treat as emergency change if no near-term window exists (document variance).");

  if (impact.disconnected?.length > 0 || (impact.lostZoneBridges||0) > 0) {
    risk = "elevated";
    recs.push(`Taking offline could isolate ${impact.disconnected.length} device(s) and break ${impact.lostZoneBridges} zone bridge(s).`);
  }

  return { method, risk, steps: recs };
}
