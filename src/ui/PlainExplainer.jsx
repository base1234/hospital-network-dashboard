// ===============================
// File: src/ui/PlainExplainer.jsx
// ===============================
/*import React from "react";

export default function PlainExplainer({ story }) {
  if (!story) return null;
  const box = { border:"1px solid #e2e8f0", borderRadius:8, padding:12, background:"#fff" };
  const pill = { display:"inline-block", border:"1px solid #cbd5e1", borderRadius:999, padding:"2px 8px", fontSize:12, color:"#334155", background:"#f8fafc" };

  return (
    <div style={box}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
        <div style={{fontWeight:800}}>{story.headline}</div>
        <span style={pill}>{story.action}</span>
      </div>

      {story.when && <div style={{margin:"6px 0 10px", color:"#334155"}}>{story.when}</div>}

      <div style={{marginBottom:8}}>
        <div style={{fontWeight:700, marginBottom:4}}>Why this decision</div>
        <ul style={{margin:"0 0 8px 16px", padding:0}}>
          {story.why.map((t,i)=>(<li key={i} style={{marginBottom:2}}>{t}</li>))}
        </ul>
      </div>

      <div style={{marginBottom:8}}>
        <div style={{fontWeight:700, marginBottom:4}}>How to carry it out</div>
        <ol style={{margin:"0 0 8px 16px", padding:0}}>
          {story.how.map((t,i)=>(<li key={i} style={{marginBottom:2}}>{t}</li>))}
        </ol>
      </div>

      <div style={{color:"#475569"}}>{story.risk}</div>
    </div>
  );
}*/

// ===============================
// File: src/ui/PlainExplainer.jsx
// ===============================
import React from "react";

const Badge = ({ label, tone = "slate" }) => {
  const bg = {
    green:  "#ecfdf5",  // success
    amber:  "#fffbeb",  // warning
    red:    "#fef2f2",  // danger
    blue:   "#eff6ff",  // info
    slate:  "#f8fafc",
  }[tone] || "#f8fafc";

  const brd = {
    green:  "#10b981",
    amber:  "#f59e0b",
    red:    "#ef4444",
    blue:   "#3b82f6",
    slate:  "#94a3b8",
  }[tone] || "#94a3b8";

  return (
    <span style={{
      display:"inline-block", padding:"2px 8px", borderRadius:999,
      border:`1px solid ${brd}`, background:bg, color:"#0f172a",
      fontSize:21, fontWeight:600
    }}>
      {label}
    </span>
  );
};

const Meter = ({ value = 0, max = 100, tone = "green", label }) => {
  const color = { green:"#10b981", amber:"#f59e0b", red:"#ef4444", blue:"#3b82f6" }[tone] || "#64748b";
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ margin:"4px 0" }}>
      {label ? <div style={{ fontSize:12, color:"#475569", marginBottom:2 }}>{label}</div> : null}
      <div style={{ height:8, borderRadius:8, background:"#e5e7eb", overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color }} />
      </div>
    </div>
  );
};

export default function PlainExplainer({ story, details }) {
  if (!story) return null;

  const box = {
    border:"1px solid #e2e8f0", borderRadius:10, padding:12,
    background:"#ffffff", boxShadow:"0 1px 2px rgba(0,0,0,0.04)"
  };

  const row = { display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" };
  const small = { fontSize:21, color:"#475569" };

  const p = details || {};
  // Derive tones from priority
  const pr = (p.priority || "").toLowerCase();
  const prTone = pr.includes("critical") ? "red" : pr.includes("high") ? "amber" : pr.includes("medium") ? "blue" : "green";

  return (
    <div style={box}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontWeight:800 }}>{story.headline}</div>
        <Badge label={story.action} tone={prTone} />
      </div>

      {/* When */}
      {story.when && <div style={{ margin:"4px 0 10px", color:"#334155" }}>{story.when}</div>}

      {/* Quick facts / badges */}
      <div style={{ ...row, marginBottom:8 }}>
        {p.priority && <Badge label={`Priority: ${p.priority}`} tone={prTone} />}
        {typeof p.score === "number" && <Badge label={`Score: ${p.score.toFixed(1)}`} tone="blue" />}
        {p.window && <Badge label={`Window: ${p.window}`} tone="slate" />}
        {typeof p.duration === "number" && <Badge label={`Duration: ~${p.duration} min`} tone="slate" />}
        {p.dueAt && <Badge label={`Due by: ${new Date(p.dueAt).toLocaleString()}`} tone="amber" />}
        {typeof p.timeLeftDays === "number" && <Badge label={`${Math.max(0, Math.round(p.timeLeftDays))}d left`} tone={p.timeLeftDays < 2 ? "red" : "amber"} />}
      </div>

      {/* Why */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontWeight:700, marginBottom:4 }}>Why this decision</div>
        <ul style={{ margin:"0 0 8px 16px", padding:0 }}>
          {story.why?.map((t,i)=>(<li key={i} style={{ marginBottom:2 }}>{t}</li>))}
        </ul>
      </div>

      {/* Impact snapshot (simple) */}
      {(p.impact?.outageCount >= 0 || p.impact?.cutEdges >= 0) && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontWeight:700, marginBottom:4 }}>If taken offline (estimated impact)</div>
          <div style={small}>
            {typeof p.impact?.outageCount === "number" && <div>Dependent devices losing service: <b>{p.impact.outageCount}</b></div>}
            {typeof p.impact?.cutEdges === "number" && <div>Links interrupted: <b>{p.impact.cutEdges}</b></div>}
          </div>
          {/* A little “risk bar” if we have severity 0–1 */}
          {typeof p.sev === "number" && <Meter value={Math.round(p.sev*100)} max={100} tone={p.sev > 0.66 ? "red" : p.sev > 0.33 ? "amber" : "green"} label="Overall risk (normalized)" />}
        </div>
      )}

      {/* Plan */}
      {Array.isArray(p.plan?.steps) && p.plan.steps.length > 0 && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontWeight:700, marginBottom:4 }}>How to carry it out</div>
          <ol style={{ margin:"0 0 8px 16px", padding:0 }}>
            {p.plan.steps.map((t,i)=>(<li key={i} style={{ marginBottom:2 }}>{t}</li>))}
          </ol>
          {p.plan.notes && <div style={small}>{p.plan.notes}</div>}
        </div>
      )}

      {/* Layman-friendly risk summary */}
      {story.risk && <div style={{ ...small, lineHeight:1.35 }}>{story.risk}</div>}
    </div>
  );
}


