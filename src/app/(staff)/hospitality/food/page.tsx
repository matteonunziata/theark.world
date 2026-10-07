import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { addDays, fmtDate, todayIn } from "@/lib/dates";
import { FoodHead } from "./food-head";

export const metadata: Metadata = { title: "Food and beverage" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = 7;

export default async function FoodPage({ searchParams }: PageProps<"/hospitality/food">) {
  const { from } = await searchParams;
  const { supabase } = await requireStaff("hospitality");
  const today = todayIn();
  const start = typeof from === "string" && ISO.test(from) ? from : today;
  const end = addDays(start, DAYS - 1);

  // Meal passes are the pay-first tickets (Breakfast, Lunch). Only paid,
  // confirmed bookings count; a hold isn't a purchase yet.
  const { data } = await supabase
    .from("registrations")
    .select("id, name, email, session_date, paid, checked_in_at, ticket_types!inner(name, pay_first), offerings(title)")
    .eq("status", "confirmed")
    .eq("ticket_types.pay_first", true)
    .gte("session_date", start)
    .lte("session_date", end)
    .order("session_date")
    .order("name");

  const byDay = new Map<string, NonNullable<typeof data>>();
  for (let i = 0; i < DAYS; i++) byDay.set(addDays(start, i), []);
  for (const r of data ?? []) byDay.get(r.session_date)?.push(r);

  const nav = (f: string) => `/hospitality/food?from=${f}`;

  return (
    <div className="page">
      <FoodHead />
      <div className="listings-h">
        <p className="muted" style={{ margin: 0 }}>
          {data?.length ?? 0} meal pass{data?.length === 1 ? "" : "es"},{" "}
          {fmtDate(start)} to {fmtDate(end)}.
        </p>
        <span className="spacer" />
        <Link className="btn sm" href={nav(addDays(start, -DAYS))}>Earlier</Link>
        <Link className="btn sm" href={nav(today)}>Today</Link>
        <Link className="btn sm" href={nav(addDays(start, DAYS))}>Later</Link>
      </div>
      {[...byDay].map(([day, rows]) => {
        const counts = new Map<string, number>();
        for (const r of rows) {
          const k = r.ticket_types?.name ?? "Meal";
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        return (
          <section key={day}>
            <h2 className="section-title">
              {fmtDate(day, { weekday: "long", month: "short", day: "numeric" })}
              {day === today && " · today"}
              <span className="muted">
                {rows.length
                  ? ` · ${[...counts].map(([n, c]) => `${c} ${n}`).join(", ")}`
                  : ""}
              </span>
            </h2>
            {rows.length ? (
              <div className="table-wrap">
                <table className="lines-table">
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Meal</th>
                      <th>Email</th>
                      <th>Arrived</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.ticket_types?.name ?? r.offerings?.title}</td>
                        <td className="muted">{r.email ?? "—"}</td>
                        <td className={r.checked_in_at ? "" : "muted"}>{r.checked_in_at ? "Checked in" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ marginBottom: 22 }}>No meal passes this day.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
