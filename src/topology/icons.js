// ===============================
// File: src/topology/icons.js
// ===============================
import { TYPE } from "../domain.js";

const base = import.meta.env.BASE_URL || "/";
const P = (name) => `${base}icons/${name}`;

// Use external.svg as the universal fallback for components
export const FALLBACK_ICON = P("external.svg");

export const TYPE_ICON = {
  [TYPE.Firewall]:    P("firewall.svg"),
  [TYPE.Router]:      P("router.svg"),
  [TYPE.Switch]:      P("switch.svg"),
  [TYPE.Server]:      P("server.svg"),
  [TYPE.Database]:    P("database.svg"),
  [TYPE.Workstation]: P("workstation.svg"),
  [TYPE.EHR]:         P("ehr.svg"),
  [TYPE.PACS]:        P("pacs.svg"),
  [TYPE.HL7]:         P("hl7.svg"),
  [TYPE.IoMT]:        P("iomt.svg"),
  [TYPE.WiFiAP]:      P("wifi.svg"),
};
// No zone icons needed.
