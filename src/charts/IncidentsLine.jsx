// ===============================
// File: src/charts/IncidentsLine.jsx
// ===============================
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function IncidentsLine({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    const svg = d3.select(node);
    const w = node.clientWidth || 360, h = 220, m = { t: 10, r: 10, b: 36, l: 52 };
    svg.attr("viewBox", `0 0 ${w} ${h}`).selectAll("*").remove();
    const x = d3.scaleTime().domain(d3.extent(data, (d) => new Date(d.t)) || [new Date(), new Date()]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.c) || 1]).nice().range([h - m.b, m.t]);
    const g = svg.append("g");
    g.append("g").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%b %d")));
    g.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5));
    const line = d3.line().x((d) => x(new Date(d.t))).y((d) => y(d.c)).curve(d3.curveMonotoneX);
    g.append("path").datum(data).attr("fill", "none").attr("stroke", "currentColor").attr("stroke-width", 2).attr("d", line);
    g.append("text").attr("transform", `translate(${m.l - 44},${(h - m.b + m.t) / 2}) rotate(-90)`).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#475569").text("# Incidents / day");
  }, [data]);
  return <svg ref={ref} className="w-full h-[220px]" />;
}