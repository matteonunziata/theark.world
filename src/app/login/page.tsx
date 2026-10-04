import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { MagicLinkForm } from "../portal/login/magic-link-form";
import { GoogleButton } from "./google-button";

// Set once the Google provider is configured in Supabase.
const GOOGLE = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "1";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { error } = await searchParams;
  const { staff } = await getViewer();
  if (staff) redirect("/");

  return (
    <main className="auth">
      <div className="auth-card">
        <Logo tone="dark" kind="mark" height={220} className="auth-leaf" />
        <div className="auth-brand">
          <Logo tone="dark" height={34} />
        </div>
        <h1>Team sign-in</h1>
        <p>
          Enter your @theark.world email and we’ll send you a link to sign in.
        </p>
        {typeof error === "string" && (
          <p className="auth-err" role="alert">
            {error}
          </p>
        )}
        <MagicLinkForm next="/" domain="theark.world" />
        {GOOGLE && (
          <>
            <p className="auth-or">or</p>
            <GoogleButton />
          </>
        )}
        <p className="auth-foot">
          A member? <Link href="/portal/login">Go to the members portal</Link>
        </p>
      </div>
    </main>
  );
}
