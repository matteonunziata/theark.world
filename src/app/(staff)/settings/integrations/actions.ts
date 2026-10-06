"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { getIntegration, logEvent, runSync, testConnection } from "@/lib/ghl";

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
