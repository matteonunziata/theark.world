import { staffOrThrow } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/dates";
import { csvResponse, pdfResponse } from "@/lib/export-file";
import { tierName } from "@/lib/facilitator-pay";
import { loadAnalytics } from "../load";

/** Every class session in the period with bookings, check-ins and facilitator pay. */
export async function GET(req: Request) {
  const { supabase } = await staffOrThrow("admin", "lead");
  const q = new URL(req.url).searchParams;
  const a = await loadAnalytics(supabase, { p: q.get("p") ?? undefined, d: q.get("d") ?? undefined });
  const header = ["Date", "Time", "Class", "Facilitator", "Booked", "Checked in", "Pay tier", "Facilitator pay (CRC)"];
  const rows = a.sessionRows
    .filter((x) => !x.cancelled)
    .map((x) => [
      x.date,
      fmtTime(x.o.start_time),
      x.o.title,
      x.facilitator,
      x.booked,
      x.checked,
      `${x.o.facilitator_pay_tier} ${tierName(x.o.facilitator_pay_tier)}`,
      x.pay,
    ]);
  const name = `class-sessions-${a.from}-to-${a.to}`;
  if (q.get("fmt") === "pdf") {
    const shown = rows.map((r) => [fmtDate(String(r[0]), { month: "short", day: "numeric" }), ...r.slice(1)]);
    return pdfResponse(`Class sessions, ${a.label}`, [{ title: "Sessions", header, rows: shown }]);
  }
  return csvResponse(name, header, rows);
}
