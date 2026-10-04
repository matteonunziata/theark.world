import type { Metadata } from "next";
import { siteUrl } from "@/lib/email";
import { addDays, todayIn } from "@/lib/dates";
import { loadPortal } from "@/lib/portal";
import { GuestsView, type Guest } from "./guests-view";

export const metadata: Metadata = { title: "Guests" };

type Allowance = { allowed: number; used: number };

export default async function GuestsPage() {
  const p = await loadPortal();
  const today = todayIn(p.timezone);
  if (!p.memberId) {
    return (
      <div className="pv-empty">
        <h3>Guest passes are for members</h3>
        <p>You’re signed in as staff. Members invite their guests from here.</p>
      </div>
    );
  }
  const { data } = await p.supabase.rpc("my_guests");
  const g = (data ?? {}) as { this_month?: Allowance; next_month?: Allowance; guests?: Guest[] };
  return (
    <GuestsView
      thisMonth={g.this_month ?? { allowed: 0, used: 0 }}
      nextMonth={g.next_month ?? { allowed: 0, used: 0 }}
      guests={g.guests ?? []}
      today={today}
      maxDate={addDays(today, 60)}
      origin={await siteUrl()}
      orgName={p.orgName}
      hostFirst={(p.me?.name ?? "").split(/\s+/)[0]}
    />
  );
}
