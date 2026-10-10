import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { siteUrl } from "@/lib/email";
import { fmtAmount, stripeReady, TERM_NAME, termPrice } from "@/lib/stripe";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = { title: "Profile" };

export default async function ContactPage({
  params,
}: PageProps<"/crm/contact/[id]">) {
  const { id } = await params;
  const { supabase, staff } = await requireStaff("crm");
  const [contact, notes, stages, enrollments, sequences, owners, org, tiers, discounts, activity, memberships, sales, links] =
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
      supabase.rpc("contact_activity", { cid: id }),
      supabase
        .from("memberships")
        .select("id, tier, status, starts_on, ends_on, activate_by, source")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("sales")
        .select("id, total, discount, created_at, items:sale_items(name, quantity), payments:sale_payments(method)")
        .eq("contact_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("property_stewards").select("lot:lots(id, code, name)").eq("contact_id", id),
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
  const props = (links.data ?? []).flatMap((l) => (l.lot ? [l.lot] : []));
  const sf = props.length
    ? ((await supabase.rpc("steward_finance", { p_contact: id })).data as {
        fees_current: boolean;
        owed_to_ark: number | null;
        owed_to_steward: number | null;
      } | null)
    : null;
  // Active stewardship (admins keep it current: this drops anyone who lost active status).
  let stewardship = null;
  if (props.length > 0) {
    if (staff.role === "admin") await supabase.rpc("reconcile_stewards");
    const [{ data: row }, { data: hist }, { data: rules }, { data: ov }, { data: team }] = await Promise.all([
      supabase.from("stewardships").select("*").eq("contact_id", id).maybeSingle(),
      supabase.from("steward_status_history").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
      supabase.from("steward_rules").select("*").maybeSingle(),
      supabase.rpc("stewards_overview"),
      supabase.from("team_members").select("id, name"),
    ]);
    const o = (ov ?? []).find((x) => x.contact_id === id);
    if (row) {
      stewardship = {
        s: row,
        history: (hist ?? []).map((h) => ({ ...h, by: team?.find((t) => t.id === h.changed_by)?.name ?? null })),
        months: rules?.months_to_eligible ?? 48,
        graceDays: rules?.grace_days ?? 30,
        feesCurrent: o?.fees_current ?? true,
        feesOk: o?.fees_ok ?? true,
        today: todayIn(org.data?.timezone ?? undefined),
      };
    }
  }
  // A Stripe link for the member's next term, at their rate and discount.
  const c = contact.data;
  const tier = (tiers.data ?? []).find((t) => t.key === c.tier);
  const disc = (discounts.data ?? []).find((d) => d.id === c.discount_id && d.active);
  const term = tier && c.email && stripeReady() ? termPrice(tier, c.rate, disc?.percent) : null;
  const pay =
    term && tier
      ? {
          url: `${await siteUrl()}/pay/membership/${c.pay_token}`,
          label: `${fmtAmount(term, tier.currency)} for ${TERM_NAME[tier.period]}`,
        }
      : null;
  return (
    <ProfileView
      contact={contact.data}
      pay={pay}
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
      activity={activity.data ?? []}
      memberships={memberships.data ?? []}
      sales={sales.data ?? []}
      properties={props}
      stewardFinance={sf}
      stewardship={stewardship}
      currency={org.data?.currency ?? "CRC"}
      now={new Date().toISOString()}
      role={staff.role}
      orgName={org.data?.name ?? "The ARK"}
    />
  );
}
