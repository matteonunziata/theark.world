import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage() {
  const { user } = await getViewer();
  return (
    <main className="auth">
      <div className="auth-card">
        <Logo tone="dark" kind="mark" height={220} className="auth-leaf" />
        <div className="auth-brand">
          <Logo tone="dark" height={34} />
        </div>
        <h1>You’re signed in, but not set up yet</h1>
        <p>
          {user?.email ? `${user.email} isn’t` : "This account isn’t"} active
          in ARK OS. Ask an admin to add you, or turn you back on, in Settings,
          Team.
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
