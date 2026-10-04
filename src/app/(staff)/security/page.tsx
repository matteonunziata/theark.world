import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { SecurityView } from "./security-view";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const { supabase } = await requireStaff("security");
  const today = todayIn();
  const [{ data }, { data: guests }] = await Promise.all([
    supabase
    .from("registrations")
    .select(
      "id, name, qr_token, checked_in_at, paid, ticket_type_id, offering:offerings(title, start_time), ticket:ticket_types(name, price)",
    )
    .eq("session_date", today),
    supabase.rpc("todays_guests"),
  ]);
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
          <h1>Security</h1>
          <p className="lede">
            Scan any ticket, member pass or guest pass with your phone camera.
            The screen turns green when they can come in. You can also look up
            the code printed under the QR, or check people in from the lists.
          </p>
        </div>
      </div>
      <SecurityView rows={rows} now={now} guests={guests ?? []} />
    </div>
  );
}
