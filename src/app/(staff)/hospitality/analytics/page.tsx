import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { addMonths, monthKey, monthLabel, todayIn } from "@/lib/dates";
import { lotTitle } from "@/lib/estate";
import { money } from "@/lib/schedule";
import { HospitalityHead } from "../hospitality-head";

export const metadata: Metadata = { title: "Hospitality analytics" };

const MONTH = /^\d{4}-\d{2}$/;

const nights = (a: string, b: string) =>
  Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000));

export default async function HospitalityAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { m } = await searchParams;
  const { supabase } = await requireStaff("hospitality");
  const today = todayIn();
  const month = typeof m === "string" && MONTH.test(m) ? m : monthKey(today);
  const start = `${month}-01`;
  const end = `${addMonths(month, 1)}-01`;
  const days = nights(start, end);

  const [{ data: lots }, { data: stays }] = await Promise.all([
    supabase.from("lots").select("id, code, name, home_name, in_hospitality").order("code"),
    supabase
      .from("stays")
      .select("lot_id, kind, status, source, channel, check_in, check_out, total, currency, paid")
      .eq("status", "confirmed")
      .lt("check_in", end)
      .gt("check_out", start),
  ]);

  const guest = (stays ?? []).filter((s) => s.kind === "guest");
  // Nights falling inside the month, so a stay that crosses a month edge is split.
  const inMonth = (s: { check_in: string; check_out: string }) =>
    nights(s.check_in > start ? s.check_in : start, s.check_out < end ? s.check_out : end);

  const homes = (lots ?? []).filter((l) => l.in_hospitality || guest.some((s) => s.lot_id === l.id));
  const rows = homes.map((h) => {
    const mine = guest.filter((s) => s.lot_id === h.id);
    const n = mine.reduce((t, s) => t + inMonth(s), 0);
    const rev = mine.reduce((t, s) => {
      const len = nights(s.check_in, s.check_out);
      return t + (len ? (Number(s.total) || 0) * (inMonth(s) / len) : 0);
    }, 0);
    return { h, stays: mine.length, nights: n, occ: days ? Math.round((n / days) * 100) : 0, rev };
  });

  const totalNights = rows.reduce((t, r) => t + r.nights, 0);
  const totalRev = rows.reduce((t, r) => t + r.rev, 0);
  const capacity = homes.length * days;
  const occ = capacity ? Math.round((totalNights / capacity) * 100) : 0;
  const avgStay = guest.length ? guest.reduce((t, s) => t + nights(s.check_in, s.check_out), 0) / guest.length : 0;
  const adr = totalNights ? totalRev / totalNights : 0;

  const channels = new Map<string, { stays: number; nights: number }>();
  for (const s of guest) {
    const k = s.source === "guesty" ? (s.channel ?? "Guesty") : "Direct";
    const c = channels.get(k) ?? { stays: 0, nights: 0 };
    c.stays++;
    c.nights += inMonth(s);
    channels.set(k, c);
  }
  const channelRows = [...channels.entries()].sort((a, b) => b[1].nights - a[1].nights);
  const max = Math.max(1, ...rows.map((r) => r.nights));
  const link = (k: string) => `/hospitality/analytics?m=${k}`;

  return (
    <div className="page">
      <HospitalityHead />
      <div className="toolbar">
        <div className="weeknav" style={{ margin: 0, flex: 1 }}>
          <span className="range">{monthLabel(month)}</span>
          <Link className="btn" href={link(addMonths(month, -1))}>Previous</Link>
          <Link className="btn" href={link(monthKey(today))}>This month</Link>
          <Link className="btn" href={link(addMonths(month, 1))}>Next</Link>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 22 }}>
        <div className="stat"><b>{occ}%</b><span>Occupancy</span></div>
        <div className="stat"><b>{totalNights}</b><span>Nights booked</span></div>
        <div className="stat"><b>{guest.length}</b><span>Guest stays</span></div>
        <div className="stat"><b>{avgStay ? avgStay.toFixed(1) : "—"}</b><span>Avg nights per stay</span></div>
      </div>

      {!guest.length ? (
        <div className="empty">
          <h2>No confirmed stays</h2>
          <p>Nothing is booked in {monthLabel(month)}. Try another month.</p>
        </div>
      ) : (
        <>
          <h2 className="subhead">By home</h2>
          <div className="table-wrap">
            <table className="lines-table">
              <thead>
                <tr><th>Home</th><th>Stays</th><th>Nights</th><th>Occupancy</th><th>Revenue</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.h.id}>
                    <td>
                      <b>{r.h.home_name ?? lotTitle(r.h)}</b>
                      <div className="meter" aria-hidden="true">
                        <span style={{ width: `${Math.round((r.nights / max) * 100)}%` }} />
                      </div>
                    </td>
                    <td>{r.stays}</td>
                    <td>{r.nights}</td>
                    <td>{r.occ}%</td>
                    <td>{r.rev ? money(Math.round(r.rev), "USD") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Revenue is the confirmed stay total, split by nights when a stay crosses a month edge. Totals are
            shown in dollars and assume stays are priced in USD.
            {adr ? ` Average nightly rate ${money(Math.round(adr), "USD")}.` : ""}
          </p>

          <h2 className="subhead" style={{ marginTop: 28 }}>By channel</h2>
          <div className="table-wrap">
            <table className="lines-table">
              <thead>
                <tr><th>Channel</th><th>Stays</th><th>Nights</th><th>Share of nights</th></tr>
              </thead>
              <tbody>
                {channelRows.map(([k, c]) => (
                  <tr key={k}>
                    <td><b>{k}</b></td>
                    <td>{c.stays}</td>
                    <td>{c.nights}</td>
                    <td>{totalNights ? Math.round((c.nights / totalNights) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
