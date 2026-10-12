import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { MergeButton } from "./merge-button";

export const metadata: Metadata = { title: "Duplicate contacts" };

export default async function DuplicatesPage() {
  const { supabase, staff } = await requireStaff("crm");
  const { data: pairs } = await supabase.rpc("find_duplicate_contacts");
  const ids = [...new Set((pairs ?? []).flatMap((p) => [p.a_id, p.b_id]))];
  const { data: people } = ids.length
    ? await supabase.from("contacts").select("id, name, email, phone, type, lot").in("id", ids)
    : { data: [] };
  const byId = new Map((people ?? []).map((c) => [c.id, c]));
  const isAdmin = staff.role === "admin";

  return (
    <>
      <p className="muted" style={{ marginBottom: 16 }}>
        People who look like the same person, by email, name or phone.
        {isAdmin
          ? " Pick the record to keep. Everything from the other one (notes, membership, properties, orders) moves onto it."
          : " Only admins can merge."}
      </p>
      {!pairs?.length ? (
        <div className="empty"><p>No duplicates found.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="lines-table">
            <thead>
              <tr><th>Why</th><th>Contact A</th><th>Contact B</th></tr>
            </thead>
            <tbody>
              {pairs.map((p) => {
                const a = byId.get(p.a_id);
                const b = byId.get(p.b_id);
                if (!a || !b) return null;
                const cell = (c: typeof a, other: typeof a) => (
                  <td>
                    <Link href={`/crm/contact/${c.id}`}>{c.name}</Link>
                    <div className="muted">
                      {[c.type, c.email, c.phone].filter(Boolean).join(" · ")}
                    </div>
                    {isAdmin && (
                      <MergeButton keepId={c.id} dropId={other.id} keepName={c.name} dropName={other.email ?? other.name} />
                    )}
                  </td>
                );
                return (
                  <tr key={`${p.a_id}-${p.b_id}`}>
                    <td><span className="tag-sm low">{p.reason}</span></td>
                    {cell(a, b)}
                    {cell(b, a)}
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
