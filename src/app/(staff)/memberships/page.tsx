import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { MembersView } from "./members-view";

export const metadata: Metadata = { title: "Memberships" };

export default async function MembersPage() {
  const { supabase } = await requireStaff("memberships");
  const { data } = await supabase
    .from("contacts")
    .select("id, name, tier, location, interests, membership_status")
    .not("tier", "is", null)
    .eq("membership_status", "active")
    .order("name");
  const members = data ?? [];
  const n = (t: string) => members.filter((m) => m.tier === t).length;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Memberships</h1>
          <p className="lede">
            Everyone with an active membership. Open a card to see their full
            profile in the CRM.
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn" href="/crm/people">Manage in CRM</Link>
          <Link className="btn primary" href="/portal" target="_blank">
            Open members portal
          </Link>
        </div>
      </div>
      <div className="stats" style={{ marginBottom: 22 }}>
        <div className="stat"><b>{members.length}</b><span>Active members, of 200 for 2026</span></div>
        <div className="stat"><b>{n("founding")}</b><span>Founding, of 50 spots</span></div>
        <div className="stat"><b>{n("standard") + n("annual")}</b><span>Standard and annual</span></div>
        <div className="stat"><b>{n("day") + n("week")}</b><span>Day and week passes</span></div>
      </div>
      <MembersView members={members} />
    </div>
  );
}
