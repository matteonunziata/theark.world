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
  const now = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Costa_Rica",
  }).format(new Date());
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Gate</h1>
          <p className="lede">
            Today’s bookings. Scan a ticket or member pass with your phone
            camera, look up the code on it, or check people in from the list.
            Tickets open an hour before the start; member passes work any time
            their membership covers.
          </p>
        </div>
      </div>
      <GateView rows={rows} now={now} />
    </div>
  );
}
