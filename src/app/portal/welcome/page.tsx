import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArkFonts } from "@/components/ark-fonts";
import { Logo } from "@/components/logo";
import { ToastProvider } from "@/components/toast";
import { loadPortal } from "@/lib/portal";
import "../portal.css";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Welcome" };

/** The quick set-up a new member does once, from the welcome email. */
export default async function WelcomePage() {
  const p = await loadPortal();
  const { me } = p;
  if (!me) redirect("/portal");
  if (me.onboarded_at) redirect("/portal");
  const first = me.name.split(/\s+/)[0];
  return (
    <ToastProvider>
      <ArkFonts />
      <div className="pv ark-type">
        <main className="pv-main pv-welcome">
          <Logo tone="dark" height={28} />
          <span className="eyebrow">Welcome to {p.orgName}</span>
          <h1>Good to have you here{first ? `, ${first}` : ""}.</h1>
          <p className="lead">
            Two minutes to set up your profile, so the people you meet here know who you are. You can change
            any of it later under Me.
          </p>
          <WelcomeForm
            me={{
              name: me.name,
              email: me.email,
              phone: me.phone,
              instagram: me.instagram,
              bio: me.bio,
              cities: me.cities,
              photo_path: me.photo_path,
              open_to_connect: me.open_to_connect,
            }}
          />
        </main>
      </div>
    </ToastProvider>
  );
}
