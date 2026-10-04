import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { addDays, todayIn, weekStart } from "@/lib/dates";
import { HospitalityHead } from "./hospitality-head";
import { HospitalityView } from "./hospitality-view";

export const metadata: Metadata = { title: "Hospitality" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function HospitalityPage({ searchParams }: PageProps<"/hospitality">) {
  const { from, lot } = await searchParams;
  const { supabase } = await requireStaff("hospitality");
  const today = todayIn();
  const start = weekStart(typeof from === "string" && ISO.test(from) ? from : today);
  const [{ data: lots }, { data: stays }, { data: photos }] = await Promise.all([
    supabase
      .from("lots")
      .select("id, code, name, home_name, listing_title, listing_published, nightly_rate, rate_currency, max_guests, min_nights, in_hospitality, photo_path, bedrooms, owner_contact_id")
      .order("code"),
    // Everything from a month back, so the calendar and availability
    // search have what they need.
    supabase
      .from("stays")
      .select("*")
      .gte("check_out", addDays(today < start ? today : start, -31))
      .order("check_in"),
    supabase.from("listing_photos").select("lot_id, path, position").order("position"),
  ]);
  const cover = new Map<string, string>();
  for (const p of photos ?? []) if (!cover.has(p.lot_id)) cover.set(p.lot_id, p.path);
  const all = lots ?? [];
  const list = stays ?? [];
  // Homes in the programme, plus any home that still has stays on the books.
  const homes = all
    .filter((l) => l.in_hospitality || list.some((s) => s.lot_id === l.id))
    .map((l) => ({ ...l, photo_path: cover.get(l.id) ?? l.photo_path }));

  return (
    <div className="page">
      <HospitalityHead />
      <HospitalityView
        homes={homes}
        allLots={all}
        stays={list}
        today={today}
        from={start}
        focus={typeof lot === "string" ? lot : null}
      />
    </div>
  );
}
