import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDate, todayIn } from "@/lib/dates";
import { monthsActive, STEWARD_STATUS, stewardStatusName } from "@/lib/steward";
import { EstateHead } from "../estate-head";

export const metadata: Metadata = { title: "Stewards" };

export default async function StewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>;
}) {
  const { supabase, staff } = await requireStaff("estate");
  const { status, sort } = await searchParams;
  // Admins keep it current: anyone who lost active status drops out before the list loads.
  if (staff.role === "admin") await supabase.rpc("reconcile_stewards");
  const [{ data: all }, { data: rules }] = await Promise.all([
    supabase.rpc("stewards_overview"),
    supabase.from("steward_rules").select("*").maybeSingle(),
  ]);
  const today = todayIn();
  const months = rules?.months_to_eligible ?? 48;
  const filter = STEWARD_STATUS.some(([k]) => k === status) ? status : null;
  const rows = (all ?? [])
    .filter((r) => !filter || r.status === filter)
    .sort((a, b) =>
      sort === "months"
        ? monthsActive(b.active_since, today) - monthsActive(a.active_since, today) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
  const href = (s: string | null, o: string | undefined = sort) => {
    const q = new URLSearchParams();
    if (s) q.set("status", s);
    if (o) q.set("sort", o);
    return `/estate/stewards${q.size ? `?${q}` : ""}`;
  };
  const count = (k: string) => (all ?? []).filter((r) => r.status === k).length;

  return (
    <div className="page">
      <EstateHead />
      <nav className="tabs" aria-label="Filter stewards" style={{ marginBottom: 16 }}>
        <Link href={href(null)} aria-current={!filter ? "page" : undefined}>All ({all?.length ?? 0})</Link>
        {STEWARD_STATUS.map(([k, name]) => (
          <Link key={k} href={href(k)} aria-current={filter === k ? "page" : undefined}>
            {name} ({count(k)})
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <div className="empty"><p>No stewards here yet. Link a person to a property and they show up.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="lines-table">
            <thead>
              <tr>
                <th>Steward</th>
                <th>Status</th>
                <th>
                  <Link href={href(filter ?? null, sort === "months" ? undefined : "months")}>
                    Profit-share clock{sort === "months" ? " ↓" : ""}
                  </Link>
                </th>
                <th>Agreement</th>
                <th>Fees</th>
                <th>Homes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const done = monthsActive(r.active_since, today);
                const ready = r.status === "inactive" && !!r.agreement_signed_at && r.fees_ok;
                return (
                  <tr key={r.contact_id}>
                    <td><Link href={`/crm/contact/${r.contact_id}`}>{r.name}</Link></td>
                    <td>
                      <span className={`tag-sm ${r.status === "active" ? "" : r.status === "suspended" ? "out" : "low"}`}>
                        {stewardStatusName(r.status)}
                      </span>
                      {ready && <span className="tag-sm low" style={{ marginLeft: 6 }}>Ready to activate</span>}
                    </td>
                    <td>
                      {r.status === "active" ? (
                        <>Month {done} of {months}{done >= months && <span className="tag-sm" style={{ marginLeft: 6 }}>Eligible</span>}</>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td>{r.agreement_signed_at ? fmtDate(r.agreement_signed_at) : <span className="muted">Not signed</span>}</td>
                    <td>
                      {r.fees_current ? (
                        "Current"
                      ) : (
                        <span className={`tag-sm ${r.fees_ok ? "low" : "out"}`}>{r.fees_ok ? "Late" : "Overdue past grace"}</span>
                      )}
                    </td>
                    <td>{r.properties}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
