"use server";

import { revalidatePath } from "next/cache";
import {
  type ActionResult,
  fail,
  field,
  friendly,
  ok,
} from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { listStripePrices } from "@/lib/stripe";
import { dow } from "@/lib/dates";
import { sendTicketEmail } from "@/lib/email";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const refresh = () => {
  revalidatePath("/events", "layout");
  revalidatePath("/security");
  revalidatePath("/portal", "layout");
  revalidatePath("/e", "layout");
};

export async function saveOffering(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin", "lead", "facilitator");
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("offerings").delete().eq("id", id);
    if (error) return fail(friendly(error));
    refresh();
    return ok("Deleted");
  }
  if (!id && staff.role === "facilitator") {
    return fail("Ask a lead to add new classes and events.");
  }

  const k = field(data, "kind");
  const kind = k === "event" || k === "experience" || k === "expedition" ? k : "class";
  const title = field(data, "title");
  const r = field(data, "repeat");
  const repeat = r === "weekly" || r === "monthly" || r === "dates" ? r : "none";
  const customDates = [
    ...new Set(
      data.getAll("custom_date").map((x) => String(x)).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)),
    ),
  ].sort();
  if (repeat === "dates" && !customDates.length) return fail("Add at least one date.");
  const start_date = repeat === "dates" ? customDates[0] : field(data, "start_date");
  const start_time = field(data, "start_time");
  const end_time = field(data, "end_time");
  const days = data.getAll("days").map(Number).filter((n) => n >= 0 && n <= 6);
  if (!title) return fail("Enter a name.");
  if (!start_date) return fail("Choose a date.");
  if (repeat === "weekly" && !days.length) return fail("Pick at least one day.");
  if (start_time && end_time && end_time <= start_time) {
    return fail("End after the start time.");
  }
  const capacity = Number(field(data, "capacity") ?? 0);
  const cutoffAmount = field(data, "cutoff_amount");
  const cutoffMinutes =
    cutoffAmount === null || cutoffAmount === "" || Number.isNaN(Number(cutoffAmount))
      ? null
      : Math.max(0, Math.round(Number(cutoffAmount) * (field(data, "cutoff_unit") === "hours" ? 60 : 1)));
  const tier = Number(field(data, "facilitator_pay_tier"));

  const row = {
    kind,
    title,
    description: field(data, "description"),
    facilitator_id: field(data, "facilitator_id"),
    location: field(data, "location"),
    repeat,
    start_date,
    end_date: repeat === "dates" ? customDates[customDates.length - 1] : field(data, "end_date"),
    custom_dates: repeat === "dates" ? customDates : [],
    repeat_every: repeat === "weekly" || repeat === "monthly" ? Math.min(12, Math.max(1, Math.round(Number(field(data, "repeat_every")) || 1))) : 1,
    month_mode: field(data, "month_mode") === "weekday" ? "weekday" : "date",
    city_id: field(data, "city_id"),
    days: repeat === "weekly" ? days : [dow(start_date)],
    start_time,
    end_time,
    capacity: capacity > 0 ? capacity : null,
    booking_cutoff_minutes: cutoffMinutes,
    facilitator_pay_tier: tier === 2 || tier === 3 ? tier : 1,
    // Classes are members-only; events choose.
    access:
      kind === "class"
        ? "members"
        : field(data, "access") === "members"
          ? "members"
          : "everyone",
    status: field(data, "status") === "draft" ? "draft" : "published",
    cover_path: field(data, "cover_path"),
  };

  const tickets = data
    .getAll("t_name")
    .map((n, i) => ({
      id: String(data.getAll("t_id")[i] ?? "") || null,
      name: String(n).trim(),
      price: Math.max(0, Number(data.getAll("t_price")[i] || 0)),
      currency: data.getAll("t_cur")[i] === "USD" ? "USD" : "CRC",
      qty: Number(data.getAll("t_qty")[i] || 0) || null,
      payment_link: String(data.getAll("t_link")[i] ?? "").trim() || null,
      // Meals: the booking is a hold until it's paid.
      pay_first: String(data.getAll("t_when")[i] ?? "") === "first",
      stripe_price_id: String(data.getAll("t_stripe")[i] ?? "").trim() || null,
      position: i,
    }))
    .filter((t) => t.name);
  // A Stripe product sets the price; the amount shown everywhere is Stripe's.
  const chosen = tickets.filter((t) => t.stripe_price_id);
  if (chosen.length) {
    const prices = await listStripePrices().catch(() => []);
    for (const t of chosen) {
      const sp = prices.find((x) => x.priceId === t.stripe_price_id);
      if (!sp) return fail("That Stripe product isn’t available any more. Pick another.");
      t.price = sp.amount;
      t.currency = sp.currency;
    }
  }
  if (tickets.some((t) => t.payment_link && !t.payment_link.startsWith("https://"))) {
    return fail("Payment links need to start with https://");
  }

  let offeringId = id;
  if (id) {
    const { error } = await supabase.from("offerings").update(row).eq("id", id);
    if (error) return fail(friendly(error));
  } else {
    const { data: created, error } = await supabase
      .from("offerings")
      .insert({ ...row, created_by: staff.id })
      .select("id")
      .single();
    if (error) return fail(friendly(error));
    offeringId = created.id;
  }

  // Tickets: update kept ones, add new ones, remove the rest.
  const { data: existing } = await supabase
    .from("ticket_types")
    .select("id")
    .eq("offering_id", offeringId!);
  const keep = new Set(tickets.map((t) => t.id).filter(Boolean));
  const gone = (existing ?? []).filter((t) => !keep.has(t.id)).map((t) => t.id);
  if (gone.length) {
    const { error } = await supabase.from("ticket_types").delete().in("id", gone);
    if (error) return fail(friendly(error));
  }
  for (const t of tickets) {
    const { id: tid, ...rest } = t;
    const { error } = tid
      ? await supabase.from("ticket_types").update(rest).eq("id", tid)
      : await supabase
          .from("ticket_types")
          .insert({ ...rest, offering_id: offeringId! });
    if (error) return fail(friendly(error));
  }

  refresh();
  return ok(id ? "Changes saved" : `${title} created`);
}

export async function toggleSession(offeringId: string, date: string, cancel: boolean) {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const { error } = cancel
    ? await supabase
        .from("session_cancellations")
        .insert({ offering_id: offeringId, session_date: date })
    : await supabase
        .from("session_cancellations")
        .delete()
        .eq("offering_id", offeringId)
        .eq("session_date", date);
  if (error) return fail(friendly(error));
  refresh();
  return ok(cancel ? "Session cancelled" : "Session restored");
}

export async function addBooking(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const offeringId = field(data, "offering_id");
  const date = field(data, "session_date");
  const name = field(data, "name");
  const email = field(data, "email")?.toLowerCase() ?? null;
  if (!offeringId || !date) return fail("Pick a session.");
  if (!name) return fail("Enter a name.");
  if (email && !EMAIL.test(email)) return fail("Enter a valid email.");

  const [{ data: o }, { count }] = await Promise.all([
    supabase.from("offerings").select("*").eq("id", offeringId).single(),
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("offering_id", offeringId)
      .eq("session_date", date),
  ]);
  if (!o) return fail("That session no longer exists.");
  if (o.capacity && (count ?? 0) >= o.capacity) return fail("This session is full.");

  // Link to the CRM contact when we know them.
  const { data: contact } = email
    ? await supabase.from("contacts").select("id").eq("email", email).maybeSingle()
    : { data: null };

  const { data: reg, error } = await supabase
    .from("registrations")
    .insert({
      offering_id: offeringId,
      session_date: date,
      name,
      email,
      ticket_type_id: field(data, "ticket_type_id"),
      contact_id: contact?.id ?? null,
      source: "staff",
    })
    .select("qr_token")
    .single();
  if (error) {
    if (error.code === "23505") return fail("They’re already booked for this session.");
    return fail(friendly(error));
  }

  let sent = false;
  if (email) {
    const { data: org } = await supabase.rpc("public_org").maybeSingle();
    sent = await sendTicketEmail({
      to: email,
      holder: name,
      title: o.title,
      sessionDate: date,
      startTime: o.start_time,
      endTime: o.end_time,
      location: o.location,
      token: reg.qr_token,
      orgName: org?.name ?? "The ARK",
    });
  }
  refresh();
  return ok(sent ? `${name} booked, ticket emailed` : `${name} booked`);
}

export async function setPaid(registrationId: string, paid: boolean) {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const { error } = await supabase
    .from("registrations")
    .update({ paid })
    .eq("id", registrationId);
  if (error) return fail(friendly(error));
  refresh();
  return ok(paid ? "Marked paid" : "Marked unpaid");
}

export async function removeBooking(registrationId: string) {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const { error } = await supabase
    .from("registrations")
    .delete()
    .eq("id", registrationId);
  if (error) return fail(friendly(error));
  refresh();
  return ok("Booking removed");
}

export async function emailTicket(registrationId: string) {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const { data: r } = await supabase
    .from("registrations")
    .select("name, email, session_date, qr_token, offering:offerings(title, start_time, end_time, location)")
    .eq("id", registrationId)
    .single();
  if (!r?.email || !r.offering) return fail("There’s no email on this booking.");
  const { data: org } = await supabase.rpc("public_org").maybeSingle();
  const sent = await sendTicketEmail({
    to: r.email,
    holder: r.name,
    title: r.offering.title,
    sessionDate: r.session_date,
    startTime: r.offering.start_time,
    endTime: r.offering.end_time,
    location: r.offering.location,
    token: r.qr_token,
    orgName: org?.name ?? "The ARK",
  });
  return sent
    ? ok(`Ticket emailed to ${r.email}`)
    : fail("Email isn’t set up yet. Copy the ticket link instead.");
}

export async function checkIn(token: string) {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator", "security");
  const { error } = await supabase.rpc("check_in", { p_token: token });
  if (error) return fail(friendly(error));
  refresh();
  revalidatePath(`/t/${token}`);
  return ok("Checked in");
}
