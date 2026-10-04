import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = { title: "Profile" };

export default async function ContactPage({
  params,
}: PageProps<"/crm/contact/[id]">) {
  const { id } = await params;
  const { supabase, staff } = await requireStaff("crm");
  const [contact, notes, stages, enrollments, sequences, owners, org, tiers, discounts] =
    await Promise.all([
      supabase.from("contacts").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("contact_notes")
        .select("id, body, created_at, author:team_members(name)")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("contact_stages").select("*").eq("contact_id", id),
      supabase
        .from("enrollments")
        .select("*, enrollment_sends(step_position)")
        .eq("contact_id", id)
        .order("created_at"),
      supabase
        .from("sequences")
        .select("id, name, sequence_steps(*)")
        .order("name"),
      supabase
        .from("team_members")
        .select("id, name")
        .in("role", ["admin", "sales"])
        .eq("status", "active"),
      supabase.rpc("public_org").maybeSingle(),
      supabase.from("membership_tiers").select("key, name, price, price_ff, currency, period, active, guest_passes").order("position"),
      supabase.from("discounts").select("id, name, percent, active").order("name"),
    ]);
  if (!contact.data) {
    return (
      <>
        <Link className="ev-back" href="/crm/people">← People</Link>
        <div className="empty">
          <h2>Person not found</h2>
          <p>They may have been deleted, or they’re not in your pipelines.</p>
        </div>
      </>
    );
  }
  return (
    <ProfileView
      contact={contact.data}
      notes={(notes.data ?? []).map((n) => ({
        id: n.id,
        body: n.body,
        created_at: n.created_at,
        author: n.author?.name ?? null,
      }))}
      stages={stages.data ?? []}
      enrollments={(enrollments.data ?? []).map((e) => ({
        id: e.id,
        sequence_id: e.sequence_id,
        started_on: e.started_on,
        status: e.status,
        sent: e.enrollment_sends.map((s) => s.step_position),
      }))}
      sequences={(sequences.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        steps: [...s.sequence_steps].sort((a, b) => a.position - b.position),
      }))}
      owners={owners.data ?? []}
      tiers={tiers.data ?? []}
      discounts={discounts.data ?? []}
      role={staff.role}
      orgName={org.data?.name ?? "The ARK"}
    />
  );
}
