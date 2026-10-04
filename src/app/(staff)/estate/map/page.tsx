import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { EstateHead } from "../estate-head";
import { MapView } from "./map-view";

export const metadata: Metadata = { title: "Map" };

export default async function EstateMapPage({ searchParams }: PageProps<"/estate/map">) {
  const { lot } = await searchParams;
  const { supabase } = await requireStaff("estate");
  const [{ data: lots }, { data: people }] = await Promise.all([
    supabase
      .from("lots")
      .select("id, code, name, kind, features, status, size_m2, price, currency, estate_lot_id, owner_contact_id, in_hospitality, home_status, home_name")
      .order("code"),
    supabase.from("contacts").select("id, name"),
  ]);
  const owners = new Map((people ?? []).map((p) => [p.id, p.name]));
  return (
    <div className="page">
      <EstateHead />
      <MapView
        lots={(lots ?? []).map((l) => ({
          ...l,
          owner: l.owner_contact_id ? (owners.get(l.owner_contact_id) ?? null) : null,
        }))}
        initial={typeof lot === "string" ? lot : null}
      />
    </div>
  );
}
