// ===============================
// File: src/charts/NonComplianceBar.jsx
// ===============================
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function NonComplianceBar({ data }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const svg = d3.select(node);
    const w = node.clientWidth || 360;
    const h = 240;
    const m = { t: 14, r: 20, b: 36, l: 120 }; // extra left space for labels

    svg.attr("viewBox", `0 0 ${w} ${h}`).selectAll("*").remove();

    const max = d3.max(data, d => d.non) || 1;

    // Horizontal layout: x = value scale, y = band of categories
    const x = d3.scaleLinear().domain([0, max]).nice().range([m.l, w - m.r]);
    const y = d3
      .scaleBand()
      .domain(data.map(d => d.type))
      .range([m.t, h - m.b])
      .padding(0.25);

    const g = svg.append("g");

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${h - m.b})`)
      .call(d3.axisBottom(x).ticks(5));

    g.append("g")
      .attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).tickSize(0))
      .selectAll("text")
      .style("font-size", "11px");

    // Bars
    g.selectAll("rect.bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", x(0))
      .attr("y", d => y(d.type))
      .attr("width", d => Math.max(0, x(d.non) - x(0)))
      .attr("height", y.bandwidth())
      .attr("fill", "#dc2626");

    // Value labels at end of bars
    g.selectAll("text.label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", d => x(d.non) + 6)
      .attr("y", d => y(d.type) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .attr("font-size", 12)
      .attr("fill", "#334155")
      .text(d => d.non);

    // Axis titles
    svg
      .append("text")
      .attr("x", (m.l + (w - m.r)) / 2)
      .attr("y", h - 4)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#475569")
      .text("# Non-compliant assets");

    svg
      .append("text")
      .attr("transform", `translate(${m.l - 60}, ${(m.t + (h - m.b)) / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#475569")
      .text("Device type");
  }, [data]);

  return <svg ref={ref} className="w-full h-[240px]" />;
}
