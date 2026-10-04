import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { PeopleView } from "./people-view";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const { supabase, staff } = await requireStaff("crm");
  const [{ data: contacts }, { data: owners }, { data: tiers }, { data: discounts }] = await Promise.all([
    supabase.from("contacts").select("*").order("name"),
    supabase
      .from("team_members")
      .select("id, name")
      .in("role", ["admin", "sales"])
      .eq("status", "active")
      .order("name"),
    supabase.from("membership_tiers").select("key, name, price, currency, period, active").order("position"),
    supabase.from("discounts").select("id, name, percent, active").order("name"),
  ]);
  return (
    <PeopleView
      contacts={contacts ?? []}
      owners={owners ?? []}
      tiers={tiers ?? []}
      discounts={discounts ?? []}
      role={staff.role}
    />
  );
}
