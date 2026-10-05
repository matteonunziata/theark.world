import { createClient } from "@/lib/supabase/server";

// One-click unsubscribe (RFC 8058): mail apps POST here from the
// List-Unsubscribe header. A plain visit goes to the page that asks first.

export async function POST(_req: Request, ctx: RouteContext<"/api/unsubscribe/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  await supabase.rpc("email_unsubscribe", { p_send: id });
  return new Response("Unsubscribed", { status: 200 });
}

export async function GET(req: Request, ctx: RouteContext<"/api/unsubscribe/[id]">) {
  const { id } = await ctx.params;
  return Response.redirect(new URL(`/u/${id}`, req.url), 303);
}
