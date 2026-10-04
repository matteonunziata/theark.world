import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { GateView } from "./gate-view";

export const metadata: Metadata = { title: "Gate" };

export default async function GatePage() {
  const { supabase } = await requireStaff("gate");
  const today = todayIn();
  const { data } = await supabase
    .from("registrations")
    .select(
      "id, name, qr_token, checked_in_at, paid, ticket_type_id, offering:offerings(title, start_time), ticket:ticket_types(name, price)",
    )
    .eq("session_date", today);
  const rows = (data ?? [])
    .filter((r) => r.offering)
    .sort(
      (a, b) =>
        (a.offering?.start_time ?? "").localeCompare(b.offering?.start_time ?? "") ||
        a.name.localeCompare(b.name),
    );
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Gate</h1>
          <p className="lede">
            Today’s bookings. Scan a ticket with your phone camera, look up the
            code on it, or check people in from the list.
          </p>
        </div>
      </div>
      <GateView rows={rows} />
    </div>
  );
}
