import type { Metadata } from "next";
import { PortalHead } from "@/components/portal-head";
import { brandParam } from "@/lib/marketing";
import { JoinForm } from "./join-form";

export const metadata: Metadata = {
  title: "Join the waitlist",
  description: "The ARK is a members club, farm and community in Santa Teresa, Costa Rica.",
};

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 120) : "");

export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  const sp = await searchParams;
  return (
    <>
      <PortalHead sub="Santa Teresa, Costa Rica" />
      <div className="p-body join">
        <h1>Join the waitlist</h1>
        <p className="ev-desc">
          The ARK is a members club, farm and community in Santa Teresa. We keep membership small and
          get to know everyone first. Leave your details and we’ll be in touch with what comes next.
        </p>
        <JoinForm
          utm={{
            utm_source: one(sp.utm_source) || one(sp.ref),
            utm_medium: one(sp.utm_medium),
            utm_campaign: one(sp.utm_campaign),
          }}
          brand={brandParam(sp.brand) ?? "membership"}
        />
      </div>
    </>
  );
}
