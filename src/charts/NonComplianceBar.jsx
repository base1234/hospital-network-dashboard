// ===============================
// File: src/charts/NonComplianceBar.jsx
// ===============================
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function NonComplianceBar({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    const svg = d3.select(node);
    const w = node.clientWidth || 360, h = 240, m = { t: 14, r: 10, b: 48, l: 60 };
    svg.attr("viewBox", `0 0 ${w} ${h}`).selectAll("*").remove();
    const x = d3.scaleBand().domain(data.map((d) => d.type)).range([m.l, w - m.r]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.non) || 1]).nice().range([h - m.b, m.t]);
    const g = svg.append("g");
    g.append("g").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x)).selectAll("text").style("font-size", "11px");
    g.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5));
    g.selectAll("rect").data(data).enter().append("rect")
      .attr("x", (d) => x(d.type))
      .attr("y", (d) => y(d.non))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h - m.b - y(d.non))
      .attr("fill", "#dc2626");
    g.selectAll("text.label").data(data).enter().append("text")
      .attr("x", (d) => x(d.type) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.non) - 6)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#334155")
      .text((d) => d.non);
    svg.append("text").attr("x", w / 2).attr("y", h - 4).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#475569").text("Device type");
    svg.append("text").attr("transform", `translate(${m.l - 44},${h / 2}) rotate(-90)`).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#475569").text("# Non-compliant assets");
  }, [data]);
  return <svg ref={ref} className="w-full h-[240px]" />;
}