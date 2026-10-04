"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { addDays, addMonths, dow, monthKey, todayIn, weekStart } from "@/lib/dates";

type Client = Awaited<ReturnType<typeof staffOrThrow>>["supabase"];

const ORDER = [
  "posts",
  "registrations",
  "enrollments",
  "stock_movements",
  "tasks",
  "ticket_types",
  "offerings",
  "products",
  "sequences",
  "contacts",
  "team_members",
  "divisions",
  "finance_months",
  "cities",
] as const;

async function track(supabase: Client, table: string, ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase
    .from("sample_records")
    .insert(ids.map((record_id) => ({ table_name: table, record_id })));
  if (error) throw error;
}

const SAMPLE_CITY: Record<string, string> = {
  Ben: "Lisbon",
  Emily: "New York",
  Lena: "Nosara",
};
const SAMPLE_BIO: Record<string, string> = {
  Ana: "Surfing most mornings, sauna most evenings. Building a small design studio from the cowork.",
  Ben: "Product person between Lisbon and here. Always up for padel and a long lunch.",
  Clara: "Breathwork facilitator in training. Happiest in the farm beds with my hands in the soil.",
  Jonas: "Architect. Building on lot 12 with as little concrete as we can manage.",
  Emily: "Toronto winters, Santa Teresa summers. Pickleball, cowork, good coffee.",
};

/** Demo data from the prototype, tagged so it can be removed in one go. */
export async function loadSampleData(): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin");
  const { count } = await supabase
    .from("sample_records")
    .select("record_id", { count: "exact", head: true });
  if (count) return fail("Sample data is already loaded.");

  const td = todayIn();
  try {
    const insert = async <T extends Record<string, unknown>>(
      table: (typeof ORDER)[number],
      rows: T[],
    ) => {
      const { data, error } = await supabase
        .from(table)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows vary by table
        .insert(rows as any, { defaultToNull: false })
        .select(table === "finance_months" ? "month" : "id");
      if (error) throw error;
      const ids = (data as unknown as Record<string, string>[]).map(
        (r) => r.id ?? r.month,
      );
      await track(supabase, table, ids);
      return ids;
    };

    const divs = [
      ["Memberships", "leaf", "Waitlist, applications, member sales, and onboarding."],
      ["Programming", "sun", "Classes, workshops, events, and facilitators."],
      ["Real estate", "clay", "Land sales, owners, and residents."],
      ["Farm & shop", "leaf", "The farm, harvests, and farm shop."],
      ["Operations & maintenance", "slate", "Grounds, facilities, crews, and security."],
    ];
    const divIds = await insert(
      "divisions",
      divs.map(([name, color, description]) => ({ name: `${name} (sample)`, color, description })),
    );
    const D = Object.fromEntries(divs.map(([n], i) => [n, divIds[i]]));

    const { data: home } = await supabase.from("cities").select("id").eq("is_home", true).maybeSingle();
    const cityIds = await insert("cities", [
      { name: "Nosara", country: "Costa Rica", blurb: "Two hours up the coast. Yoga, long beaches, slow mornings.", position: 1 },
      { name: "Lisbon", country: "Portugal", blurb: "Members passing through Europe. Coffee, Alfama, the Atlantic.", position: 2 },
      { name: "New York", country: "USA", blurb: "For the months away. Dinners, galleries, familiar faces.", position: 3 },
    ]);
    const CITY: Record<string, string | null> = {
      "Santa Teresa": home?.id ?? null,
      Nosara: cityIds[0],
      Lisbon: cityIds[1],
      "New York": cityIds[2],
    };

    // Sample people get no email, so no real account can ever sign in as them.
    const team = [
      ["Polina Marchenko", "Programming lead", "facilitator", "Programming", "lead"],
      ["Luis Mora", "Head of security", "team", "Operations & maintenance", "security"],
      ["Camila Rojas", "Farm & shop manager", "team", "Farm & shop", "shop"],
      ["Tomás Vega", "Maintenance crew lead", "crew", "Operations & maintenance", "crew"],
      ["Maya Chen", "Yoga & breathwork facilitator", "facilitator", "Programming", "facilitator"],
      ["Diego Fallas", "Muay Thai coach", "facilitator", "Programming", "facilitator"],
    ];
    const tIds = await insert(
      "team_members",
      team.map(([name, title, type, div, role]) => ({
        name,
        title,
        type,
        role,
        division_id: D[div],
        status: "active",
      })),
    );
    const T = Object.fromEntries(team.map(([n], i) => [n, tIds[i]]));

    const ws = weekStart(td);
    const dinnerDate = addDays(ws, 5) >= td ? addDays(ws, 5) : addDays(ws, 12);
    const offs = [
      { kind: "class", title: "Sunrise vinyasa", f: "Maya Chen", location: "The Shala", days: [1, 3, 5], st: "07:00", et: "08:00", cap: 16 },
      { kind: "class", title: "Muay Thai fundamentals", f: "Diego Fallas", location: "Gym", days: [2, 4], st: "17:30", et: "18:45", cap: 12 },
      { kind: "class", title: "Breathwork & cold plunge", f: "Maya Chen", location: "Spa deck", days: [6], st: "08:00", et: "09:15", cap: 10 },
      { kind: "class", title: "Padel open play", f: "Polina Marchenko", location: "Courts", days: [0, 3], st: "16:00", et: "18:00", cap: 8 },
      {
        kind: "event", title: "Farm-to-table dinner", f: "Camila Rojas", location: "Farm", date: dinnerDate, st: "18:30", et: "21:30", cap: 24,
        description: "Twelve seats at one long table. Everything on the plate grew within sight of where you’re sitting.",
      },
      {
        kind: "experience", title: "Sunset sail to Isla Tortuga", f: "Polina Marchenko", location: "Playa Hermosa", date: addDays(td, 4), st: "15:30", et: "19:00", cap: 14,
        description: "A catamaran, a cooler of fruit from the farm, and the gulf going gold. Swim stop at the island.",
      },
      {
        kind: "expedition", title: "Corcovado: three days in the wild", f: "Camila Rojas", location: "Osa Peninsula", date: addDays(td, 18), end: addDays(td, 20), st: "06:00", et: "18:00", cap: 10,
        description: "The most biodiverse place on earth, on foot with local guides. Scarlet macaws, tapirs, river crossings, and a night in the rainforest station.",
      },
      {
        kind: "event", title: "Founding members evening", f: "Polina Marchenko", location: "The House", date: addDays(td, 10), st: "17:00", et: "19:00", cap: 40,
        description: "Drinks on the deck, a walk through the land, and the founding offer explained in person.",
      },
    ];
    const oIds = await insert(
      "offerings",
      offs.map((o) => ({
        city_id: o.kind === "expedition" ? null : CITY["Santa Teresa"],
        end_date: (o as { end?: string }).end ?? null,
        kind: o.kind,
        title: o.title,
        description: o.description ?? null,
        facilitator_id: T[o.f],
        location: o.location,
        repeat: o.date ? "none" : "weekly",
        start_date: o.date ?? addDays(td, -21),
        days: o.days ?? [dow(o.date!)],
        start_time: o.st,
        end_time: o.et,
        capacity: o.cap,
        access: o.kind === "class" ? "members" : "everyone",
        status: "published",
        created_by: staff.id,
      })),
    );
    const tickets = await insert("ticket_types", [
      { offering_id: oIds[4], name: "Member seat", price: 18000, currency: "CRC", qty: 12, position: 0 },
      { offering_id: oIds[4], name: "Guest seat", price: 25000, currency: "CRC", qty: 12, position: 1 },
    ]);

    const people = [
      ["Ana Lopez", "member", "founding", "ana@example.com", "+506 8888 1101", "Santa Teresa", ["yoga", "surfing", "sauna mornings"], "active", "Farm dinner in August"],
      ["Ben Ortiz", "member", "standard", "ben@example.com", "+506 8888 1102", "Nomad, here until March", ["padel", "cowork", "music"], "active", "Referred by Ana"],
      ["Clara Núñez", "member", "founding", "clara@example.com", "+506 8888 1103", "Mal País", ["breathwork", "regenerative farming"], "active", "ARK Day"],
      ["Jonas Weber", "steward", "founding", "jonas@example.com", "+49 170 000 0004", "Lot 12, on-site", ["architecture", "permaculture"], "active", "Lot owner since 2025"],
      ["Sofía Herrera", "steward", null, "sofia@example.com", "+506 8888 1105", "Lot 7", ["horses", "ceramics"], "active", "Lot owner"],
      ["Marcus Hill", "contact", null, "marcus@example.com", "+1 415 000 0006", "San Francisco, visiting Nov", ["investing", "trail running"], "active", "Instagram"],
      ["Lena Fischer", "contact", null, "lena@example.com", "+41 79 000 0007", "Zürich", ["yoga", "founder"], "active", "Waitlist form"],
      ["Rafa Castillo", "contact", null, "rafa@example.com", "+506 8888 1108", "Cóbano", ["land", "cattle to agroforestry"], "active", "Introduced by Marco"],
      ["Emily Park", "member", "annual", "emily@example.com", "+1 647 000 0009", "Toronto, winters here", ["cowork", "pickleball"], "paused", "Catamaran trip"],
    ] as const;
    const cIds = await insert(
      "contacts",
      people.map(([name, type, tier, email, phone, location, interests, ms, source]) => {
        const first = name.split(" ")[0];
        return {
          name, type, tier, email, phone, location, source,
          interests: [...interests],
          membership_status: ms,
          instagram: `@${first.toLowerCase()}`,
          lot: type === "steward" ? (first === "Jonas" ? "12" : "7") : null,
          resident: first === "Jonas",
          member_since: tier ? addDays(td, -40) : null,
          renews_on: tier ? addDays(td, 325) : null,
          owner_id: staff.id,
          created_by: staff.id,
          city_id: CITY[SAMPLE_CITY[first] ?? "Santa Teresa"],
          bio: SAMPLE_BIO[first] ?? null,
        };
      }),
    );
    const C = Object.fromEntries(people.map(([n], i) => [n.split(" ")[0], cIds[i]]));
    // Notes and stages go with their contacts when sample data is removed.
    await supabase.from("contact_notes").insert(
      people.map(([name, , , , , , interests, , source]) => ({
        contact_id: C[name.split(" ")[0]],
        author_id: staff.id,
        body: `Met via ${source.toLowerCase()}. ${interests[0]} is the way in.`,
      })),
    );
    await supabase.from("contact_stages").insert([
      { contact_id: C.Marcus, pipeline: "memberships", stage: "invited" },
      { contact_id: C.Lena, pipeline: "memberships", stage: "applied" },
      { contact_id: C.Rafa, pipeline: "estate", stage: "visit" },
      { contact_id: C.Jonas, pipeline: "estate", stage: "closed" },
      { contact_id: C["Sofía"], pipeline: "estate", stage: "contract" },
      { contact_id: C.Ben, pipeline: "memberships", stage: "active" },
      { contact_id: C.Ana, pipeline: "memberships", stage: "active" },
      { contact_id: C.Clara, pipeline: "memberships", stage: "active" },
    ]);

    const [waitlist, land] = await Promise.all([
      supabase.rpc("save_sequence", {
        p_id: null,
        p_name: "Waitlist welcome (sample)",
        p_description: "New waitlist signups who haven’t applied yet",
        p_steps: [
          { channel: "email", delay_days: 0, subject: "You’re on the list", body: "Hi {{first_name}},\n\nThanks for joining the {{org}} waitlist. We bring in a small group at a time and read every application ourselves.\n\nWhen you have a few minutes, tell us a bit about you through the application link. We’ll be in touch soon after.\n\nSee you in Santa Teresa" },
          { channel: "whatsapp", delay_days: 3, subject: "", body: "Hey {{first_name}}, it’s {{org}}. Did you get a chance to look at the application? Happy to answer anything first." },
          { channel: "email", delay_days: 5, subject: "Founding spots", body: "Hi {{first_name}},\n\nA quick note: founding memberships lock in the lowest rate for life, and there are 50 of them. If {{org}} feels right, this is the moment.\n\nThe door’s open." },
        ],
      }),
      supabase.rpc("save_sequence", {
        p_id: null,
        p_name: "Land inquiry follow-up (sample)",
        p_description: "People who asked about lots",
        p_steps: [
          { channel: "whatsapp", delay_days: 0, subject: "", body: "Hi {{first_name}}, great talking about the land. Want to walk it together this week? Mornings are best." },
          { channel: "email", delay_days: 4, subject: "Lots, structure, and what’s next", body: "Hi {{first_name}},\n\nAs promised, here’s how ownership works at {{org}}, what’s still available, and how a reservation moves to contract. Reply with any questions, or pick a time to walk the land." },
        ],
      }),
    ]);
    if (waitlist.error) throw waitlist.error;
    if (land.error) throw land.error;
    await track(supabase, "sequences", [waitlist.data, land.data]);
    await insert("enrollments", [
      { contact_id: C.Lena, sequence_id: waitlist.data, started_on: addDays(td, -3) },
      { contact_id: C.Rafa, sequence_id: land.data, started_on: td },
    ]);

    // Oldest first so the feed reads in order.
    for (const post of [
      { author_contact_id: null, city_id: CITY["Santa Teresa"], body: "Corcovado expedition dates are up. Ten places, three days, guided by people who grew up on the Osa. Details in Explore." },
      { author_contact_id: C.Ben, city_id: CITY.Lisbon, body: "In Lisbon until the 20th. Anyone around for a long lunch in Alfama?" },
      { author_contact_id: C.Clara, city_id: CITY["Santa Teresa"], body: "The farm is pulling the last of the tomatoes this week. If you want to help harvest on Thursday morning, come find me by the beds. Breakfast after." },
      { author_contact_id: C.Ana, city_id: CITY["Santa Teresa"], body: "Dawn surf at Playa Hermosa tomorrow, 5:45. Two boards in the truck if anyone needs one." },
    ]) {
      const { error: postError } = await supabase.rpc("insert_sample_posts", { p_posts: [post] });
      if (postError) throw postError;
    }

    const nextMon = addDays(ws, td > ws ? 7 : 0);
    await insert("registrations", [
      { offering_id: oIds[4], session_date: dinnerDate, name: "Ana Lopez", email: "ana@example.com", ticket_type_id: tickets[0], contact_id: C.Ana, paid: true },
      { offering_id: oIds[4], session_date: dinnerDate, name: "Ben Ortiz", email: "ben@example.com", ticket_type_id: tickets[0], contact_id: C.Ben, paid: true },
      { offering_id: oIds[4], session_date: dinnerDate, name: "Marcus Hill", email: "marcus@example.com", ticket_type_id: tickets[1], contact_id: C.Marcus, paid: false },
      { offering_id: oIds[4], session_date: dinnerDate, name: "Lena Fischer", email: "lena@example.com", ticket_type_id: tickets[1], contact_id: C.Lena, paid: true },
      { offering_id: oIds[0], session_date: nextMon, name: "Clara Núñez", email: "clara@example.com", contact_id: C.Clara },
      { offering_id: oIds[0], session_date: nextMon, name: "Ana Lopez", email: "ana@example.com", contact_id: C.Ana },
    ]);

    const tasks = [
      ["Fix sauna door hinge", "maintenance", "urgent", addDays(td, -1), "Tomás Vega", "Operations & maintenance", "doing", "Spa deck"],
      ["Order padel balls and nets", "purchase", "medium", addDays(td, 6), "Polina Marchenko", "Programming", "next", "Courts"],
      ["Set up gate check-in device", "task", "high", addDays(td, 3), "Luis Mora", "Operations & maintenance", "next", "Gate"],
      ["Prep dinner table and lights", "event", "high", dinnerDate, "Camila Rojas", "Farm & shop", "backlog", "Farm"],
      ["Clear drainage before rains", "maintenance", "high", addDays(td, 2), "Tomás Vega", "Operations & maintenance", "backlog", "Farm"],
      ["Review 3 pending applications", "task", "medium", addDays(td, 1), "Polina Marchenko", "Memberships", "doing", null],
      ["Replace cold plunge filter", "maintenance", "low", addDays(td, 12), "Tomás Vega", "Operations & maintenance", "backlog", "Spa deck"],
      ["Print QR signs for classes", "task", "low", addDays(td, -3), null, "Programming", "done", null],
    ] as const;
    await insert(
      "tasks",
      tasks.map(([title, kind, priority, due_date, who, div, status, location]) => ({
        title, kind, priority, due_date, status, location,
        assignee_id: who ? T[who] : null,
        division_id: D[div],
        created_by: staff.id,
      })),
    );

    const prods = [
      ["Cherry tomatoes", "Vegetables", "kg", 3500, 3000, 4, 5],
      ["Lettuce mix", "Vegetables", "bag", 2200, 1800, 14, 6],
      ["Farm eggs", "Eggs & dairy", "dozen", 4500, 4000, 9, 8],
      ["Kombucha, ginger", "Drinks", "bottle", 3000, 2500, 22, 10],
      ["Sourdough loaf", "Bakery", "loaf", 4000, 3500, 0, 4],
      ["Raw honey", "Pantry", "jar", 7500, 6500, 11, 3],
      ["Bananas", "Fruit", "bunch", 1500, 1200, 18, 5],
      ["Coconut oil", "Body & home", "jar", 6000, 5000, 2, 3],
    ] as const;
    const pIds = await insert(
      "products",
      prods.map(([name, category, unit, price, member_price, , low_at]) => ({
        name, category, unit, price, member_price, low_at,
      })),
    );
    await insert(
      "stock_movements",
      prods
        .map(([, , , , , stock], i) => ({ product_id: pIds[i], type: "restock", delta: stock, by_id: staff.id }))
        .filter((m) => m.delta > 0),
    );

    const m0 = monthKey(td);
    const { data: existing } = await supabase
      .from("finance_months")
      .select("month")
      .in("month", [m0, addMonths(m0, -1), addMonths(m0, -2)].map((m) => `${m}-01`));
    const taken = new Set((existing ?? []).map((r) => r.month.slice(0, 7)));
    const fin = [
      { month: addMonths(m0, -2), membership: 2600000, events: 310000, shop: 420000, fnb: 880000, land: 0, other: 0, expenses: 3900000, cash: 7200000, ar: 600000, ap: 950000, notes: "Seeding month, soft launch." },
      { month: addMonths(m0, -1), membership: 4100000, events: 650000, shop: 610000, fnb: 1240000, land: 0, other: 150000, expenses: 4300000, cash: 9100000, ar: 1200000, ap: 700000, notes: "Founding members evening drove 11 sign-ups." },
      { month: m0, membership: 5200000, events: 420000, shop: 380000, fnb: 900000, land: 0, other: 0, expenses: 2100000, cash: 9800000, ar: 1450000, ap: 420000, cash_date: td, notes: "Month in progress." },
    ]
      .filter((f) => !taken.has(f.month))
      .map((f) => ({ ...f, month: `${f.month}-01` }));
    if (fin.length) await insert("finance_months", fin);
  } catch (e) {
    console.error("Sample data failed", e);
    revalidatePath("/", "layout");
    return fail(`${friendly(e as { code?: string; message?: string })} Some sample data may have loaded; use Remove to clear it.`);
  }
  revalidatePath("/", "layout");
  return ok("Sample data loaded");
}

export async function removeSampleData(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const { data } = await supabase.from("sample_records").select("*");
  if (!data?.length) return fail("There’s no sample data to remove.");
  for (const table of ORDER) {
    const ids = data.filter((r) => r.table_name === table).map((r) => r.record_id);
    if (!ids.length) continue;
    const key = table === "finance_months" ? "month" : "id";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table varies
    const { error } = await (supabase.from(table) as any).delete().in(key, ids);
    if (error) return fail(friendly(error));
  }
  await supabase.from("sample_records").delete().neq("table_name", "");
  revalidatePath("/", "layout");
  return ok("Sample data removed");
}
