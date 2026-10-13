import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArkFonts } from "@/components/ark-fonts";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { MagicLinkForm } from "./magic-link-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function PortalLogin({ searchParams }: PageProps<"/portal/login">) {
  const { error, next } = await searchParams;
  const { portalId, staff } = await getViewer();
  if (portalId || staff) redirect(typeof next === "string" && next.startsWith("/") ? next : "/");
  return (
    <main className="auth ark-type">
      <ArkFonts />
      <div className="auth-card">
        <Logo tone="dark" kind="mark" height={220} className="auth-leaf" />
        <div className="auth-brand">
          <Logo tone="dark" height={34} />
        </div>
        <h1>Sign in</h1>
        <p>
          Sign in with your email and password. First time, or forgot it?
          We’ll email you a link, then you can set a password. Members, active stewards, team members and facilitators all sign in here.
        </p>
        {typeof error === "string" && (
          <p className="auth-err" role="alert">
            {error}
          </p>
        )}
        <MagicLinkForm next={typeof next === "string" && next.startsWith("/") ? next : "/choose"} />
      </div>
    </main>
  );
}
