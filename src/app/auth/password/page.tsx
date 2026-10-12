import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArkFonts } from "@/components/ark-fonts";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Set a password" };

export default async function PasswordPage({ searchParams }: PageProps<"/auth/password">) {
  const { next } = await searchParams;
  const { user } = await getViewer();
  if (!user) redirect("/login");
  const dest = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/choose";
  return (
    <main className="auth ark-type">
      <ArkFonts />
      <div className="auth-card">
        <Logo tone="dark" kind="mark" height={220} className="auth-leaf" />
        <div className="auth-brand">
          <Logo tone="dark" height={34} />
        </div>
        <h1>{user.user_metadata?.has_password ? "Change your password" : "Set a password"}</h1>
        <p>
          {user.user_metadata?.has_password
            ? "Choose a new password for "
            : "Your email is confirmed. Add a password so next time you only need your email and password. You’ll also stay signed in on this device. "}
          {user.user_metadata?.has_password && <b>{user.email}</b>}
        </p>
        <PasswordForm next={dest} canSkip={!user.user_metadata?.has_password} />
      </div>
    </main>
  );
}
