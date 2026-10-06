import { timingSafeEqual } from "node:crypto";
import { receiveWebhook } from "@/lib/ghl";
import { createAdminClient } from "@/lib/supabase/admin";

// A GHL workflow posts a contact here (Settings → Integrations → GoHighLevel
// shows the address, which carries the shared key). New people are added to
// the CRM; people we know get empty fields filled. Nothing is ever deleted.

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return new Response("Not configured", { status: 503 });

  const key = new URL(request.url).searchParams.get("key") ?? request.headers.get("x-ark-key") ?? "";
  const { data: i } = await admin.from("integrations").select("enabled, direction, webhook_secret").eq("key", "ghl").maybeSingle();
  if (!i || !key || !same(key, i.webhook_secret)) return new Response("Forbidden", { status: 403 });
  if (!i.enabled || i.direction === "push") return new Response("Ignored: GHL → ARK OS is off");

  let body: unknown;
  try {
    const text = await request.text();
    const type = request.headers.get("content-type") ?? "";
    body = type.includes("application/x-www-form-urlencoded")
      ? Object.fromEntries(new URLSearchParams(text))
      : JSON.parse(text);
  } catch {
    return new Response("Bad body", { status: 400 });
  }
  const r = await receiveWebhook(admin, body);
  return new Response(r.message, { status: r.status });
}
