import type { Metadata } from "next";
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
        <h1>Sign in</h1>
        <p>
          Enter your email and we’ll send you a link to sign in. The same
          sign-in works for the team, facilitators and members.
        </p>
        {typeof error === "string" && (
          <p className="auth-err" role="alert">
            {error}
          </p>
        )}
        <MagicLinkForm next="/" />
        {GOOGLE && (
          <>
            <p className="auth-or">or</p>
            <GoogleButton />
          </>
        )}
      </div>
    </main>
  );
}
