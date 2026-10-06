import { runSync } from "@/lib/shopify";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Cron (vercel.json) runs this just after midnight in Costa Rica
// (06:05 UTC), so a membership that ended yesterday loses its Shopify tag, and
// with it the member10 / member20 code, in the first minutes of the day.
// Vercel sends "Authorization: Bearer $CRON_SECRET".

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return new Response("SUPABASE_SERVICE_ROLE_KEY is not set", { status: 503 });
  return Response.json({ shopify: await runSync(admin) });
}
