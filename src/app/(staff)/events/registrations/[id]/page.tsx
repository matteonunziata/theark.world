import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { isLapsed, summarize } from "@/lib/event-stats";
import { money } from "@/lib/schedule";
import { type Row, RegistrationsView } from "./view";

export const metadata: Metadata = { title: "Registrations" };

export default async function RegistrationsPage({ params, searchParams }: PageProps<"/events/registrations/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, staff } = await requireStaff("events");
  const { data: org } = await supabase.rpc("public_org").maybeSingle();
  const timeZone = org?.timezone ?? "America/Costa_Rica";

  const [{ data: o }, { data: tickets }] = await Promise.all([
    supabase.from("offerings").select("*").eq("id", id).maybeSingle(),
    supabase.from("ticket_types").select("*").eq("offering_id", id).order("position"),
  ]);
  if (!o || o.kind === "class") notFound();

  // Page through the bookings; a big event can pass the 1,000-row default.
  const all: Awaited<ReturnType<typeof page>> = [];
  for (let at = 0; ; at += 1000) {
    const batch = await page(at);
    all.push(...batch);
    if (batch.length < 1000) break;
  }
  async function page(at: number) {
    const { data } = await supabase
      .from("registrations")
      .select("*, items:registration_items(ticket_type_id, qty, unit_price, currency)")
      .eq("offering_id", id)
      .order("created_at", { ascending: false })
      .range(at, at + 999);
    return data ?? [];
  }

  // A hold that ran out never became a booking.
  const live = all.filter((r) => !isLapsed(r));
  const dates = [...new Set(live.map((r) => r.session_date))].sort();
  const d = typeof sp.d === "string" && dates.includes(sp.d) ? sp.d : "";
  const regs = d ? live.filter((r) => r.session_date === d) : live;

  const day = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const stats = summarize(
    regs.map((r) => ({ ...r, items: r.items.map((i) => ({ ...i, unit_price: Number(i.unit_price) })) })),
    (tickets ?? []).map((t) => ({ id: t.id, name: t.name, kind: t.kind, qty: t.qty, position: t.position })),
    day,
  );

  const names = new Map((tickets ?? []).map((t) => [t.id, t.name]));
  const when = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const rows: Row[] = regs.map((r) => {
    const total: Record<string, number> = {};
    for (const i of r.items) total[i.currency] = (total[i.currency] ?? 0) + Number(i.unit_price) * i.qty;
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      sessionDate: r.session_date,
      registeredAt: when.format(new Date(r.created_at)),
      status: r.status === "cancelled" ? "cancelled" : r.status === "held" ? "pending" : "active",
      paid: r.paid,
      source: r.source,
      checkedIn: !!r.checked_in_at,
      token: r.qr_token,
      seats: r.seats,
      items: r.items.map((i) => ({ ticketId: i.ticket_type_id, name: (i.ticket_type_id && names.get(i.ticket_type_id)) || "Ticket", qty: i.qty })),
      total: Object.entries(total).map(([c, n]) => money(n, c)).join(" + "),
    };
  });

  const canManage = staff.role === "admin" || staff.role === "lead" || (staff.role === "facilitator" && o.facilitator_id === staff.id);
  const fmt = (m: Record<string, number>) => {
    const parts = Object.entries(m).filter(([, n]) => n > 0).map(([c, n]) => money(n, c));
    return parts.length ? parts.join(" + ") : money(0, "CRC");
  };

  return (
    <>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/events/events">← Events</Link>
      </p>
      <RegistrationsView
        offering={{ id: o.id, title: o.title, capacity: o.capacity, slug: o.slug, kind: o.kind }}
        tickets={(tickets ?? []).map((t) => ({ id: t.id, name: t.name, kind: t.kind, price: Number(t.price), currency: t.currency, qty: t.qty }))}
        rows={rows}
        dates={dates}
        date={d}
        canManage={canManage}
        stats={{
          registrations: stats.registrations,
          pending: stats.pending,
          cancelled: stats.cancelled,
          ticketsSold: stats.ticketsSold,
          revenue: fmt(stats.revenue),
          owed: fmt(stats.owed),
          refund: fmt(stats.refund),
          hasOwed: Object.values(stats.owed).some((n) => n > 0),
          hasRefund: Object.values(stats.refund).some((n) => n > 0),
          byType: stats.byType.map((t) => ({ id: t.ticket.id, name: t.ticket.name, kind: t.ticket.kind, capacity: t.ticket.qty, sold: t.sold, revenue: fmt(t.revenue) })),
          daily: stats.daily.map((x) => ({ day: x.day, bookings: x.bookings, tickets: x.tickets })),
        }}
      />
    </>
  );
}
