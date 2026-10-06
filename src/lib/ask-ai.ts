import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";

// "Ask AI": a chat about the page someone is on, or anything in the database.
// Every query runs as the signed-in person through their own Supabase client,
// so row-level security decides what the AI can see, exactly as in the app.
// The tools only read. Off until ANTHROPIC_API_KEY is set.

const MODEL = "claude-opus-5-5";

// What the AI may query, and what each table holds. Members' private
// messages are left out on purpose.
const SCHEMA = {
  contacts: "people in the CRM: id, type (contact|member|steward), name, email, phone, instagram, location, source, interests[], tier, membership_status (active|paused|inactive), member_since, renews_on, lot, resident, owner_id→team_members, city_id, bio, rate (rack|ff), discount_id, created_at",
  contact_notes: "id, contact_id, author_id→team_members, body, created_at",
  contact_stages: "contact_id, pipeline, stage (where someone is in each sales pipeline)",
  enrollments: "workflow enrollments: id, contact_id, sequence_id, started_on, status",
  sequences: "workflows: id, name, description",
  sequence_steps: "id, sequence_id, position, channel (email|whatsapp|call), delay_days, subject, body",
  membership_tiers: "key, name, price (rack rate), price_ff (friends & family), currency, period, spots, guest_passes, active",
  discounts: "id, name, percent, lifetime, active",
  offerings: "classes, events, experiences, expeditions: id, kind, title, description, facilitator_id→team_members, location, repeat (weekly|none), start_date, end_date, days[] (0=Sun), start_time, end_time, capacity, access, status, city_id",
  ticket_types: "id, offering_id, name, price, currency, qty",
  registrations: "bookings for a session: id, offering_id, session_date, ticket_type_id, contact_id, name, email, paid, source, checked_in_at, created_at",
  session_cancellations: "offering_id, session_date",
  courts: "id, name, sport, open_time, close_time, slot_minutes, active",
  court_bookings: "id, court_id, date, start_time, end_time, contact_id, name, status (booked|cancelled), source",
  lots: "land, estates and rental homes: id, code (lot number), name, kind (lot|estate|fractional|rental), zone, status (available|reserved|sold…), size_m2, price, currency, owner_contact_id, home_name, bedrooms, bathrooms, in_hospitality, nightly_rate, rate_currency, max_guests, listing_title, listing_published, estate_lot_id",
  stays: "hospitality bookings: id, lot_id, kind (guest|owner|hold), status (inquiry|confirmed|cancelled), guest_name, email, guests, check_in, check_out, nightly_rate, currency, total, paid, source, contact_id",
  lot_household: "people living on a lot: id, lot_id, name, relation, contact_id, lives_on_site",
  lot_maintenance: "id, lot_id, title, category, status, performed_on, cost, currency",
  products: "farm shop: id, name, category, unit, price, member_price, stock, low_at, active, track_stock, online",
  stock_movements: "id, product_id, type (sale|restock|adjusted), delta (negative for sales), order_id (lines sold together), unit_price, amount (sale value, CRC), method (cash|sinpe|card|transfer|other), contact_id (buyer, when known), created_at",
  finance_entries: "id, kind (income|expense), entry_date, business_line_id, category, party, description, amount, currency, method, status (paid|unpaid), due_date, contact_id",
  finance_months: "monthly summary: month, membership, events, shop, fnb, land, other, expenses, cash, ar, ap",
  business_lines: "id, name",
  gate_entries: "visits logged by security: id, contact_id, entered_at",
  guest_passes: "id, host_contact_id, guest_name, visit_date, status (invited|used|cancelled)",
  tasks: "operations: id, title, description, assignee_id→team_members, division_id, priority, kind, due_date, status, completed_at",
  divisions: "id, name, lead_id, is_school",
  team_members: "staff: id, name, email, title, type, role, division_id, status",
  students: "Arkadia school: id, name, preferred_name, birthdate, group_name, status, start_date",
  student_guardians: "id, student_id, name, relation, email, phone, contact_id",
  school_schedule: "id, group_name, weekday, on_date, start_time, end_time, title, location, teacher_id",
  cities: "id, name, country, is_home",
  posts: "community feed: id, author_contact_id, author_staff_id, city_id, parent_id, body, created_at",
  org_settings: "name, location, currency, currency2, timezone, member_cap",
  marketing_brands: "the five marketing brands: key (farm|arkadia|ark|courts|membership), name",
  brand_strategies: "one strategy per brand: brand, story, audience, key_messages, pillars, tone, channels, goals",
  content_items: "marketing content pipeline: id, title, brief, brands[], stage (idea|production|review|approved|published), assignee_id→team_members, due_date, stage_changed_at, published_at",
  marketing_assets: "asset library: id, title, kind (photo|video|copy), body, brands[], tags[]",
  social_posts: "social planner: id, caption, brands[], channels[], scheduled_at, status (draft|ready|published), published_at, link, reach, likes, comments, shares, saves",
  email_campaigns: "id, name, brands[], list_key (waitlist|applicants|members|attendees), subject, status (draft|scheduled|sending|sent), scheduled_at, sent_at",
  email_sends: "one row per marketing email: campaign_id, automation_step, email, status (sent|failed|test), sent_at, opened_at, clicked_at, bounced_at, unsubscribed_at",
} as const;

type Table = keyof typeof SCHEMA;
const TABLES = Object.keys(SCHEMA) as [Table, ...Table[]];

const SYSTEM = `You are the assistant inside ARK OS, the operating system for The ARK: a members club, farm, community and land project in Santa Teresa, Costa Rica. Staff ask you about the page they're looking at or about anything in the business.

How to answer:
- Use the tools to look things up; don't guess numbers or names. The page text you're given is what's on their screen right now, so answer from it when it already has what's needed.
- You only see what this person is allowed to see. If a query comes back empty or with a permission error, say what you couldn't see rather than implying it doesn't exist.
- Money: amounts are in the currency stated on each row (CRC is colones, written ₡; USD is $). Never add colones and dollars together; report them separately.
- Dates are in Costa Rica time. Classes repeat weekly on offerings.days (0 = Sunday) between start_date and end_date; one registration is one booking for one session_date.
- Keep it short and plain. Lead with the answer, then the detail. Use short paragraphs or "- " lists, **bold** for key figures. No tables, no headings, no emoji, no exclamation marks.
- Link to records in the app with markdown links: people [Name](/crm/contact/{id}), lots [Lot 12](/estate/{id}), homes [Name](/hospitality/{id}), workflows [Name](/crm/workflows/{id}).
- You can only read. If they ask you to change something, tell them where in ARK OS to do it.

Tables you can query (PostgREST; embed related rows in select, e.g. "id, title, registrations(count)" or "name, contacts(name)"):
${Object.entries(SCHEMA)
  .map(([t, d]) => `- ${t}: ${d}`)
  .join("\n")}`;

const Filter = z.object({
  column: z.string().regex(/^[a-z_]+(\.[a-z_]+)?$/).describe("Column name, or relation.column for an embedded table"),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "is", "in", "contains"]),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.number()]))])
    .describe("For ilike use % wildcards. For is use null/true/false. For in and contains pass an array."),
});

type Sb = SupabaseClient<Database>;

/** A select list with columns, embedded relations, counts and aliases only. */
const SELECT_OK = /^[a-z_0-9*,:()!. \n]+$/i;

function applyFilters<Q extends { filter: (c: string, op: string, v: unknown) => Q }>(
  q: Q,
  filters: z.infer<typeof Filter>[] | undefined,
) {
  for (const f of filters ?? []) {
    const v =
      f.op === "in"
        ? `(${(Array.isArray(f.value) ? f.value : [f.value]).map((x) => JSON.stringify(x)).join(",")})`
        : f.op === "contains"
          ? `{${(Array.isArray(f.value) ? f.value : [f.value]).map((x) => JSON.stringify(x)).join(",")}}`
          : f.value;
    q = q.filter(f.column, f.op === "contains" ? "cs" : f.op, v);
  }
  return q;
}

const clip = (s: string, n = 40000) => (s.length > n ? `${s.slice(0, n)}\n…(cut off; narrow the query)` : s);

function tools(sb: Sb, onStatus: (s: string) => void) {
  const query = betaZodTool({
    name: "query_table",
    description:
      "Read rows from one table, as the signed-in person (row-level security applies). Ask only for the columns you need. Use count_rows for totals of rows.",
    inputSchema: z.object({
      table: z.enum(TABLES),
      select: z.string().describe('PostgREST select list, e.g. "id, name, tier" or "title, registrations(count)"'),
      filters: z.array(Filter).optional(),
      order_by: z.string().regex(/^[a-z_]+$/).optional(),
      ascending: z.boolean().optional(),
      limit: z.number().int().min(1).max(500).optional().describe("Default 50, at most 500"),
    }),
    run: async (input) => {
      onStatus(`Looking at ${input.table.replace(/_/g, " ")}`);
      if (!SELECT_OK.test(input.select) || /token/i.test(input.select)) {
        return "That select list isn't allowed. Use plain column names and embedded relations.";
      }
      let q = sb.from(input.table).select(input.select);
      q = applyFilters(q, input.filters);
      if (input.order_by) q = q.order(input.order_by, { ascending: input.ascending ?? true });
      const { data, error } = await q.limit(input.limit ?? 50);
      if (error) return `Query failed: ${error.message}`;
      return clip(JSON.stringify(data));
    },
  });

  const count = betaZodTool({
    name: "count_rows",
    description: "Count the rows in a table that match the filters.",
    inputSchema: z.object({ table: z.enum(TABLES), filters: z.array(Filter).optional() }),
    run: async (input) => {
      onStatus(`Counting ${input.table.replace(/_/g, " ")}`);
      let q = sb.from(input.table).select("*", { count: "exact", head: true });
      q = applyFilters(q, input.filters);
      const { count: n, error } = await q;
      if (error) return `Query failed: ${error.message}`;
      return String(n ?? 0);
    },
  });

  const activity = betaZodTool({
    name: "contact_activity",
    description:
      "Everything one person has bought, booked and paid for: membership, payments in finance, farm shop, classes and events, stays, courts, guests, visits. Newest first.",
    inputSchema: z.object({ contact_id: z.string().uuid() }),
    run: async ({ contact_id }) => {
      onStatus("Reading their activity");
      const { data, error } = await sb.rpc("contact_activity", { cid: contact_id });
      if (error) return `Query failed: ${error.message}`;
      return clip(JSON.stringify(data));
    },
  });

  return [query, count, activity];
}

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type PageContext = { path: string; title: string; text: string };

/** Run the conversation; calls `emit` with text as it streams and with a
 * short status line whenever a tool runs. */
export async function askAi(
  sb: Sb,
  input: { turns: ChatTurn[]; page: PageContext; who: string; role: string; today: string },
  emit: (e: { t: "text" | "status"; v: string }) => void,
) {
  const client = new Anthropic();
  const turns = input.turns.slice(-20);
  const last = turns.pop();
  if (!last || last.role !== "user") throw new Error("Ask a question first.");

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...turns.map((t) => ({ role: t.role, content: t.content })),
    {
      role: "user",
      content: `Asked by ${input.who} (${input.role}) on ${input.today}, while on ${input.page.path} ("${input.page.title}").

<page>
${clip(input.page.text, 30000)}
</page>

${last.content}`,
    },
  ];

  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    // If a safety classifier declines, the API retries on a suitable model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    cache_control: { type: "ephemeral" },
    system: SYSTEM,
    tools: tools(sb, (s) => emit({ t: "status", v: s })),
    messages,
    max_iterations: 12,
    stream: true,
  });

  let stop: string | null = null;
  for await (const stream of runner) {
    stream.on("text", (delta) => emit({ t: "text", v: delta }));
    const message = await stream.finalMessage();
    stop = message.stop_reason;
  }
  if (stop === "refusal") emit({ t: "text", v: "\n\nI can’t help with that one. Try asking another way." });
  if (stop === "max_tokens") emit({ t: "text", v: "\n\n(The answer was cut off. Ask for less at once.)" });
}

export const askAiEnabled = () => !!process.env.ANTHROPIC_API_KEY;
