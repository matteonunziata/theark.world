import { siteUrl } from "@/lib/email";
import { runSync as runGhl } from "@/lib/ghl";
import { runSync as runGuesty } from "@/lib/guesty";
import { sendDigest } from "@/lib/slack";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Cron (vercel.json) runs the GHL and Guesty syncs once a day, then
// posts the morning digest to Slack (Settings → Integrations → Slack) when
// that's on. 13:30 UTC is 7:30 in Costa Rica. Vercel sends
// "Authorization: Bearer $CRON_SECRET".

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return new Response("SUPABASE_SERVICE_ROLE_KEY is not set", { status: 503 });
  const ghl = await runGhl(admin);
  const guesty = await runGuesty(admin);
  const slack = await sendDigest(admin, await siteUrl());
  return Response.json({ ghl, guesty, slack });
}
