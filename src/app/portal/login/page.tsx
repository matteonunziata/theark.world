import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LeafMark } from "@/components/leaf-mark";
import { getViewer } from "@/lib/auth";
import { MagicLinkForm } from "./magic-link-form";

export const metadata: Metadata = { title: "Members sign-in" };

export default async function PortalLogin({ searchParams }: PageProps<"/portal/login">) {
  const { error, next } = await searchParams;
  const { memberId, staff } = await getViewer();
  if (memberId || staff) redirect(typeof next === "string" ? next : "/portal");
  return (
    <main className="auth">
      <div className="auth-card">
        <LeafMark className="auth-leaf" />
        <div className="mark">
          The ARK <small>Members</small>
        </div>
        <h1>Members portal</h1>
        <p>
          Enter the email on your membership. We’ll send you a link to sign in,
          no password needed.
        </p>
        {typeof error === "string" && (
          <p className="auth-err" role="alert">
            {error}
          </p>
        )}
        <MagicLinkForm next={typeof next === "string" && next.startsWith("/") ? next : "/portal"} />
        <p className="auth-foot">
          On the team? <Link href="/login">Team sign-in</Link>
        </p>
      </div>
    </main>
  );
}
