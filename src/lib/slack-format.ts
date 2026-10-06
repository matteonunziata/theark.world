// Slack messages and settings, without any I/O (see lib/slack.ts for the
// posting). Messages use Slack's mrkdwn: *bold*, _italic_, <url|label>.

import { fmtDate, fmtTime } from "@/lib/dates";

/** The kinds of thing ARK OS can tell Slack about. Order is the settings page order. */
export const KINDS = [
  ["application", "Membership applications", "Someone applies through the website."],
  ["lead", "New leads", "Someone joins the waitlist, or a lead comes in through GoHighLevel."],
  ["booking", "Bookings", "A spot is booked for a class or event."],
  ["payment", "Payments", "A pass, membership, ticket or court is paid on Stripe."],
  ["stay", "Requests to stay", "A guest asks to stay in one of the homes."],
  ["guest", "Guest invites", "A member invites a guest for a day."],
  ["task", "Tasks assigned", "A task in Operations is given to someone."],
  ["digest", "Morning digest", "Each morning: today’s classes, guests expected, tasks due, and yesterday’s numbers."],
] as const;

export type Kind = (typeof KINDS)[number][0];
export const kindName = (k: string) => KINDS.find(([x]) => x === k)?.[1] ?? k;

export type Rule = { on: boolean; channel: string | null };
export type Rules = Record<string, Rule>;

/** The rules column, however it was stored. Unknown kinds are dropped. */
export function parseRules(json: unknown): Rules {
  const out: Rules = {};
  if (!json || typeof json !== "object" || Array.isArray(json)) return out;
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (!KINDS.some(([x]) => x === k)) continue;
    const r = v && typeof v === "object" ? (v as { on?: unknown; channel?: unknown }) : {};
    out[k] = {
      on: r.on === true,
      channel: typeof r.channel === "string" && r.channel.trim() ? normalizeChannel(r.channel) : null,
    };
  }
  return out;
}

/** Rules as entered on the settings form: one checkbox and one channel per kind. */
export function rulesFromForm(get: (name: string) => string | null, checked: (name: string) => boolean): Rules {
  const out: Rules = {};
  for (const [k] of KINDS) {
    const ch = get(`channel_${k}`);
    out[k] = { on: checked(`on_${k}`), channel: ch ? normalizeChannel(ch) : null };
  }
  return out;
}

/** "general" → "#general"; channel ids (C0123…) stay as they are. */
export function normalizeChannel(s: string) {
  const t = s.trim();
  if (!t) return "";
  if (/^[CG][A-Z0-9]{6,}$/.test(t)) return t;
  return t.startsWith("#") ? t : `#${t}`;
}

/** Where a kind posts: its own channel, else the default. Null when it's off or has nowhere to go. */
export function channelFor(i: { enabled: boolean; channel: string | null; rules: Rules }, kind: Kind) {
  if (!i.enabled) return null;
  const r = i.rules[kind];
  if (!r?.on) return null;
  const ch = r.channel || i.channel;
  return ch ? normalizeChannel(ch) : null;
}

/** What Slack's error codes mean for the person fixing it. */
export function describeSlackError(code: string, channel?: string | null) {
  const ch = channel ? ` ${channel}` : "";
  switch (code) {
    case "invalid_auth":
    case "token_revoked":
    case "account_inactive":
    case "not_authed":
      return "Slack didn’t accept the token. Reinstall the app in Slack and paste the new token.";
    case "missing_scope":
      return "The app is missing a permission. In Slack, give it the chat:write scope and reinstall it.";
    case "channel_not_found":
      return `Couldn’t find the channel${ch}. Check the name, or use the channel id.`;
    case "not_in_channel":
      return `The app isn’t in${ch}. In Slack, open the channel and type /invite @ARK OS.`;
    case "is_archived":
      return `The channel${ch} is archived.`;
    case "ratelimited":
      return "Slack is limiting requests. Try again in a minute.";
    case "msg_too_long":
      return "The message was too long for Slack.";
    default:
      return `Slack said: ${code}.`;
  }
}

/** ₡12,000 or $45. Colones are whole numbers. */
export const fmtMoney = (amount: number, currency: string) =>
  currency.toUpperCase() === "USD"
    ? `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    : `₡${Math.round(amount).toLocaleString("en-US")}`;

// Messages --------------------------------------------------------------------

export type Message = { text: string; blocks: unknown[] };

/** Slack's three reserved characters. Everything we post from people goes through this. */
export const esc = (s: string | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const link = (url: string, label: string) => `<${url}|${esc(label)}>`;

const section = (text: string) => ({ type: "section", text: { type: "mrkdwn", text } });
const context = (text: string) => ({ type: "context", elements: [{ type: "mrkdwn", text }] });

/** A headline, a few lines under it, and a quiet footer line (usually the link into ARK OS). */
export function message(headline: string, lines: (string | null | undefined)[] = [], footer?: string | null): Message {
  const body = lines.filter((l): l is string => !!l && l.trim() !== "");
  const text = [headline, ...body, footer ?? ""].filter(Boolean).join("\n");
  const blocks: unknown[] = [section([headline, ...body].join("\n"))];
  if (footer) blocks.push(context(footer));
  return { text, blocks };
}

const trim = (s: string | null | undefined, n = 280) => {
  const t = String(s ?? "").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const quote = (s: string | null | undefined) => (s?.trim() ? `> ${esc(trim(s))}` : null);

const contactLink = (origin: string, id: string | null | undefined) =>
  id ? link(`${origin}/crm/contact/${id}`, "Open in the CRM") : null;

export function applicationMessage(
  a: { name: string; email: string; phone?: string | null; plan: string; invitedBy?: string | null; why?: string | null; contactId?: string | null },
  origin: string,
) {
  return message(
    `*New membership application* from ${esc(a.name)}`,
    [
      `${esc(a.plan)} · ${esc(a.email)}${a.phone ? ` · ${esc(a.phone)}` : ""}`,
      a.invitedBy ? `Invited by ${esc(a.invitedBy)}` : null,
      quote(a.why),
    ],
    [contactLink(origin, a.contactId), link(`${origin}/memberships`, "Memberships")].filter(Boolean).join("  ·  "),
  );
}

export function leadMessage(
  l: { name: string; email?: string | null; phone?: string | null; via: string; brand?: string | null; source?: string | null; contactId?: string | null },
  origin: string,
) {
  const where = [l.brand, l.source].filter(Boolean).map((x) => esc(x)).join(" · ");
  return message(
    `*New lead:* ${esc(l.name)}`,
    [[l.email, l.phone].filter(Boolean).map((x) => esc(x)).join(" · ") || null, `${esc(l.via)}${where ? ` · ${where}` : ""}`],
    contactLink(origin, l.contactId) ?? link(`${origin}/crm`, "Open the CRM"),
  );
}

export function bookingMessage(
  b: {
    holder: string;
    title: string;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    price?: string | null;
    offeringId: string;
  },
  origin: string,
) {
  const when = `${fmtDate(b.date, { weekday: "short", month: "short", day: "numeric" })}${b.startTime ? `, ${fmtTime(b.startTime)}` : ""}`;
  return message(
    `*Booking:* ${esc(b.holder)} → ${esc(b.title)}`,
    [`${when}${b.location ? ` · ${esc(b.location)}` : ""}`, b.price ? `${esc(b.price)} ticket` : null],
    link(`${origin}/e/${b.offeringId}/${b.date}`, "Event page") + "  ·  " + link(`${origin}/events`, "Events"),
  );
}

export function paymentMessage(
  p: { kind: string; amount: string; name?: string | null; email?: string | null; description?: string | null; live: boolean; contactId?: string | null },
  origin: string,
) {
  const what = p.kind === "pass" ? "pass" : p.kind === "membership" ? "membership" : p.kind === "court" ? "court" : "ticket";
  const who = p.name || p.email || "Someone";
  return message(
    `*Payment:* ${esc(p.amount)} for a ${what}${p.live ? "" : " _(test mode)_"}`,
    [`${esc(who)}${p.name && p.email ? ` · ${esc(p.email)}` : ""}`, p.description ? esc(trim(p.description, 160)) : null],
    [contactLink(origin, p.contactId), link(`${origin}/finance`, "Finance")].filter(Boolean).join("  ·  "),
  );
}

export function stayMessage(
  s: {
    name: string;
    email: string;
    home: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    guests: number;
    estimate?: string | null;
    note?: string | null;
    lotId: string;
  },
  origin: string,
) {
  const d = (x: string) => fmtDate(x, { weekday: "short", month: "short", day: "numeric" });
  return message(
    `*Request to stay:* ${esc(s.name)} at ${esc(s.home)}`,
    [
      `${d(s.checkIn)} → ${d(s.checkOut)} · ${s.nights} night${s.nights === 1 ? "" : "s"} · ${s.guests} guest${s.guests === 1 ? "" : "s"}${s.estimate ? ` · about ${esc(s.estimate)}` : ""}`,
      esc(s.email),
      quote(s.note),
    ],
    link(`${origin}/hospitality/${s.lotId}`, "Open Hospitality"),
  );
}

export function guestMessage(g: { guest: string; host: string; date: string }, origin: string) {
  return message(
    `*Guest invited:* ${esc(g.guest)}, hosted by ${esc(g.host)}`,
    [fmtDate(g.date, { weekday: "long", month: "long", day: "numeric" })],
    link(`${origin}/operations`, "Today’s guests"),
  );
}

export function taskMessage(
  t: { title: string; assignee: string; by?: string | null; dueDate?: string | null; priority?: string | null; description?: string | null },
  origin: string,
) {
  const due = t.dueDate ? `Due ${fmtDate(t.dueDate, { weekday: "short", month: "short", day: "numeric" })}` : null;
  const pri = t.priority && t.priority !== "medium" ? `${t.priority[0].toUpperCase()}${t.priority.slice(1)} priority` : null;
  return message(
    `*Task for ${esc(t.assignee)}:* ${esc(t.title)}`,
    [[due, pri, t.by ? `from ${esc(t.by)}` : null].filter(Boolean).join(" · ") || null, quote(t.description)],
    link(`${origin}/operations/list`, "Open Operations"),
  );
}

// The morning digest ------------------------------------------------------------

export type Digest = {
  /** YYYY-MM-DD, in Costa Rica. */
  date: string;
  orgName: string;
  sessions: { title: string; startTime: string | null; booked: number; capacity: number | null; cancelled: boolean }[];
  guests: { guest: string; host: string }[];
  tasks: { title: string; assignee: string | null; overdue: boolean }[];
  yesterday: { bookings: number; payments: { count: number; totals: string[] } };
  waiting: { applications: number; stays: number };
};

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export function digestMessage(d: Digest, origin: string): Message {
  const day = fmtDate(d.date, { weekday: "long", month: "long", day: "numeric" });
  const blocks: unknown[] = [{ type: "header", text: { type: "plain_text", text: `${d.orgName}, ${day}` } }];
  const text: string[] = [`*${d.orgName}, ${day}*`];
  const add = (title: string, lines: string[], empty: string) => {
    const body = lines.length ? lines.join("\n") : `_${empty}_`;
    blocks.push(section(`*${title}*\n${body}`));
    text.push(`${title}\n${body}`);
  };

  const live = d.sessions.filter((s) => !s.cancelled);
  add(
    "Today",
    live.slice(0, 12).map((s) => {
      const seats = s.capacity ? `${s.booked}/${s.capacity}` : `${s.booked} booked`;
      return `• ${s.startTime ? `${fmtTime(s.startTime)}  ` : ""}${esc(s.title)} · ${seats}`;
    }),
    "No classes or events today.",
  );
  if (live.length > 12) text.push(`…and ${live.length - 12} more.`);

  add(
    "Guests expected",
    d.guests.slice(0, 12).map((g) => `• ${esc(g.guest)} _(with ${esc(g.host)})_`),
    "No guest passes for today.",
  );

  add(
    "Tasks due",
    d.tasks.slice(0, 12).map((t) => `• ${t.overdue ? "⚠︎ " : ""}${esc(t.title)}${t.assignee ? ` · ${esc(t.assignee)}` : ""}`),
    "Nothing due today.",
  );

  const y: string[] = [];
  y.push(`• ${n(d.yesterday.bookings, "booking")}`);
  y.push(
    d.yesterday.payments.count
      ? `• ${n(d.yesterday.payments.count, "payment")}: ${d.yesterday.payments.totals.join(" + ")}`
      : "• No payments",
  );
  add("Yesterday", y, "");

  const w: string[] = [];
  if (d.waiting.applications) w.push(`• ${n(d.waiting.applications, "membership application")} to review`);
  if (d.waiting.stays) w.push(`• ${n(d.waiting.stays, "request to stay", "requests to stay")} to confirm`);
  if (w.length) add("Waiting on us", w, "");

  const footer = `${link(`${origin}/dashboard`, "Open ARK OS")}  ·  ${link(`${origin}/events`, "Events")}  ·  ${link(`${origin}/operations`, "Operations")}`;
  blocks.push(context(footer));
  text.push(footer);
  return { text: text.join("\n\n"), blocks };
}

export function courtMessage(
  b: {
    holder: string;
    court: string;
    date: string;
    startTime: string;
    endTime: string;
    minutes: number;
    amount: string | null;
    openMatch: boolean;
    joined?: boolean;
    status: string;
  },
  origin: string,
) {
  const when = `${b.date} ${b.startTime.slice(0, 5)}–${b.endTime.slice(0, 5)}`;
  const head = b.joined
    ? `*Joined an open match:* ${esc(b.holder)} on ${esc(b.court)}`
    : `*Court booked:* ${esc(b.court)} by ${esc(b.holder)}${b.openMatch ? " (open match)" : ""}`;
  return message(
    head,
    [
      `${esc(when)} · ${b.minutes} min${b.amount ? ` · ${esc(b.amount)}` : ""}`,
      b.status === "held" ? "Paying on Stripe now; the slot is held for 20 minutes." : null,
    ],
    link(`${origin}/events/courts?date=${b.date}`, "Open Courts"),
  );
}
