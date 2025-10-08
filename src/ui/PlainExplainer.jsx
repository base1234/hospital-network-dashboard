// ===============================
// File: src/ui/PlainExplainer.jsx
// ===============================
import React from "react";

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
}
