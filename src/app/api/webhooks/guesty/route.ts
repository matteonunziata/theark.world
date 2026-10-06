import { timingSafeEqual } from "node:crypto";
import { receiveWebhook } from "@/lib/guesty";
import { verifySignature } from "@/lib/guesty-map";
import { createAdminClient } from "@/lib/supabase/admin";

// Guesty posts reservation events here (Settings → Integrations → Guesty
// shows the address, which carries a shared key). A webhook registered from
// ARK OS is also signed; either the key or a valid signature lets it in.
// The event only carries ids, so the reservation is read back from Guesty
// and saved as a stay.

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return new Response("Not configured", { status: 503 });

  const { data: i } = await admin
    .from("integrations")
    .select("enabled, webhook_secret, webhook_signing_secret")
    .eq("key", "guesty")
    .maybeSingle();
  if (!i) return new Response("Forbidden", { status: 403 });

  const text = await request.text();
  const key = new URL(request.url).searchParams.get("key") ?? request.headers.get("x-ark-key") ?? "";
  const byKey = !!key && same(key, i.webhook_secret);
  const bySignature =
    !!i.webhook_signing_secret &&
    verifySignature(
      i.webhook_signing_secret,
      {
        id: request.headers.get("svix-id"),
        timestamp: request.headers.get("svix-timestamp"),
        signature: request.headers.get("svix-signature"),
      },
      text,
    );
  if (!byKey && !bySignature) return new Response("Forbidden", { status: 403 });
  if (!i.enabled) return new Response("Ignored: Guesty is paused");

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response("Bad body", { status: 400 });
  }
  const r = await receiveWebhook(admin, body);
  return new Response(r.message, { status: r.status });
}
