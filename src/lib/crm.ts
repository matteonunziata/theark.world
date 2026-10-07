// CRM vocabulary, ported from the prototype.

export const PTYPES = [
  ["contact", "Contact"],
  ["member", "Member"],
  ["steward", "Steward"],
] as const;

export const TIERS = [
  ["", "No membership"],
  ["standard", "Monthly"],
  ["quarter", "3 months"],
  ["half", "6 months"],
  ["annual", "Annual"],
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
  ["call", "Call"],
] as const;

export const channelName = (k: string | null | undefined) =>
  CHANNELS.find(([c]) => c === k)?.[1] ?? "Email";

export const tierName = (k: string | null | undefined) =>
  TIERS.find((t) => t[0] === (k ?? ""))?.[1] ??
  // Tiers added later in Settings fall back to a readable key.
  String(k).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
export const tierClass = (k: string | null | undefined) =>
  !k ? "none" : ["day", "week"].includes(k) ? "pass" : k;
export const tierColor = (k: string | null | undefined) =>
  !k
    ? "var(--slate)"
    : k === "standard" || k === "annual" || k === "quarter" || k === "half"
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

/** Everything after the first name ("Rodríguez Madrigal"). */
export const lastName = (n: string | null | undefined) =>
  String(n || "").trim().split(/\s+/).slice(1).join(" ");

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

const PER: Record<string, string> = {
  day: "a day",
  week: "a week",
  month: "a month",
  quarter: "for 3 months",
  half: "for 6 months",
  year: "a year",
  once: "",
};

export const PERIODS = [
  ["day", "A day"],
  ["week", "A week"],
  ["month", "A month"],
  ["quarter", "3 months"],
  ["half", "6 months"],
  ["year", "A year"],
  ["once", "Once"],
] as const;

export const RATES = [
  ["rack", "Rack rate"],
  ["ff", "Friends & family"],
] as const;

type Priced = {
  price: number | null;
  price_ff?: number | null;
  currency: string;
  period: string;
};

/** The price for a rate: friends & family when set and asked for, otherwise rack. */
export const ratePrice = (t: Priced, rate?: string | null) =>
  rate === "ff" && t.price_ff !== null && t.price_ff !== undefined ? t.price_ff : t.price;

/** "₡130,000 a month", for a rate, applying a discount when there is one. */
export function tierPrice(
  t: Priced | null | undefined,
  discountPercent?: number | null,
  rate?: string | null,
) {
  const base = t ? ratePrice(t, rate) : null;
  if (!t || base === null) return "Price not set";
  const n = Math.round(Number(base) * (1 - Number(discountPercent ?? 0) / 100));
  const amount = t.currency === "USD" ? `$${n.toLocaleString("en-US")}` : `₡${n.toLocaleString("en-US")}`;
  return PER[t.period] ? `${amount} ${PER[t.period]}` : amount;
}

/** Memberships of a month or longer get the portal welcome email. Passes
 * and the team's own tier don't. */
export const portalWelcomeTier = (t: { key: string; period: string } | null | undefined) =>
  !!t && t.key !== "team" && !["day", "week"].includes(t.period);
