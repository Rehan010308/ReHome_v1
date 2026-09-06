/**
 * Handoff codes.
 *
 * A QR here is a pointer, never a payload. It carries an id the receiving
 * organization already has permission to read, and nothing else — no donor
 * name, no address, no contact details. Whoever scans it still has to be signed
 * in as the receiving organization before the database will show them anything
 * or let them confirm, so a photographed code is not a credential.
 *
 * The short reference (RH-XXXX-XXXX) exists because a code on a cracked screen
 * sometimes will not scan, and reading eight characters aloud is a better
 * fallback than abandoning the handoff.
 */

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * A stable, human-readable reference derived from the allocation id. Derived
 * rather than stored so it cannot drift, and case-folded onto an alphabet with
 * no 0/O or 1/I to confuse anyone reading it out.
 */
export function handoffReference(allocationId: string): string {
  const hex = allocationId.replace(/[^0-9a-f]/gi, "").toLowerCase();
  let acc = 0;
  const out: string[] = [];
  for (let i = 0; i < hex.length; i += 1) {
    acc = (acc * 31 + parseInt(hex[i], 16)) % 1_073_741_823;
    if (i % 4 === 3 && out.length < 8) {
      out.push(REF_ALPHABET[acc % REF_ALPHABET.length]);
    }
  }
  while (out.length < 8) {
    acc = (acc * 31 + 7) % 1_073_741_823;
    out.push(REF_ALPHABET[acc % REF_ALPHABET.length]);
  }
  return `RH-${out.slice(0, 4).join("")}-${out.slice(4, 8).join("")}`;
}

function appBase(): string {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  return `${origin}${pathname}`;
}

/** Deep link the receiving organization opens to confirm a specific handoff. */
export function handoffUrl(allocationId: string): string {
  return `${appBase()}#/app/verify/${allocationId}`;
}

/** Public-facing lifecycle view for one item. Shows no donor identity. */
export function itemLifecycleUrl(itemId: string): string {
  return `${appBase()}#/app/item/${itemId}`;
}

/** A verified destination's ReHome profile. */
export function organizationUrl(organizationId: string): string {
  return `${appBase()}#/app/destination/${organizationId}`;
}

/** Receipt for a confirmed contribution. */
export function impactReceiptUrl(allocationId: string): string {
  return `${appBase()}#/app/receipt/${allocationId}`;
}

/**
 * Pull an id back out of anything a scanner might hand us: a full ReHome URL,
 * a bare hash route, or just the uuid on its own.
 */
export function parseScannedId(raw: string, kind: "verify" | "item" | "destination"): string | null {
  const text = raw.trim();
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  const routed = new RegExp(`#/app/${kind}/(${uuid.source})`, "i").exec(text);
  if (routed) return routed[1];

  if (new RegExp(`^${uuid.source}$`, "i").test(text)) return text;

  // A code for a different route is not a match — say so rather than guessing.
  if (text.includes("#/app/")) return null;

  const loose = uuid.exec(text);
  return loose ? loose[0] : null;
}
