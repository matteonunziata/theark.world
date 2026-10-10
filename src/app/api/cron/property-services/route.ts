import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Cron (vercel.json) runs this daily. It turns each property's recurring
// services into Operations tasks for the next 60 days; repeating it creates nothing new.
// Vercel sends "Authorization: Bearer $CRON_SECRET".

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return new Response("SUPABASE_SERVICE_ROLE_KEY is not set", { status: 503 });
  const { data, error } = await admin.rpc("generate_service_tasks");
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ created: data });
}
