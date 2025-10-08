// ===============================
// File: src/decision/decide.js
// ===============================
export function decide(asset, signals) {
  const { priority, timeLeftDays, dueAt, windowRec, duration, impact, plan, explain } = signals;

  if (impact.isSpof && plan.method !== "HA-failover") {
    return {
      action: "Block",
      reason: "SPOF without HA path",
      required: ["Provision/validate HA peer", "Document rollback"],
    };
  }

  const kevUrgent = !!explain?.isKev && (timeLeftDays <= 3);
  const overdue = timeLeftDays <= 0;
  if (kevUrgent || overdue || priority === "Emergency") {
    return {
      action: "Patch Now (Emergency)",
      startAt: new Date(),
      method: plan.method,
      estMinutes: duration.p50,
      notes: [`Due ${dueAt.toLocaleString()}`, kevUrgent ? "KEV item" : "SLA overdue"],
      prechecks: ["Backup/Snapshot", "Peer/LB drain ready", "Change comms sent"],
      steps: plan.steps,
    };
  }

  if (!windowRec) {
    return {
      action: "Schedule",
      reason: "No active maintenance window",
      todo: ["Pick next window", "Line up approvals"],
    };
  }
  const windowMinutes = (windowRec.end - windowRec.start) / 60000;
  const fits = duration.p90 <= windowMinutes;

  return {
    action: fits ? "Schedule" : "Schedule (Different Window)",
    when: windowRec.label,
    method: plan.method,
    estMinutes: duration.p50,
    capacity: { required: duration.p90, window: Math.round(windowMinutes) },
    notes: [`Priority=${priority}`, `Days left=${timeLeftDays}`],
    prechecks: ["Backup/Snapshot", "Rollback defined", "Stakeholders notified"],
    steps: plan.steps,
  };
}
