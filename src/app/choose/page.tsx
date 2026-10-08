import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export const metadata: Metadata = { title: "Where to?" };

/**
 * Where a sign-in link lands. Team members and facilitators pick between the
 * team portal and the members portal; everyone else goes straight on.
 */
export default async function ChoosePage() {
  const { user, staff, memberId } = await getViewer();
  if (!user) redirect("/login");
  if (!staff) redirect(memberId ? "/portal" : "/no-access");

  const facilitator = staff.role === "facilitator";
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
          <a href={homeFor(staff.role)}>
            <b>Team portal</b>
            <span>
              {facilitator
                ? "Your classes and who’s coming."
                : "ARK OS, for the work of running The ARK."}
            </span>
          </a>
          <a href="/portal">
            <b>Sign in</b>
            <span>Schedule, bookings, the shop and the community.</span>
          </a>
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
