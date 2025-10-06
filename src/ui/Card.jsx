// ===============================
// File: src/ui/Card.jsx
// ===============================
import React from "react";
export default function Card({ title, children, right, className }) {
  return (
    <div className={`border border-slate-200 rounded-xl p-3 ${className || ""}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="font-bold">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}