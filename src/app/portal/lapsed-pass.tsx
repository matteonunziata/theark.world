import Link from "next/link";
import { fmtDate } from "@/lib/dates";
import { APPLY_URL, passUrl } from "../(public)/ark-membership/plans";

type Last = { ends_on: string | null; activate_by: string | null; tier: { name: string; period: string } | null } | null;

/**
 * What a signed-in person sees in place of every portal page once their pass
 * or membership has ended: booking, guests and the rest need a live one.
 */
export function LapsedPass({ last, name }: { last: Last; name: string }) {
  const long = !!last?.tier && !["day", "week"].includes(last.tier.period);
  const day = (d: string) => fmtDate(d, { month: "long", day: "numeric", year: "numeric" });
  const what = last?.tier?.name ?? "pass";
  const when = last?.ends_on
    ? `Your ${what.toLowerCase()} ended on ${day(last.ends_on)}.`
    : last?.activate_by
      ? `Your ${what.toLowerCase()} wasn’t used by ${day(last.activate_by)}.`
      : "Your pass has ended.";
  const first = name.split(/\s+/)[0];
  return (
    <div className="pv-empty" role="status">
      <h3>{first ? `${first}, your pass has ended` : "Your pass has ended"}</h3>
      <p>
        {when} Booking classes and courts, guests, the shop and the rest of the portal come back with a new pass.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 16 }}>
        {long && (
          <Link className="pv-btn" href="/pay/membership/me" prefetch={false /* opens Stripe */}>
            Renew {what}
          </Link>
        )}
        <Link className={long ? "pv-btn ghost" : "pv-btn"} href={passUrl("day")}>
          Buy a day pass
        </Link>
        <Link className="pv-btn ghost" href={passUrl("week")}>
          Buy a week pass
        </Link>
        <Link className="pv-btn ghost" href={APPLY_URL}>
          Apply for membership
        </Link>
      </div>
      <form action="/auth/signout" method="post" style={{ marginTop: 18 }}>
        <button type="submit" className="pv-btn ghost sm">
          Sign out
        </button>
      </form>
    </div>
  );
}
