// ===============================
// File: src/charts/SeverityBar.jsx
// ===============================
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { SEV, SEV_COLOR } from "../domain";

export default function SeverityBar({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const svg = d3.select(node);
    const w = node.clientWidth || 360, h = 220, m = { t: 10, r: 10, b: 36, l: 48 };
    svg.attr("viewBox", `0 0 ${w} ${h}`).selectAll("*").remove();
    const x = d3.scaleBand().domain(SEV).range([m.l, w - m.r]).padding(0.25);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.c) || 1]).nice().range([h - m.b, m.t]);
    const g = svg.append("g");
    g.append("g").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x));
    g.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5));
    g.selectAll("rect").data(data).enter().append("rect")
      .attr("x", (d) => x(d.sev))
      .attr("y", (d) => y(d.c))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h - m.b - y(d.c))
      .attr("fill", (d) => SEV_COLOR[d.sev] || "#94a3b8");
    g.append("text").attr("x", m.l - 40).attr("y", m.t - 4).attr("font-size", 12).attr("fill", "#475569").text("# Alerts");
    g.append("text").attr("x", (m.l + (w - m.r)) / 2).attr("y", h - 6).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#475569").text("Severity");
  }, [data]);
  return <svg ref={ref} className="w-full h-[220px]" />;
}
