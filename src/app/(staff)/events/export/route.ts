import { staffOrThrow } from "@/lib/auth";
import { todayIn, fmtDate, fmtTime } from "@/lib/dates";
import { csvResponse, pdfResponse } from "@/lib/export-file";
import { sessions } from "@/lib/schedule";

/**
 * Attendee lists. ?o=<offering>&d=<date> for one session, or ?from=&to= (and
 * optionally ?kind=class|event|experience|expedition) for every session in a range.
 */
export async function GET(req: Request) {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const q = new URL(req.url).searchParams;
  const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const o = q.get("o");
  const d = q.get("d");
  const from = isDate(q.get("from")) ? q.get("from")! : isDate(d) ? d : todayIn();
  const to = isDate(q.get("to")) ? q.get("to")! : isDate(d) ? d : from;
  const kind = q.get("kind") ?? "";

  const [{ data: offerings }, { data: cancels }, { data: regs }, { data: tickets }, { data: team }] = await Promise.all([
    supabase.from("offerings").select("*"),
    supabase.from("session_cancellations").select("offering_id, session_date").gte("session_date", from).lte("session_date", to),
    supabase
      .from("registrations")
      .select("offering_id, session_date, name, email, ticket_type_id, paid, source, status, hold_until, checked_in_at, created_at")
      .gte("session_date", from)
      .lte("session_date", to)
      .order("created_at")
      .limit(5000),
    supabase.from("ticket_types").select("id, name"),
    supabase.from("team_members").select("id, name"),
  ]);
  const fac = new Map((team ?? []).map((m) => [m.id, m.name]));
  const tk = new Map((tickets ?? []).map((t) => [t.id, t.name]));
  const list = sessions((offerings ?? []).filter((x) => !o || x.id === o), cancels ?? [], from, to, { kind })
    .filter((s) => !s.cancelled);

  const header = ["Name", "Email", "Ticket", "Paid", "Booked via", "Checked in"];
  const secs = list.map((s) => {
    const mine = (regs ?? []).filter(
      (r) =>
        r.offering_id === s.o.id &&
        r.session_date === s.date &&
        r.status !== "cancelled" &&
        (r.checked_in_at || r.status === "confirmed" || !r.hold_until || new Date(r.hold_until) > new Date()),
    );
    return {
      s,
      rows: mine.map((r) => [
        r.name,
        r.email ?? "",
        (r.ticket_type_id && tk.get(r.ticket_type_id)) || "Member",
        r.paid ? "Yes" : "",
        r.source,
        r.checked_in_at ? "Yes" : "",
      ]),
    };
  });

  if (q.get("fmt") === "pdf") {
    return pdfResponse(
      from === to ? `Attendees, ${fmtDate(from, { month: "long", day: "numeric", year: "numeric" })}` : `Attendees, ${from} to ${to}`,
      secs.map(({ s, rows }) => ({
        title: s.o.title,
        sub: `${fmtDate(s.date, { weekday: "long", month: "long", day: "numeric" })}${s.o.start_time ? `, ${fmtTime(s.o.start_time)}` : ""}${
          s.o.facilitator_id ? ` · ${fac.get(s.o.facilitator_id) ?? ""}` : ""
        } · ${rows.length} booked${s.o.capacity ? ` of ${s.o.capacity}` : ""}`,
        header,
        rows,
      })),
    );
  }
  const full = ["Date", "Time", "Event", "Type", "Facilitator", ...header];
  const rows = secs.flatMap(({ s, rows }) =>
    rows.map((r) => [s.date, fmtTime(s.o.start_time), s.o.title, s.o.kind, (s.o.facilitator_id && fac.get(s.o.facilitator_id)) || "", ...r]),
  );
  return csvResponse(`attendees-${from}${to !== from ? `-to-${to}` : ""}`, full, rows);
}
