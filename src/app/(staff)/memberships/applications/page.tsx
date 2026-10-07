import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { ApplicationsView } from "./applications-view";

export const metadata: Metadata = { title: "Applications · Memberships" };

export default async function ApplicationsPage() {
  const { supabase } = await requireStaff("memberships");
  const [{ data: rows }, { data: tiers }] = await Promise.all([
    supabase
      .from("membership_applications")
      .select(
        "id, plan, status, created_at, tried_day_pass, invited_by, building, why_join, contributing, drawn_to, invites, free_pass_id, contact:contacts(id, name, email, phone)",
      )
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("membership_tiers").select("key, name"),
  ]);
  const plan = (k: string) => tiers?.find((t) => t.key === k)?.name ?? k;
  const apps = (rows ?? []).flatMap((a) =>
    a.contact
      ? [{ ...a, contact: a.contact, planName: plan(a.plan), freePass: !!a.free_pass_id }]
      : [],
  );
  return <ApplicationsView apps={apps} />;
}
