import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Steward platform" };

/** Where anyone who isn't an active steward lands if they open the steward platform. */
export default async function StewardClosed() {
  const { user, stewardId, staff, memberId } = await getViewer();
  if (!user) redirect("/portal/login?next=/steward");
  if (stewardId) redirect("/steward");
  return (
    <main className="auth">
      <div className="auth-card">
        <Logo tone="dark" kind="mark" height={220} className="auth-leaf" />
        <div className="auth-brand">
          <Logo tone="dark" height={34} />
        </div>
        <h1>The steward platform is for active stewards</h1>
        <p>
          {user.email} isn’t an active steward right now. If you think that’s a mistake, write to us and we’ll look
          into it.
        </p>
        {(staff || memberId) && (
          <p>
            <Link href={staff ? "/" : "/portal"}>{staff ? "Go to the team portal" : "Go to the members portal"}</Link>
          </p>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit" className="linkish-sm">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
