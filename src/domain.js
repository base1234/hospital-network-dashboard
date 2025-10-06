// ===============================
// File: src/domain.js
// ===============================
export const TYPE = {
  Firewall: "Firewall",
  Router: "Router",
  Switch: "Switch",
  Server: "Server",
  Database: "Database",
  Workstation: "Workstation",
  EHR: "EHR",
  PACS: "PACS",
  HL7: "HL7 Engine",
  IoMT: "Medical IoT",
  WiFiAP: "WiFi AP",
};

export const ZONE = { External: "External", DMZ: "DMZ / Perimeter", Clinical: "Clinical", Admin: "Admin" };
export const STATUS = { healthy: "healthy", degraded: "degraded", outage: "outage" };
export const SEV = ["low", "medium", "high", "critical"];
export const SEV_COLOR = { low: "#64748b", medium: "#0ea5e9", high: "#f59e0b", critical: "#dc2626" };

export const BUILTIN_NODE_TYPES = new Set([
  "circle", "rect", "ellipse", "diamond", "triangle", "star", "donut", "hexagon",
]);

export const SHAPE_MAP = {
  [TYPE.Firewall]: "rect",
  [TYPE.Router]: "diamond",
  [TYPE.Switch]: "triangle",
  [TYPE.Server]: "star",
  [TYPE.Database]: "ellipse",
  [TYPE.Workstation]: "circle",
  [TYPE.EHR]: "circle",
  [TYPE.PACS]: "triangle",
  [TYPE.HL7]: "rect",
  [TYPE.IoMT]: "hexagon",
  [TYPE.WiFiAP]: "donut",
};

export const COLOR = {
  [TYPE.Firewall]: "#f97316",
  [TYPE.Router]: "#2563eb",
  [TYPE.Switch]: "#0891b2",
  [TYPE.Server]: "#16a34a",
  [TYPE.Database]: "#0ea5e9",
  [TYPE.Workstation]: "#7c3aed",
  [TYPE.EHR]: "#d946ef",
  [TYPE.PACS]: "#22c55e",
  [TYPE.HL7]: "#ea580c",
  [TYPE.IoMT]: "#0ea5e9",
  [TYPE.WiFiAP]: "#3b82f6",
};

export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const median = (arr) =>
  arr.length
    ? ((arr = [...arr].sort((a, b) => a - b)), arr.length % 2 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2)
    : 0;