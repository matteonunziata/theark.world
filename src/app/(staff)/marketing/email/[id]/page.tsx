import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { CampaignEditor } from "./campaign-editor";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: PageProps<"/marketing/email/[id]">) {
  const { id } = await params;
  const { supabase, staff } = await requireStaff("marketing");
  const { data: c } = await supabase
    .from("email_campaigns")
    .select("*, email_sends(status, delivered_at, opened_at, clicked_at, bounced_at, unsubscribed_at)")
    .eq("id", id)
    .maybeSingle();
  if (!c) {
    return (
      <>
        <Link className="ev-back" href="/marketing/email">← Email</Link>
        <div className="empty"><h2>Campaign not found</h2><p>It may have been deleted.</p></div>
      </>
    );
  }
  const { email_sends, ...campaign } = c;
  const lists = await Promise.all(
    (["waitlist", "applicants", "members", "attendees"] as const).map(async (k) => {
      const { data } = await supabase.rpc("marketing_list", { p_list: k });
      return [k, data?.length ?? 0] as const;
    }),
  );
  const real = email_sends.filter((s) => s.status === "sent");
  return (
    <>
      <Link className="ev-back" href="/marketing/email">← Email</Link>
      <CampaignEditor
        campaign={campaign}
        listSizes={Object.fromEntries(lists)}
        stats={{
          sent: real.length,
          failed: email_sends.filter((s) => s.status === "failed").length,
          delivered: real.filter((s) => s.delivered_at).length,
          opened: real.filter((s) => s.opened_at).length,
          clicked: real.filter((s) => s.clicked_at).length,
          bounced: real.filter((s) => s.bounced_at).length,
          unsubscribed: real.filter((s) => s.unsubscribed_at).length,
        }}
        myEmail={staff.email}
      />
    </>
  );
}
