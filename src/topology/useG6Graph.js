// ===============================
// File: src/topology/useG6Graph.js
// ===============================
import { useEffect, useRef } from "react";
import { Graph } from "@antv/g6";
import { FALLBACK_ICON } from "./icons.js";

const statusColor = (s) => (s === "outage" ? "#dc2626" : s === "degraded" ? "#f59e0b" : "#16a34a");

export function useG6Graph({ container, nodes, edges, combos, onSelect }) {
  const graphRef = useRef(null);
  const roRef = useRef(null);

  // create once
  useEffect(() => {
    const el = container.current;
    if (!el || graphRef.current) return;

    const rect = el.getBoundingClientRect();
    const graph = new Graph({
      container: el,
      width: rect.width || el.clientWidth || 960,
      height: rect.height || el.clientHeight || 520,
      pixelRatio: window.devicePixelRatio || 1,
      layout: { type: "force", preventOverlap: true, nodeStrength: 140, linkDistance: 100 },
      modes: { default: ["drag-node", "zoom-canvas", "drag-canvas"] },
      defaultNode: {
      type: "image",
      // set BOTH src and img for compatibility
      style: { src: FALLBACK_ICON, img: FALLBACK_ICON, width: 40, height: 40 },
    },
      defaultEdge: { style: { endArrow: true, stroke: "#94a3b8" } },
      defaultCombo: { type: "rect", padding: 16, style: { fill: "#f8fafc", stroke: "#CBD5E1", fillOpacity: 0.6 } },
    });
	
	

    // events
    graph.on("node:click", (evt) => {
      const m = evt.item?.getModel?.();
      if (!m) return;
      onSelect?.({ kind: "node", id: m.id, name: m.label, type: m.deviceType, zone: m.comboId, vuln: m.vuln, patch: m.patch, status: m.status });
    });
    graph.on("edge:click", (evt) => {
      const m = evt.item?.getModel?.();
      if (!m) return;
      onSelect?.({ kind: "edge", id: m.id, source: m.source, target: m.target, latency: m.latency, loss: m.loss });
    });
    graph.on("canvas:click", () => onSelect?.(null));

    // resize
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) (graph.setSize || graph.changeSize)?.call(graph, width, height);
    });
    ro.observe(el);

    graphRef.current = graph;
    roRef.current = ro;

    return () => {
      try { ro.disconnect(); } catch {}
      try { graph.destroy?.(); } catch {}
      roRef.current = null;
      graphRef.current = null;
    };
  }, [container, onSelect]);

  // update data
   // --- update data effect ---
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || graph.destroyed) return;

    const safeNodes = (nodes || []).map((n) => {
      if (!n) return n;
      if (n.type === "image") {
        const url = n.style?.src || n.style?.img || FALLBACK_ICON;
        return {
          ...n,
          // top-level (harmless), some examples still set these:
          src: url,
          img: url,
          style: {
            ...(n.style || {}),
            src: url,     // <- important for your build
            img: url,     // <- keeps older examples happy
            width: n.style?.width ?? 40,
            height: n.style?.height ?? 40,
          },
        };
      }
      return n; // shapes are fine
    }).filter(Boolean);

    graph.setData({ nodes: safeNodes, edges: edges || [], combos: combos || [] });
    graph.render?.();
	const first = (graph.getNodes?.() || [])[0];
console.log("[g6] first node model:", first?.getModel?.());
    //graph.fitView?.(20);

    // draw status rings
    for (const item of graph.getNodes?.() || []) {
      const m = item.getModel?.() || {};
      const g = item.getContainer?.();
      if (!g) continue;
      const bbox = g.getBBox?.() || { width: 40, height: 40 };
      const r = Math.max(bbox.width, bbox.height) / 2 + 3;
      const color = statusColor(m.status);
      let ring = g.find((el) => el.get("name") === "status-ring");
      if (!ring) {
        ring = g.addShape("circle", { name: "status-ring", attrs: { x: 0, y: 0, r, fill: null, stroke: color, lineWidth: 2 } });
        ring.set?.("zIndex", 10);
        g.sort?.();
      } else {
        ring.attr({ r, stroke: color });
      }
    }
    graph.paint?.();
  }, [nodes, edges, combos]);
}
