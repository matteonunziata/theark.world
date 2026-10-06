import type { Metadata } from "next";
import Link from "next/link";
import { tierName, tierPrice } from "@/lib/crm";
import { addDays, dayLabel, fmtDate, timeRange, todayIn } from "@/lib/dates";
import { loadPortal } from "@/lib/portal";
import { fmtAmount, stripeReady, TERM_NAME, termPrice } from "@/lib/stripe";
import { PhotoField } from "./photo-field";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Me" };

export default async function Me() {
  const p = await loadPortal();
  const { me } = p;
  const today = todayIn(p.timezone);
  const [{ data: regs }, { data: tier }, { data: rate }] = await Promise.all([
    me
      ? p.supabase
          .from("registrations")
          .select("id, session_date, qr_token, checked_in_at, offering:offerings(title, start_time, end_time, location)")
          .or(`user_id.eq.${p.user!.id},contact_id.eq.${me.id}`)
          .gte("session_date", today)
          .order("session_date")
      : Promise.resolve({ data: [] as never[] }),
    me?.tier
      ? p.supabase.from("membership_tiers").select("*").eq("key", me.tier).maybeSingle()
      : Promise.resolve({ data: null }),
    me ? p.supabase.rpc("my_rate") : Promise.resolve({ data: null }),
  ]);

  // Paying ahead online: memberships paid by term, once Stripe is on.
  const term = me && tier && tier.key !== "team" && stripeReady() ? termPrice(tier, rate, me.discount_percent) : null;
  const dueSoon = !me?.renews_on || me.renews_on <= addDays(today, 30);

  if (!me) {
    return (
      <div className="pv-empty">
        <h3>You’re viewing the portal as staff</h3>
        <p>Members see their profile, membership, and bookings here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="pv-sec-h" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="pv-h1">{me.name}</h1>
          <p>{me.email}</p>
        </div>
      </div>
      <div className="pv-two">
        <div style={{ display: "grid", gap: 20 }}>
          <section className="pv-panel">
            <h2>Your profile</h2>
            <p style={{ marginTop: -6, color: "var(--pv-muted)" }}>
              What other members see. Your email is never shown; your WhatsApp number only if you’re open to it.
            </p>
            <PhotoField name={me.name} initial={me.photo_path} />
            <ProfileForm
              me={{
                name: me.name,
                phone: me.phone,
                bio: me.bio,
                interests: me.interests,
                cities: me.cities,
                instagram: me.instagram,
                open_to_connect: me.open_to_connect,
                show_in_directory: me.show_in_directory,
              }}
            />
          </section>
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          <section className="pv-panel">
            <h2>Membership</h2>
            <dl className="pv-kv">
              <dt>Tier</dt>
              <dd>{me.tier ? tierName(me.tier) : "—"}</dd>
              <dt>Status</dt>
              <dd style={{ textTransform: "capitalize" }}>{me.membership_status}</dd>
              {tier && (
                <>
                  <dt>You pay</dt>
                  <dd>
                    {tierPrice(tier, me.discount_percent, rate)}
                    {me.discount_name ? ` (${me.discount_name}, ${Number(me.discount_percent)}% off)` : ""}
                  </dd>
                </>
              )}
              {me.member_since && (
                <>
                  <dt>Member since</dt>
                  <dd>{fmtDate(me.member_since, { month: "long", year: "numeric" })}</dd>
                </>
              )}
              {me.renews_on && (
                <>
                  <dt>Renews</dt>
                  <dd>{fmtDate(me.renews_on, { month: "long", day: "numeric", year: "numeric" })}</dd>
                </>
              )}
              {tier?.pause_rule && (
                <>
                  <dt>Pausing</dt>
                  <dd>{tier.pause_rule}</dd>
                </>
              )}
            </dl>
            {term && (
              <div style={{ marginTop: 16 }}>
                {/* A route handler that sends the member on to Stripe, so a plain link, not <Link>. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a className={`pv-btn${dueSoon ? "" : " ghost"}`} href="/pay/membership/me">
                  {me.membership_status === "active" ? "Pay for the next" : "Pay for"} {TERM_NAME[tier!.period]},{" "}
                  {fmtAmount(term, tier!.currency)}
                </a>
                <p style={{ margin: "8px 0 0", color: "var(--pv-muted)", fontSize: 14 }}>
                  {me.membership_status === "active" && me.renews_on
                    ? "Paying early adds the time to the end of your current membership."
                    : "Your membership starts as soon as the payment goes through."}
                </p>
              </div>
            )}
            {tier && tier.perks.length > 0 && (
              <div className="pv-tags" style={{ marginTop: 14 }}>
                {tier.perks.map((x) => (
                  <span key={x} className="pv-tag">{x}</span>
                ))}
              </div>
            )}
          </section>
          <section className="pv-panel">
            <h2>Your bookings</h2>
            {!regs?.length ? (
              <p style={{ margin: 0, color: "var(--pv-muted)" }}>
                Nothing booked. <Link href="/portal/explore" style={{ color: "var(--pv-sea)" }}>See what’s on</Link>.
              </p>
            ) : (
              regs.map((r) =>
                r.offering ? (
                  <Link
                    key={r.id}
                    href={`/t/${r.qr_token}`}
                    className="pv-post"
                    style={{ display: "flex", justifyContent: "space-between", gap: 10, textDecoration: "none" }}
                  >
                    <span>
                      <b style={{ display: "block" }}>{r.offering.title}</b>
                      <span style={{ color: "var(--pv-muted)", fontSize: 14 }}>
                        {dayLabel(r.session_date, today)}, {timeRange(r.offering)}
                      </span>
                    </span>
                    <span className="pv-btn ghost sm">{r.checked_in_at ? "Checked in" : "Ticket"}</span>
                  </Link>
                ) : null,
              )
            )}
          </section>
          <form action="/auth/signout?to=portal" method="post">
            <button type="submit" className="pv-btn ghost">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
