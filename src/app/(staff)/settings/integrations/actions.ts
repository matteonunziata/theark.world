"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { siteUrl } from "@/lib/email";
import { getIntegration, logEvent, runSync, testConnection } from "@/lib/ghl";
import * as guesty from "@/lib/guesty";
import * as slack from "@/lib/slack";
import { message, normalizeChannel, rulesFromForm } from "@/lib/slack-format";

const refresh = () => revalidatePath("/settings/integrations", "layout");

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong talking to GHL.";

export async function saveGhl(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const current = await getIntegration(supabase);
  if (!current) return fail("Couldn’t read the integration.");

  const locationId = field(data, "location_id");
  const token = field(data, "secret") ?? current.secret;
  const direction = field(data, "direction") ?? "both";
  const tag = field(data, "tag") ?? "ark-os";
  const enabled = data.get("enabled") === "on";
  if (!locationId) return fail("Enter the sub-account’s Location ID.");
  if (!token) return fail("Paste the private integration token.");
  if (!["both", "push", "pull"].includes(direction)) return fail("Choose a direction.");
  if (/\s/.test(tag)) return fail("The tag can’t have spaces.");

  // A new token or sub-account is checked before it's kept.
  const changed = token !== current.secret || locationId !== current.location_id || !current.connected_at;
  let locationName: string | null = null;
  if (changed) {
    try {
      locationName = await testConnection(token, locationId);
    } catch (e) {
      await logEvent(supabase, { direction: "out", kind: "test", ok: false, detail: errorText(e) });
      return fail(errorText(e));
    }
  }

  const { error } = await supabase
    .from("integrations")
    .update({
      location_id: locationId,
      secret: token,
      direction,
      tag,
      enabled,
      ...(changed ? { connected_at: new Date().toISOString(), last_error: null } : {}),
    })
    .eq("key", "ghl");
  if (error) return fail(friendly(error));
  if (changed) {
    await logEvent(supabase, {
      direction: "out",
      kind: "test",
      ok: true,
      detail: locationName ? `Connected to ${locationName}.` : "Connected.",
    });
  }
  refresh();
  return ok(changed ? (locationName ? `Connected to ${locationName}` : "Connected to GHL") : "Settings saved");
}

export async function testGhl(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const i = await getIntegration(supabase);
  if (!i?.secret || !i.location_id) return fail("Connect GHL first.");
  try {
    const name = await testConnection(i.secret, i.location_id);
    await logEvent(supabase, { direction: "out", kind: "test", ok: true, detail: name ? `Reached ${name}.` : "Reached GHL." });
    await supabase.from("integrations").update({ last_error: null }).eq("key", "ghl");
    refresh();
    return ok(name ? `Reached ${name}` : "GHL is reachable");
  } catch (e) {
    await logEvent(supabase, { direction: "out", kind: "test", ok: false, detail: errorText(e) });
    await supabase.from("integrations").update({ last_error: errorText(e) }).eq("key", "ghl");
    refresh();
    return fail(errorText(e));
  }
}

export async function syncGhlNow(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const r = await runSync(supabase);
  refresh();
  if ("error" in r) return fail(r.error);
  const parts = [];
  if (r.pushed) parts.push(`sent ${r.pushed}`);
  if (r.pulled) parts.push(`checked ${r.pulled} from GHL, ${r.created} new`);
  const summary = parts.length ? parts.join(", ") : "nothing new either way";
  if (r.errors.length) return fail(`Synced (${summary}), but ${r.errors.length} failed: ${r.errors[0]}`);
  return ok(`Synced: ${summary}`);
}

export async function disconnectGhl(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const { error } = await supabase
    .from("integrations")
    .update({ secret: null, enabled: false, connected_at: null, last_error: null })
    .eq("key", "ghl");
  if (error) return fail(friendly(error));
  refresh();
  return ok("Disconnected. Links to GHL contacts are kept.");
}

export async function rotateGhlWebhookKey(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const { error } = await supabase
    .from("integrations")
    .update({ webhook_secret: randomBytes(24).toString("hex") })
    .eq("key", "ghl");
  if (error) return fail(friendly(error));
  refresh();
  return ok("New webhook address. Update it in your GHL workflow.");
}

// Guesty ---------------------------------------------------------------------

const guestyError = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong talking to Guesty.";

export async function saveGuesty(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const current = await guesty.getIntegration(supabase);
  if (!current) return fail("Couldn’t read the integration.");

  const clientId = field(data, "client_id");
  const secret = field(data, "secret") ?? current.secret;
  const direction = field(data, "direction") ?? "pull";
  const enabled = data.get("enabled") === "on";
  const syncDetails = data.get("sync_details") === "on";
  if (!clientId) return fail("Enter the client id.");
  if (!secret) return fail("Paste the client secret.");
  if (!["pull", "both"].includes(direction)) return fail("Choose a direction.");

  // New credentials are checked before they're kept, and the token that
  // comes back is saved (Guesty allows five a day).
  const changed = secret !== current.secret || clientId !== current.client_id || !current.connected_at;
  let listings: number | null = null;
  let token: { token: string; expiresAt: string } | null = null;
  if (changed) {
    try {
      const t = await guesty.testConnection(clientId, secret);
      listings = t.listings;
      token = t;
    } catch (e) {
      await guesty.logEvent(supabase, { direction: "out", kind: "test", ok: false, detail: guestyError(e) });
      return fail(guestyError(e));
    }
  }

  const { error } = await supabase
    .from("integrations")
    .update({
      client_id: clientId,
      secret,
      direction,
      enabled,
      sync_details: syncDetails,
      ...(changed
        ? {
            connected_at: new Date().toISOString(),
            last_error: null,
            access_token: token?.token ?? null,
            token_expires_at: token?.expiresAt ?? null,
          }
        : {}),
    })
    .eq("key", "guesty");
  if (error) return fail(friendly(error));
  if (changed) {
    await guesty.logEvent(supabase, {
      direction: "out",
      kind: "test",
      ok: true,
      detail: `Connected. Guesty has ${listings ?? 0} listing${listings === 1 ? "" : "s"}.`,
    });
  }
  refresh();
  return ok(changed ? "Connected to Guesty" : "Settings saved");
}

export async function testGuesty(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const i = await guesty.getIntegration(supabase);
  if (!i?.secret || !i.client_id) return fail("Connect Guesty first.");
  try {
    const t = await guesty.testConnection(i.client_id, i.secret);
    await supabase
      .from("integrations")
      .update({ last_error: null, access_token: t.token, token_expires_at: t.expiresAt })
      .eq("key", "guesty");
    await guesty.logEvent(supabase, { direction: "out", kind: "test", ok: true, detail: `Reached Guesty: ${t.listings} listings.` });
    refresh();
    return ok(`Guesty is reachable (${t.listings} listings)`);
  } catch (e) {
    await guesty.logEvent(supabase, { direction: "out", kind: "test", ok: false, detail: guestyError(e) });
    await supabase.from("integrations").update({ last_error: guestyError(e) }).eq("key", "guesty");
    refresh();
    return fail(guestyError(e));
  }
}

export async function syncGuestyNow(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const r = await guesty.runSync(supabase);
  refresh();
  revalidatePath("/hospitality", "layout");
  if ("error" in r) return fail(r.error);
  const parts = [`${r.listings} listings`];
  if (r.pulled) parts.push(`${r.pulled} reservations checked (${r.created} new, ${r.updated} updated, ${r.cancelled} cancelled)`);
  else parts.push("no reservation changes");
  if (r.unmapped) parts.push(`${r.unmapped} for listings not linked to a home`);
  if (r.pushed) parts.push(`${r.pushed} stays blocked in Guesty`);
  const summary = parts.join(", ");
  if (r.errors.length) return fail(`Synced (${summary}), but ${r.errors.length} failed: ${r.errors[0]}`);
  return ok(`Synced: ${summary}`);
}

export async function disconnectGuesty(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const { error } = await supabase
    .from("integrations")
    .update({
      secret: null,
      enabled: false,
      connected_at: null,
      last_error: null,
      access_token: null,
      token_expires_at: null,
      webhook_id: null,
      webhook_signing_secret: null,
    })
    .eq("key", "guesty");
  if (error) return fail(friendly(error));
  refresh();
  return ok("Disconnected. Stays from Guesty and the links between homes and listings are kept.");
}

export async function rotateGuestyWebhookKey(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const { error } = await supabase
    .from("integrations")
    .update({ webhook_secret: randomBytes(24).toString("hex"), webhook_id: null, webhook_signing_secret: null })
    .eq("key", "guesty");
  if (error) return fail(friendly(error));
  refresh();
  return ok("New webhook address. Register it in Guesty again.");
}

export async function registerGuestyWebhook(url: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  if (!/^https:\/\//.test(url)) return fail("Guesty only accepts an https:// address. Register it from the live site.");
  try {
    const r = await guesty.registerWebhook(supabase, url);
    await guesty.logEvent(supabase, {
      direction: "out",
      kind: "test",
      ok: true,
      detail: `Registered the webhook in Guesty${r.signed ? ", signed" : ""}.`,
    });
    refresh();
    return ok(r.signed ? "Webhook registered and signed" : "Webhook registered");
  } catch (e) {
    await guesty.logEvent(supabase, { direction: "out", kind: "test", ok: false, detail: `Webhook: ${guestyError(e)}` });
    refresh();
    return fail(guestyError(e));
  }
}

/** Which home a Guesty listing is. Null unlinks it. */
export async function mapGuestyListing(listingId: string, lotId: string | null): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  if (!listingId) return fail("Choose a listing.");
  const { error: clear } = await supabase.from("lots").update({ guesty_listing_id: null }).eq("guesty_listing_id", listingId);
  if (clear) return fail(friendly(clear));
  if (lotId) {
    const { error } = await supabase.from("lots").update({ guesty_listing_id: listingId }).eq("id", lotId);
    if (error) return fail(error.code === "23505" ? "That home is already linked to another listing." : friendly(error));
  }
  refresh();
  revalidatePath("/hospitality", "layout");
  return ok(lotId ? "Linked" : "Unlinked");
}

// Slack -------------------------------------------------------------------------

const slackText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong talking to Slack.");

export async function saveSlack(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const current = await slack.getIntegration(supabase);
  if (!current) return fail("Couldn’t read the integration.");

  const token = field(data, "secret") ?? current.secret;
  const channel = normalizeChannel(field(data, "channel") ?? "");
  const enabled = data.get("enabled") === "on";
  const rules = rulesFromForm(
    (n) => field(data, n),
    (n) => data.get(n) === "on",
  );
  if (!token) return fail("Paste the bot token.");
  if (!token.startsWith("xoxb-")) return fail("That doesn’t look like a bot token. It starts with xoxb-.");
  if (!channel) return fail("Enter the channel to post in, like #ark-os.");

  // A new token is checked before it's kept.
  const changed = token !== current.secret || !current.connected_at;
  let team: string | null = current.account_name;
  if (changed) {
    try {
      team = (await slack.testConnection(token)).team;
    } catch (e) {
      await slack.logEvent(supabase, { kind: "test", ok: false, detail: slackText(e) });
      return fail(slackText(e));
    }
  }

  const { error } = await supabase
    .from("integrations")
    .update({
      secret: token,
      channel,
      rules,
      enabled,
      account_name: team,
      ...(changed ? { connected_at: new Date().toISOString(), last_error: null } : {}),
    })
    .eq("key", "slack");
  if (error) return fail(friendly(error));
  if (changed) {
    await slack.logEvent(supabase, { kind: "test", ok: true, detail: team ? `Connected to ${team}.` : "Connected." });
  }
  refresh();
  return ok(changed ? (team ? `Connected to ${team}` : "Connected to Slack") : "Settings saved");
}

export async function testSlack(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const i = await slack.getIntegration(supabase);
  if (!i?.secret) return fail("Connect Slack first.");
  try {
    const r = await slack.testConnection(i.secret);
    await slack.logEvent(supabase, { kind: "test", ok: true, detail: r.team ? `Reached ${r.team}.` : "Reached Slack." });
    await supabase.from("integrations").update({ last_error: null, account_name: r.team }).eq("key", "slack");
    refresh();
    return ok(r.team ? `Reached ${r.team}` : "Slack is reachable");
  } catch (e) {
    await slack.logEvent(supabase, { kind: "test", ok: false, detail: slackText(e) });
    await supabase.from("integrations").update({ last_error: slackText(e) }).eq("key", "slack");
    refresh();
    return fail(slackText(e));
  }
}

/** Post a hello to the default channel, so the channel and permissions are known to work. */
export async function sendSlackTest(): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin");
  const i = await slack.getIntegration(supabase);
  if (!i?.secret) return fail("Connect Slack first.");
  if (!i.channel) return fail("Enter the channel to post in first.");
  const channel = normalizeChannel(i.channel);
  const origin = await siteUrl();
  try {
    await slack.postMessage(
      i.secret,
      channel,
      message(
        `*ARK OS is connected.* ${staff.name} sent this test from Settings.`,
        ["What gets posted here is chosen in Settings → Integrations → Slack."],
        `<${origin}/settings/integrations/slack|Open the settings>`,
      ),
    );
    await slack.logEvent(supabase, { kind: "test", ok: true, detail: `Test message → ${channel}` });
    await supabase.from("integrations").update({ last_error: null }).eq("key", "slack");
    refresh();
    return ok(`Posted in ${channel}`);
  } catch (e) {
    await slack.logEvent(supabase, { kind: "test", ok: false, detail: `Test message: ${slackText(e)}` });
    await supabase.from("integrations").update({ last_error: slackText(e) }).eq("key", "slack");
    refresh();
    return fail(slackText(e));
  }
}

/** Post today's digest now, to see what it looks like. */
export async function sendSlackDigest(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const r = await slack.sendDigest(supabase, await siteUrl());
  refresh();
  if (!r.sent) return fail(r.reason === "digest is off." ? "Switch on the morning digest first, then save." : r.reason);
  return ok(`Digest posted in ${r.channel}`);
}

export async function disconnectSlack(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const { error } = await supabase
    .from("integrations")
    .update({ secret: null, enabled: false, connected_at: null, last_error: null, account_name: null })
    .eq("key", "slack");
  if (error) return fail(friendly(error));
  refresh();
  return ok("Disconnected. Your channel choices are kept.");
}
