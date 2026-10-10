import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addMonths, fmtDate, monthKey, monthLabel, todayIn, weekStart } from "@/lib/dates";
import { facilitatorPay } from "@/lib/facilitator-pay";
import { sessions } from "@/lib/schedule";
import type { Database } from "@/lib/database.types";

export const PERIODS = [
  ["day", "Daily"],
  ["week", "Weekly"],
  ["month", "Monthly"],
] as const;
export type Period = (typeof PERIODS)[number][0];

const lastOfMonth = (key: string) => addDays(`${addMonths(key, 1)}-01`, -1);

type Params = Record<string, string | string[] | undefined>;

/** Class sessions in a day, week or month: who booked, who checked in, what the facilitator earns. */
export async function loadAnalytics(supabase: SupabaseClient<Database>, { p, d }: Params) {
  const today = todayIn();
  const period: Period = p === "day" || p === "month" ? p : "week";
  const anchor = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;

  const from = period === "day" ? anchor : period === "week" ? weekStart(anchor) : `${monthKey(anchor)}-01`;
  const to = period === "day" ? anchor : period === "week" ? addDays(from, 6) : lastOfMonth(monthKey(anchor));
  const upTo = to < today ? to : today; // nothing to measure in the future
  const step = (n: number) =>
    period === "day" ? addDays(anchor, n) : period === "week" ? addDays(anchor, 7 * n) : `${addMonths(monthKey(anchor), n)}-01`;
  const label =
    period === "day"
      ? fmtDate(from, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : period === "week"
        ? `${fmtDate(from, { month: "short", day: "numeric" })} – ${fmtDate(to, { month: "short", day: "numeric", year: "numeric" })}`
        : monthLabel(monthKey(anchor));

  const [{ data: offerings }, { data: cancels }, { data: team }] = await Promise.all([
    supabase.from("offerings").select("*").eq("kind", "class").order("title"),
    supabase.from("session_cancellations").select("offering_id, session_date").gte("session_date", from).lte("session_date", to),
    supabase.from("team_members").select("id, name"),
  ]);
  const classes = offerings ?? [];
  const ids = new Set(classes.map((o) => o.id));
  const facName = new Map((team ?? []).map((m) => [m.id, m.name]));

  // Page through the bookings; a month can pass the 1,000-row default.
  type Reg = { offering_id: string; session_date: string; checked_in_at: string | null; status: string; hold_until: string | null };
  const regs: Reg[] = [];
  if (from <= upTo) {
    for (let at = 0; ; at += 1000) {
      const { data } = await supabase
        .from("registrations")
        .select("offering_id, session_date, checked_in_at, status, hold_until")
        .gte("session_date", from)
        .lte("session_date", upTo)
        .order("id")
        .range(at, at + 999);
      regs.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  const live = regs.filter(
    (r) => ids.has(r.offering_id) && r.status !== "cancelled" && (r.checked_in_at || r.status === "confirmed" || !r.hold_until || new Date(r.hold_until) > new Date()),
  );

  const held = new Map<string, number>();
  const sessionRows: {
    o: (typeof classes)[number];
    date: string;
    cancelled: boolean;
    facilitator: string;
    booked: number;
    checked: number;
    pay: number;
  }[] = [];
  if (from <= upTo) {
    const byKey = new Map<string, { booked: number; checked: number }>();
    for (const r of live) {
      const k = `${r.offering_id}|${r.session_date}`;
      const c = byKey.get(k) ?? { booked: 0, checked: 0 };
      c.booked++;
      if (r.checked_in_at) c.checked++;
      byKey.set(k, c);
    }
    for (const s of sessions(classes, cancels ?? [], from, upTo)) {
      if (!s.cancelled) held.set(s.o.id, (held.get(s.o.id) ?? 0) + 1);
      const c = byKey.get(`${s.o.id}|${s.date}`) ?? { booked: 0, checked: 0 };
      sessionRows.push({
        o: s.o,
        date: s.date,
        cancelled: s.cancelled,
        facilitator: (s.o.facilitator_id && facName.get(s.o.facilitator_id)) || "Unassigned",
        booked: c.booked,
        checked: c.checked,
        pay: s.cancelled ? 0 : facilitatorPay(s.o.facilitator_pay_tier, c.checked),
      });
    }
  }

  return { today, period, anchor, from, to, upTo, step, label, classes, live, held, sessionRows };
}
