import { staffOrThrow } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import { csvResponse, pdfResponse } from "@/lib/export-file";
import { isLapsed } from "@/lib/event-stats";

/**
 * One event's attendee list, one row per booking with a column for every ticket type and
 * add-on. ?d=<date> limits it to one date; ?fmt=pdf gives the printable page.
 * Cancelled bookings and lapsed holds are left out, since this is the list the team prints.
 */
export async function GET(req: Request, { params }: RouteContext<"/events/event-analytics/[id]/export">) {
  const { id } = await params;
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const q = new URL(req.url).searchParams;
  const d = q.get("d");
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";

  const [{ data: o }, { data: tickets }, { data: org }] = await Promise.all([
    supabase.from("offerings").select("id, title, kind, start_time").eq("id", id).maybeSingle(),
    supabase.from("ticket_types").select("id, name, kind").eq("offering_id", id).order("position"),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  if (!o || o.kind === "class") return new Response("Not found", { status: 404 });
  const timeZone = org?.timezone ?? "America/Costa_Rica";

  const all: {
    session_date: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
    hold_until: string | null;
    paid: boolean;
    source: string;
    seats: number;
    checked_in_at: string | null;
    created_at: string;
    items: { ticket_type_id: string | null; qty: number; unit_price: number; currency: string }[];
  }[] = [];
  for (let at = 0; ; at += 1000) {
    let query = supabase
      .from("registrations")
      .select("session_date, name, email, phone, status, hold_until, paid, source, seats, checked_in_at, created_at, items:registration_items(ticket_type_id, qty, unit_price, currency)")
      .eq("offering_id", id)
      .neq("status", "cancelled")
      .order("session_date")
      .order("name")
      .range(at, at + 999);
    if (date) query = query.eq("session_date", date);
    const { data } = await query;
    all.push(...(data ?? []).map((r) => ({ ...r, items: r.items.map((i) => ({ ...i, unit_price: Number(i.unit_price) })) })));
    if ((data?.length ?? 0) < 1000) break;
  }
  const regs = all.filter((r) => !isLapsed(r));

  const when = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const types = tickets ?? [];
  const header = [
    "Date",
    "Name",
    "Email",
    "Phone",
    ...types.map((t) => (t.kind === "addon" ? `${t.name} (add-on)` : t.name)),
    "Spots",
    "Total",
    "Status",
    "Paid",
    "Checked in",
    "Booked via",
    "Registered",
  ];
  const rows = regs.map((r) => {
    const sums: Record<string, number> = {};
    for (const i of r.items) sums[i.currency] = (sums[i.currency] ?? 0) + i.unit_price * i.qty;
    return [
      r.session_date,
      r.name,
      r.email ?? "",
      r.phone ?? "",
      ...types.map((t) => r.items.filter((i) => i.ticket_type_id === t.id).reduce((n, i) => n + i.qty, 0) || ""),
      r.seats,
      Object.entries(sums).map(([c, n]) => `${n} ${c}`).join(" + "),
      r.status === "held" ? "Pending payment" : "Confirmed",
      r.paid ? "Yes" : "",
      r.checked_in_at ? "Yes" : "",
      r.source,
      when.format(new Date(r.created_at)),
    ];
  });

  const slug = o.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";
  const name = `attendees-${slug}${date ? `-${date}` : ""}`;
  if (q.get("fmt") === "pdf") {
    const spots = regs.reduce((n, r) => n + r.seats, 0);
    return pdfResponse(`Attendees, ${o.title}`, [
      {
        title: o.title,
        sub: `${date ? fmtDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "All dates"} · ${regs.length} ${regs.length === 1 ? "booking" : "bookings"}, ${spots} ${spots === 1 ? "spot" : "spots"}`,
        header: header.filter((h) => !["Registered", "Booked via", "Total"].includes(h)),
        rows: rows.map((r) => r.filter((_, i) => ![header.length - 1, header.length - 2, header.indexOf("Total")].includes(i))),
      },
    ]);
  }
  return csvResponse(name, header, rows);
}
