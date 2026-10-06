import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import type { Database, Tables } from "@/lib/database.types";
import { addDays, todayIn } from "@/lib/dates";
import { siteUrl } from "@/lib/email";
import { sessions } from "@/lib/schedule";
import {
  channelFor,
  describeSlackError,
  type Digest,
  digestMessage,
  type Kind,
  fmtMoney,
  type Message,
  parseRules,
} from "@/lib/slack-format";
import { createAdminClient } from "@/lib/supabase/admin";

// Slack. ARK OS posts to the team's workspace with a bot token
// (Settings → Integrations → Slack). Posting never blocks or fails the thing
// that caused it: notify() swallows errors and writes them to the activity
// log instead. Messages are built in lib/slack-format.ts.

type Sb = SupabaseClient<Database>;
export type Integration = Tables<"integrations">;

const BASE = "https://slack.com/api";

export class SlackError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type SlackResponse = { ok: boolean; error?: string; needed?: string } & Record<string, unknown>;

async function api<T extends SlackResponse>(token: string, method: string, body?: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
  } catch {
    throw new SlackError("unreachable", "Couldn’t reach Slack. Check the connection and try again.");
  }
  if (res.status === 429) throw new SlackError("ratelimited", describeSlackError("ratelimited"));
  const json = (await res.json().catch(() => null)) as T | null;
  if (!json) throw new SlackError("bad_response", "Slack sent back something unexpected.");
  if (!json.ok) {
    const code = json.error ?? "unknown";
    const ch = typeof body?.channel === "string" ? body.channel : null;
    throw new SlackError(code, describeSlackError(code, ch));
  }
  return { json, scopes: res.headers.get("x-oauth-scopes") ?? "" };
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong talking to Slack.");

/** Is the token good? Returns the workspace name. Checks it may post. */
export async function testConnection(token: string) {
  const { json, scopes } = await api<SlackResponse & { team?: string; user?: string }>(token, "auth.test");
  const have = scopes.split(",").map((s) => s.trim());
  if (scopes && !have.includes("chat:write")) throw new SlackError("missing_scope", describeSlackError("missing_scope"));
  return { team: json.team ?? null, bot: json.user ?? null, publicChannels: have.includes("chat:write.public") };
}

export async function postMessage(token: string, channel: string, m: Message) {
  const { json } = await api<SlackResponse & { ts?: string }>(token, "chat.postMessage", {
    channel,
    text: m.text,
    blocks: m.blocks,
    unfurl_links: false,
    unfurl_media: false,
  });
  return json.ts ?? null;
}

export async function logEvent(
  sb: Sb,
  e: { kind: "test" | "notify" | "digest"; ok: boolean; detail: string; contact_id?: string | null },
) {
  await sb.from("integration_events").insert({ provider: "slack", direction: "out", ...e });
}

export async function getIntegration(sb: Sb) {
  const { data } = await sb.from("integrations").select("*").eq("key", "slack").maybeSingle();
  return data;
}

/** The parts of the row the rules need, with the rules parsed. */
export const settings = (i: Integration) => ({
  enabled: i.enabled && !!i.secret,
  channel: i.channel,
  rules: parseRules(i.rules),
});

export type NotifyResult = { sent: true; channel: string } | { sent: false; reason: string };

/**
 * Post one message for a kind of event, if Slack is connected and that kind
 * is on. Never throws. Problems go to the activity log and onto the row as
 * last_error; a later success clears it.
 */
export async function notify(
  sb: Sb,
  kind: Kind,
  m: Message,
  opts: { contact_id?: string | null; summary?: string } = {},
): Promise<NotifyResult> {
  const i = await getIntegration(sb);
  if (!i?.secret) return { sent: false, reason: "Slack isn’t connected." };
  const channel = channelFor(settings(i), kind);
  if (!channel) return { sent: false, reason: `${kind} is off.` };
  const summary = opts.summary ?? m.text.split("\n")[0].replace(/[*_>]/g, "");
  try {
    await postMessage(i.secret, channel, m);
    await Promise.all([
      logEvent(sb, { kind: kind === "digest" ? "digest" : "notify", ok: true, detail: `${summary} → ${channel}`, contact_id: opts.contact_id ?? null }),
      i.last_error ? sb.from("integrations").update({ last_error: null }).eq("key", "slack") : Promise.resolve(),
    ]);
    return { sent: true, channel };
  } catch (e) {
    const reason = errorText(e);
    await Promise.all([
      logEvent(sb, { kind: kind === "digest" ? "digest" : "notify", ok: false, detail: `${summary}: ${reason}`, contact_id: opts.contact_id ?? null }),
      sb.from("integrations").update({ last_error: reason }).eq("key", "slack"),
    ]);
    return { sent: false, reason };
  }
}

/**
 * For server actions and route handlers: post once the response is out, with
 * the service role (the visitor who booked can't read the integration row).
 * Does nothing until SUPABASE_SERVICE_ROLE_KEY is set.
 */
export function notifyLater(kind: Kind, build: (origin: string) => Message | Promise<Message | null> | null, opts: { contact_id?: string | null } = {}) {
  after(async () => {
    const admin = createAdminClient();
    if (!admin) return;
    try {
      const m = await build(await siteUrl());
      if (m) await notify(admin, kind, m, opts);
    } catch (e) {
      console.error("Slack notify failed", kind, e);
    }
  });
}

// The morning digest ------------------------------------------------------------

/** What's happening today and what happened yesterday, for the digest. */
export async function buildDigest(sb: Sb, today = todayIn()): Promise<Digest> {
  const yesterday = addDays(today, -1);
  // Costa Rica is UTC-6 all year.
  const dayStart = (d: string) => `${d}T06:00:00Z`;
  const [
    { data: org },
    { data: offerings },
    { data: cancellations },
    { data: regsToday },
    { data: guests },
    { data: tasks },
    { count: bookingsYesterday },
    { data: paymentsYesterday },
    { count: applications },
    { count: stays },
  ] = await Promise.all([
    sb.from("org_settings").select("name").maybeSingle(),
    sb.from("offerings").select("*").eq("status", "published").lte("start_date", today),
    sb.from("session_cancellations").select("offering_id, session_date").eq("session_date", today),
    sb.from("registrations").select("offering_id").eq("session_date", today),
    sb.rpc("todays_guests"),
    sb
      .from("tasks")
      .select("title, due_date, assignee:team_members!tasks_assignee_id_fkey(name)")
      .neq("status", "done")
      .lte("due_date", today)
      .order("due_date")
      .limit(30),
    sb
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayStart(yesterday))
      .lt("created_at", dayStart(today)),
    sb
      .from("payments")
      .select("amount, currency")
      .eq("status", "paid")
      .gte("paid_at", dayStart(yesterday))
      .lt("paid_at", dayStart(today)),
    sb.from("membership_applications").select("id", { count: "exact", head: true }).in("status", ["new", "reviewing"]),
    sb.from("stays").select("id", { count: "exact", head: true }).eq("status", "inquiry").gte("check_in", today),
  ]);

  const booked = new Map<string, number>();
  for (const r of regsToday ?? []) booked.set(r.offering_id, (booked.get(r.offering_id) ?? 0) + 1);
  const list = sessions(offerings ?? [], cancellations ?? [], today, today, { published: true });

  const totals = new Map<string, number>();
  for (const p of paymentsYesterday ?? []) totals.set(p.currency, (totals.get(p.currency) ?? 0) + Number(p.amount));

  return {
    date: today,
    orgName: org?.name ?? "The ARK",
    sessions: list.map((s) => ({
      title: s.o.title,
      startTime: s.o.start_time,
      booked: booked.get(s.o.id) ?? 0,
      capacity: s.o.capacity,
      cancelled: s.cancelled,
    })),
    guests: (guests ?? []).filter((g) => g.status !== "cancelled").map((g) => ({ guest: g.guest_name, host: g.host_name })),
    tasks: (tasks ?? []).map((t) => {
      const a = t.assignee as unknown as { name: string } | { name: string }[] | null;
      const name = Array.isArray(a) ? a[0]?.name : a?.name;
      return { title: t.title, assignee: name ?? null, overdue: !!t.due_date && t.due_date < today };
    }),
    yesterday: {
      bookings: bookingsYesterday ?? 0,
      payments: {
        count: (paymentsYesterday ?? []).length,
        totals: [...totals].map(([cur, amt]) => fmtMoney(amt, cur)),
      },
    },
    waiting: { applications: applications ?? 0, stays: stays ?? 0 },
  };
}

/** Build and post the digest. Returns what notify() did. */
export async function sendDigest(sb: Sb, origin: string) {
  const d = await buildDigest(sb);
  return notify(sb, "digest", digestMessage(d, origin), { summary: "Morning digest" });
}
