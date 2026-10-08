import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDate, todayIn } from "@/lib/dates";
import { fmtAmount } from "@/lib/stripe";

export const metadata: Metadata = { title: "Passes" };

const COSTA_RICA = "America/Costa_Rica";
const boughtOn = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: COSTA_RICA });

/** Every day and week pass ever bought, newest first, including used, expired and refunded ones. */
export default async function PassesPage() {
  const { supabase } = await requireStaff("memberships");
  const today = todayIn();
  const { data: tiers } = await supabase.from("membership_tiers").select("key, name").in("period", ["day", "week"]);
  const { data: rows } = await supabase
    .from("memberships")
    .select(
      "id, tier, status, starts_on, ends_on, activate_by, source, created_at, contact:contacts(id, name, email), payment:payments(amount, currency, status)",
    )
    .in("tier", (tiers ?? []).map((t) => t.key))
    .order("created_at", { ascending: false })
    .limit(500);
  const tierName = (k: string) => tiers?.find((t) => t.key === k)?.name ?? k;

  const state = (m: NonNullable<typeof rows>[number]) => {
    if (m.payment?.status === "refunded") return ["Refunded", "no"] as const;
    if (m.status === "revoked") return ["Ended early", "no"] as const;
    if (m.status === "unused") {
      return (m.activate_by ?? "") >= today ? (["Not used yet", "wait"] as const) : (["Expired unused", "no"] as const);
    }
    if (m.ends_on && m.ends_on < today) return ["Used", "no"] as const;
    return ["In use", "ok"] as const;
  };

  const list = rows ?? [];
  const waiting = list.filter((m) => state(m)[1] === "wait").length;
  return (
    <>
      <div className="stats" style={{ marginBottom: 22 }}>
        <div className="stat">
          <b>{list.length}</b>
          <span>Day and week passes on record</span>
        </div>
        <div className="stat">
          <b>{waiting}</b>
          <span>Bought and not used yet</span>
        </div>
      </div>
      {!list.length ? (
        <div className="empty">
          <p>No passes yet. Day and week passes bought on the website show up here.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="lines-table">
            <thead>
              <tr>
                <th>Bought</th>
                <th>Who</th>
                <th>Pass</th>
                <th>Paid</th>
                <th>Valid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => {
                const [label] = state(m);
                return (
                  <tr key={m.id}>
                    <td>{fmtDate(boughtOn(m.created_at), { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td>
                      {m.contact ? (
                        <Link href={`/crm/contact/${m.contact.id}`}>{m.contact.name}</Link>
                      ) : (
                        <span className="muted">Unknown</span>
                      )}
                      {m.contact?.email && <div className="muted">{m.contact.email}</div>}
                    </td>
                    <td>{tierName(m.tier)}</td>
                    <td>{m.payment ? fmtAmount(Number(m.payment.amount), m.payment.currency) : <span className="muted">Added by hand</span>}</td>
                    <td>
                      {m.starts_on ? (
                        `${fmtDate(m.starts_on)}${m.ends_on && m.ends_on !== m.starts_on ? ` to ${fmtDate(m.ends_on)}` : ""}`
                      ) : m.activate_by ? (
                        <span className="muted">Use by {fmtDate(m.activate_by, { month: "short", day: "numeric", year: "numeric" })}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
