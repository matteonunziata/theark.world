import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { addDays, todayIn, weekStart } from "@/lib/dates";
import { HospitalityView } from "./hospitality-view";

export const metadata: Metadata = { title: "Hospitality" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function HospitalityPage({ searchParams }: PageProps<"/hospitality">) {
  const { from, lot } = await searchParams;
  const { supabase } = await requireStaff("hospitality");
  const today = todayIn();
  const start = weekStart(typeof from === "string" && ISO.test(from) ? from : today);
  const [{ data: lots }, { data: stays }] = await Promise.all([
    supabase
      .from("lots")
      .select("id, code, name, nightly_rate, rate_currency, max_guests, min_nights, in_hospitality, photo_path, bedrooms, owner_contact_id")
      .order("code"),
    // Everything from a month back, so the calendar and availability
    // search have what they need.
    supabase
      .from("stays")
      .select("*")
      .gte("check_out", addDays(today < start ? today : start, -31))
      .order("check_in"),
  ]);
  const all = lots ?? [];
  const list = stays ?? [];
  // Homes in the programme, plus any home that still has stays on the books.
  const homes = all.filter((l) => l.in_hospitality || list.some((s) => s.lot_id === l.id));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Hospitality</h1>
          <p className="lede">
            Homes in the active stewardship programme: who’s staying, who’s
            arriving, and which homes are free.
          </p>
        </div>
      </div>
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
