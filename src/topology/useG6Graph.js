// ===============================
// File: src/topology/useG6Graph.js
// ===============================
import { useEffect, useRef } from "react";
import { Graph } from "@antv/g6";
import { FALLBACK_ICON } from "./icons.js";

const statusColor = (s) => (s === "outage" ? "#dc2626" : s === "degraded" ? "#f59e0b" : "#16a34a");
const urlFromNode = (n) => {
  const s = n?.style || {};
  return (typeof s.src === "string" && s.src) || (typeof s.img === "string" && s.img) || FALLBACK_ICON;
};

export function useG6Graph({ container, nodes, edges, combos, onSelect }) {
  const graphRef = useRef(null);
  const roRef = useRef(null);
  const latestNodesRef = useRef([]);
  latestNodesRef.current = nodes || [];

  // --- create once ---
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
      modes: { default: ["drag-element", "drag-node", "drag-canvas", "zoom-canvas"] },
      defaultNode: {
        type: "image",
        style: { src: FALLBACK_ICON, img: FALLBACK_ICON, width: 40, height: 40, cursor: "pointer" },
      },
      defaultEdge: { style: { endArrow: true, stroke: "#94a3b8" } },
      defaultCombo: { type: "rect", padding: 16, style: { fill: "#f8fafc", stroke: "#CBD5E1", fillOpacity: 0.6 } },
    });

    graphRef.current = graph;

    // ---------- picking helpers ----------
    // Make combo shapes non-pickable so they don’t swallow clicks
    const disableComboPicking = () => {
      const g = graphRef.current; if (!g || g.destroyed) return;
      for (const combo of g.getCombos?.() || []) {
        combo.getContainer?.()?.attr?.({ pointerEvents: "none" });
        combo.getKeyShape?.()?.attr?.({ pointerEvents: "none" });
      }
    };

    // Robust node id extraction across renderers
    const getClickedNodeId = (evt) => {
      // 1) some renderers attach data here
      const idFromData = evt?.data?.id || evt?.data?.data?.id;
      if (idFromData) return idFromData;

      // 2) sometimes target carries an id
      const idFromTarget = evt?.target?.id || evt?.delegateObject?.id;
      if (idFromTarget) return idFromTarget;

      // 3) last resort: do a hit-test at the click point
      const { canvasX, canvasY } = evt || {};
      const g = graphRef.current;
      if (!g || g.destroyed || canvasX == null) return null;
      const candidates = g.getNodes?.() || [];
      for (const item of candidates) {
        if (item?.isPointInPath?.({ x: canvasX, y: canvasY })) {
          // item.id is stable in v5
          return item.id || item.getID?.();
        }
      }
      return null;
    };

    // Unified click: prefer node, then edge, else canvas
    graph.on("click", (evt) => {
      const g = graphRef.current; if (!g || g.destroyed) return;

      // try node first
      const nodeId = getClickedNodeId(evt);
      if (nodeId) {
        const d = latestNodesRef.current.find((n) => n.id === nodeId) || {};
        onSelect?.({
          kind: "node",
          id: d.id,
          name: d.label,
          type: d.deviceType,
          zone: d.comboId,
          vuln: d.vuln,
          patch: d.patch,
          status: d.status,
        });
        return;
      }

      // try edge (simple nearest match by isPointInPath if available)
      const { canvasX, canvasY } = evt || {};
      if (canvasX != null) {
        for (const e of g.getEdges?.() || []) {
          if (e?.isPointInPath?.({ x: canvasX, y: canvasY })) {
            const m = e.getData?.() || e.getModel?.() || {};
            onSelect?.({
              kind: "edge",
              id: m.id,
              source: m.source,
              target: m.target,
              latency: m.latency,
              loss: m.loss,
            });
            return;
          }
        }
      }

      // canvas
      onSelect?.(null);
    });

    // Fit & disable combo pick after render/layout
    const fit = () => {
      const g = graphRef.current;
      if (!g || g.destroyed) return;
      try { g.fitView?.(60); g.fitCenter?.(); } catch {}
    };
    graph.on("afterrender", () => { fit(); disableComboPicking(); });
    graph.on("afterlayout", () => { fit(); disableComboPicking(); });

    // Resize
    const ro = new ResizeObserver(([entry]) => {
      const g = graphRef.current;
      if (!g || g.destroyed) return;
      const { width, height } = entry.contentRect;
      if (width && height) (g.setSize || g.changeSize)?.call(g, width, height);
    });
    ro.observe(el);
    roRef.current = ro;

    return () => {
      try { ro.disconnect(); } catch {}
      try { graph.destroy?.(); } catch {}
      graphRef.current = null;
      roRef.current = null;
    };
  }, [container, onSelect]);

  // --- update data & decorate ---
  useEffect(() => {
    const g = graphRef.current;
    if (!g || g.destroyed) return;

    // Normalize image nodes (ensure both src & img)
    const normalizedNodes = (nodes || [])
      .filter(Boolean)
      .map((n) => {
        if (n.type !== "image") return n;
        const url = urlFromNode(n);
        return {
          ...n,
          src: url,
          img: url,
          style: { ...(n.style || {}), src: url, img: url, width: n.style?.width ?? 40, height: n.style?.height ?? 40, cursor: "pointer" },
        };
      });

    // Filter invalid edges
    const idset = new Set(normalizedNodes.map((n) => n.id));
    const normalizedEdges = (edges || []).filter((e) => idset.has(e.source) && idset.has(e.target));

    // Render
    g.setData?.({ nodes: normalizedNodes, edges: normalizedEdges, combos: combos || [] });
    g.render?.();

    // Add hit-area + status ring to each node
    for (const item of g.getNodes?.() || []) {
      const m = item.getData?.() || item.getModel?.() || {};
      const group = item.getContainer?.();
      if (!group) continue;

      // clickable hit-area (must have fill for pointerEvents to work)
      const w = m.style?.width ?? 40;
      const h = m.style?.height ?? 40;
      const r = Math.max(w, h) / 2 + 6;

      let hit = group.find((el) => el.get?.("name") === "hit-area");
      if (!hit) {
        hit = group.addShape("circle", {
          name: "hit-area",
          attrs: { x: 0, y: 0, r, fill: "rgba(0,0,0,0.001)", stroke: null, pointerEvents: "fill", cursor: "pointer" },
        });
        hit.set?.("zIndex", 4);
      } else {
        hit.attr({ r });
      }

      // status ring (non-pickable)
      const ringColor = statusColor(m.status);
      let ring = group.find((el) => el.get?.("name") === "status-ring");
      if (!ring) {
        ring = group.addShape("circle", {
          name: "status-ring",
          attrs: { x: 0, y: 0, r: r - 3, fill: null, stroke: ringColor, lineWidth: 2, pointerEvents: "none" },
        });
        ring.set?.("zIndex", 10);
      } else {
        ring.attr({ r: r - 3, stroke: ringColor });
      }

      group.sort?.();
    }

    g.paint?.();
  }, [nodes, edges, combos]);
}
