import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Cron (vercel.json) runs this daily. Anyone whose agreement is gone or whose
// property invoices are past the grace period drops out of active, and the 48-month
// clock resets. Vercel sends "Authorization: Bearer $CRON_SECRET".

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return new Response("SUPABASE_SERVICE_ROLE_KEY is not set", { status: 503 });
  const { data, error } = await admin.rpc("reconcile_stewards");
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ changed: data });
}
