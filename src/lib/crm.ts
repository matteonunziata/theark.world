// CRM vocabulary, ported from the prototype.

export const PTYPES = [
  ["contact", "Contact"],
  ["member", "Member"],
  ["steward", "Steward"],
] as const;

export const TIERS = [
  ["", "No membership"],
  ["founding", "Founding"],
  ["standard", "Standard"],
  ["annual", "Annual"],
  ["ambassador", "Ambassador"],
  ["day", "Day pass"],
  ["week", "Week pass"],
] as const;

export const MSTATUS = [
  ["active", "Active"],
  ["upcoming", "Upcoming"],
  ["paused", "Paused"],
  ["expired", "Expired"],
] as const;

export const PIPELINES = {
  memberships: {
    name: "Memberships",
    stages: [
      ["waitlist", "Waitlist"],
      ["invited", "Invited to apply"],
      ["applied", "Applied"],
      ["screening", "Screening"],
      ["approved", "Approved"],
      ["active", "Paid & active"],
    ],
  },
  estate: {
    name: "Real estate",
    stages: [
      ["lead", "Lead"],
      ["qualified", "Qualified"],
      ["visit", "Site visit"],
      ["offer", "Offer"],
      ["reserved", "Reserved"],
      ["contract", "Contract"],
      ["closed", "Closed"],
    ],
  },
} as const;

export type PipelineKey = keyof typeof PIPELINES;

export const CHANNELS = [
  ["email", "Email"],
  ["whatsapp", "WhatsApp"],
] as const;

export const tierName = (k: string | null | undefined) =>
  TIERS.find((t) => t[0] === (k ?? ""))?.[1] ?? "No membership";
export const tierClass = (k: string | null | undefined) =>
  !k ? "none" : ["day", "week"].includes(k) ? "pass" : k;
export const tierColor = (k: string | null | undefined) =>
  !k
    ? "var(--slate)"
    : k === "founding"
      ? "var(--leaf)"
      : k === "ambassador"
        ? "var(--plum)"
        : k === "standard" || k === "annual"
          ? "var(--sea)"
          : "var(--slate)";
export const ptypeName = (k: string | null | undefined) =>
  PTYPES.find((t) => t[0] === k)?.[1] ?? "Contact";
export const mstatusName = (k: string | null | undefined) =>
  MSTATUS.find((m) => m[0] === k)?.[1] ?? "Active";
export const isActiveMember = (c: {
  tier: string | null;
  membership_status: string;
}) => !!c.tier && c.membership_status === "active";

export const firstName = (n: string | null | undefined) =>
  String(n || "").trim().split(/\s+/)[0] || "";

export const waLink = (phone: string | null | undefined, text?: string) => {
  const d = String(phone || "").replace(/\D/g, "");
  return d
    ? `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`
    : "";
};

/** Fill {{first_name}}, {{name}}, {{org}} in a message. */
export function merge(
  text: string | null | undefined,
  c: { name: string },
  org = "The ARK",
) {
  return String(text || "")
    .replace(/{{\s*first_name\s*}}/gi, firstName(c.name))
    .replace(/{{\s*name\s*}}/gi, c.name || "")
    .replace(/{{\s*org\s*}}/gi, org);
}
