import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { CitiesView } from "./cities-view";

export const metadata: Metadata = { title: "Cities" };

export default async function CitiesPage() {
  const { supabase, staff } = await requireStaff("settings");
  const [{ data: cities }, { data: members }, { data: offerings }] = await Promise.all([
    supabase.from("cities").select("*").order("position").order("name"),
    supabase.from("contacts").select("city_id").not("city_id", "is", null),
    supabase.from("offerings").select("city_id").eq("status", "published"),
  ]);
  const count = (rows: { city_id: string | null }[] | null, id: string) =>
    (rows ?? []).filter((r) => r.city_id === id).length;
  return (
    <CitiesView
      cities={(cities ?? []).map((c) => ({
        ...c,
        members: count(members, c.id),
        offerings: count(offerings, c.id),
      }))}
      canEdit={staff.role === "admin" || staff.role === "lead"}
    />
  );
}
