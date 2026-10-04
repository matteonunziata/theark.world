import "server-only";
import { requireStaff } from "@/lib/auth";

/** Everything the staff events screens need, filtered by RLS. */
export async function loadEvents(from: string, to: string) {
  const v = await requireStaff("events");
  const { supabase } = v;
  const [offerings, tickets, cancels, regs, team, org] = await Promise.all([
    supabase.from("offerings").select("*").order("title"),
    supabase.from("ticket_types").select("*").order("position"),
    supabase
      .from("session_cancellations")
      .select("offering_id, session_date")
      .gte("session_date", from)
      .lte("session_date", to),
    supabase
      .from("registrations")
      .select("id, offering_id, session_date, name, email, ticket_type_id, paid, source, qr_token, checked_in_at")
      .gte("session_date", from)
      .lte("session_date", to)
      .order("created_at"),
    supabase
      .from("team_members")
      .select("id, name, type")
      .eq("status", "active")
      .order("name"),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  return {
    staff: v.staff,
    offerings: offerings.data ?? [],
    tickets: tickets.data ?? [],
    cancellations: cancels.data ?? [],
    registrations: regs.data ?? [],
    team: team.data ?? [],
    orgName: org.data?.name ?? "The ARK",
  };
}

export type EventsData = Awaited<ReturnType<typeof loadEvents>>;
