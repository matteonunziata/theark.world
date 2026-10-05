import { siteUrl } from "@/lib/email";
import { runDue } from "@/lib/marketing-email";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Cron (vercel.json) calls this to send scheduled campaigns and the
// waitlist automation. Vercel sends "Authorization: Bearer $CRON_SECRET".

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return new Response("SUPABASE_SERVICE_ROLE_KEY is not set", { status: 503 });
  const result = await runDue(admin, await siteUrl());
  return Response.json(result);
}
