import { runSync } from "@/lib/ghl";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Cron (vercel.json) runs the GHL sync once a day. Vercel sends
// "Authorization: Bearer $CRON_SECRET".

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return new Response("SUPABASE_SERVICE_ROLE_KEY is not set", { status: 503 });
  return Response.json(await runSync(admin));
}
