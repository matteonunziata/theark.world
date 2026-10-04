import { fmtDate } from "@/lib/dates";

/** Short code printed under a member pass QR, for reading out at the gate. */
export const passCode = (token: string) => `MEM-${token.slice(-6).toUpperCase()}`;

export const PASS_STATE: Record<string, string> = {
  valid: "Valid today",
  paused: "Membership paused",
  inactive: "No active membership",
  not_started: "Not started yet",
  expired: "Expired",
  no_date: "No start date set",
};

/** "Day pass, Oct 4" / "Annual, until Aug 24, 2027" / "Founding, ongoing". */
export function passValidity(p: {
  tier_name: string | null;
  period: string;
  valid_from: string | null;
  valid_until: string | null;
}) {
  const name = p.tier_name ?? "Member";
  const f = (d: string) => fmtDate(d, { month: "short", day: "numeric", year: "numeric" });
  if ((p.period === "day" || p.period === "once") && (p.valid_until ?? p.valid_from)) {
    return `${name}, ${f((p.valid_until ?? p.valid_from)!)}`;
  }
  if (p.valid_from && p.valid_until) return `${name}, ${f(p.valid_from)} to ${f(p.valid_until)}`;
  if (p.valid_until) return `${name}, until ${f(p.valid_until)}`;
  return `${name}, any day, any hour`;
}
