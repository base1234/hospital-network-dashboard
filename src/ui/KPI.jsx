// ===============================
// File: src/ui/KPI.jsx
// ===============================
import React from "react";
export default function KPI({ label, value, color }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
    </div>
  );
}