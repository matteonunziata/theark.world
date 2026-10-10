import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export const metadata: Metadata = { title: "Where to?" };

/**
 * Where a sign-in link lands. One sign-in for everyone: the email says who
 * someone is (team, member, active steward). With one place they go straight
 * there; with several they choose.
 */
export default async function ChoosePage() {
  const { user, staff, memberId, stewardId } = await getViewer();
  if (!user) redirect("/login");
  const places = [
    staff && {
      href: homeFor(staff.role),
      title: "Team portal",
      text:
        staff.role === "facilitator"
          ? "Your classes and who’s coming."
          : "ARK OS, for the work of running The ARK.",
    },
    (memberId || staff) && {
      href: "/portal",
      title: "Members portal",
      text: "Schedule, bookings, the shop and the community.",
    },
    stewardId && {
      href: "/steward",
      title: "Steward platform",
      text: "Your property: hospitality, maintenance, household and requests.",
    },
  ].filter((p): p is { href: string; title: string; text: string } => !!p);
  if (places.length === 0) redirect("/no-access");
  if (places.length === 1 && !staff) redirect(places[0].href);

  return (
    <main className="auth">
      <div className="auth-card">
        <Logo tone="dark" kind="mark" height={220} className="auth-leaf" />
        <div className="auth-brand">
          <Logo tone="dark" height={34} />
        </div>
        <h1>Where to?</h1>
        <p>You’re signed in as {user.email}. Choose where you’d like to go.</p>
        <div className="auth-pick">
          {places.map((p) => (
            <a key={p.href} href={p.href}>
              <b>{p.title}</b>
              <span>{p.text}</span>
            </a>
          ))}
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" className="linkish-sm">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
