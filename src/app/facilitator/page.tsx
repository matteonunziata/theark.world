import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { MagicLinkForm } from "../portal/login/magic-link-form";

export const metadata: Metadata = { title: "Facilitator sign-in" };

export default async function FacilitatorLogin({
  searchParams,
}: PageProps<"/facilitator">) {
  const { error } = await searchParams;
  const { staff } = await getViewer();
  if (staff) redirect(staff.role === "facilitator" ? "/classes" : "/");

  return (
    <main className="auth">
      <div className="auth-card">
        <Logo tone="dark" kind="mark" height={220} className="auth-leaf" />
        <div className="auth-brand">
          <Logo tone="dark" height={34} />
        </div>
        <h1>Facilitators</h1>
        <p>
          Enter the email The ARK has for you. We’ll send you a link to sign in
          and see your classes and who’s coming.
        </p>
        {typeof error === "string" && (
          <p className="auth-err" role="alert">
            {error}
          </p>
        )}
        <MagicLinkForm next="/classes" audience="facilitator" />
        <p className="auth-foot">
          On the team? <Link href="/login">Team sign-in</Link>
        </p>
      </div>
    </main>
  );
}
