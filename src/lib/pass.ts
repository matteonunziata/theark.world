import { fmtDate } from "@/lib/dates";

/** Short code printed under a member pass QR, for reading out at the gate. */
export const passCode = (token: string) => `MEM-${token.slice(-6).toUpperCase()}`;

/** What pass_by_token() / gate_state() say about a pass today. */
export type PassState = {
  tier_name: string | null;
  period: string | null;
  state: string;
  valid_from: string | null;
  valid_until: string | null;
  activate_by: string | null;
  checked_in_at?: string | null;
};

export const PASS_STATE: Record<string, string> = {
  valid: "Valid today",
  unused: "Ready for your first visit",
  checked_in: "Checked in today",
  paused: "Membership paused",
  inactive: "No active membership",
  not_started: "Not started yet",
  expired: "Expired",
};

/** Green at the gate: can come in now (an unused pass starts on this check-in). */
export const passOk = (state: string) => state === "valid" || state === "unused";

const isPass = (period: string | null | undefined) => period === "day" || period === "week";

/** "Day pass, Oct 4, 2026" / "Annual, until Aug 24, 2027" / "Day pass, use by Jan 4, 2027". */
export function passValidity(p: Pick<PassState, "tier_name" | "period" | "valid_from" | "valid_until" | "activate_by">) {
  const name = p.tier_name ?? "Member";
  const f = (d: string) => fmtDate(d, { month: "short", day: "numeric", year: "numeric" });
  if (!p.valid_from && p.activate_by) return `${name}, use by ${f(p.activate_by)}`;
  if (isPass(p.period) && p.valid_from && (!p.valid_until || p.valid_until === p.valid_from)) {
    return `${name}, ${f(p.valid_from)}`;
  }
  if (p.valid_from && p.valid_until) return `${name}, ${f(p.valid_from)} to ${f(p.valid_until)}`;
  if (p.valid_until) return `${name}, until ${f(p.valid_until)}`;
  return `${name}, any day, any hour`;
}

/**
 * The one line security reads: why the screen is green or red.
 * "Expired Oct 3", "Starts Oct 12", "Already checked in at 9:12 AM".
 */
export function passReason(p: PassState, timeZone = "America/Costa_Rica") {
  const short = (d: string) => fmtDate(d, { month: "short", day: "numeric" });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  const name = p.tier_name ?? "Membership";
  switch (p.state) {
    case "valid":
      return isPass(p.period) && p.valid_until && p.valid_until !== p.valid_from
        ? `${name}, until ${short(p.valid_until)}`
        : p.valid_until
          ? `${name}, until ${short(p.valid_until)}`
          : name;
    case "unused":
      return `${name}, first visit. Use by ${p.activate_by ? short(p.activate_by) : "soon"}`;
    case "checked_in":
      return p.checked_in_at ? `Already checked in at ${time(p.checked_in_at)}` : "Already checked in today";
    case "not_started":
      return p.valid_from ? `Starts ${short(p.valid_from)}` : "Not started yet";
    case "expired":
      if (p.valid_until) return `Expired ${short(p.valid_until)}`;
      if (p.activate_by) return `Not used by ${short(p.activate_by)}`;
      return "Expired";
    case "paused":
      return "Membership paused";
    default:
      return "No membership";
  }
}

/** Short code printed under a guest pass QR. */
export const guestCode = (token: string) => `GST-${token.slice(-6).toUpperCase()}`;
