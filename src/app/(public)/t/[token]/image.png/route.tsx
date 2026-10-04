import { fmtDate, timeRange } from "@/lib/dates";
import { siteUrl, ticketCode, ticketUrl } from "@/lib/email";
import { passImage } from "@/lib/pass-image";
import { kindName } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, ctx: RouteContext<"/t/[token]/image.png">) {
  const { token } = await ctx.params;
  const supabase = await createClient();
  const { data: t } = await supabase.rpc("ticket_by_token", { p_token: token }).maybeSingle();
  if (!t) return new Response("Not found", { status: 404 });
  return passImage({
    url: ticketUrl(await siteUrl(), token),
    eyebrow: kindName(t.kind),
    title: t.title,
    holder: t.holder,
    lines: [
      `${fmtDate(t.session_date, { weekday: "long", month: "long", day: "numeric" })}, ${timeRange(t)}`,
      ...(t.location ? [t.location] : []),
    ],
    code: ticketCode(token),
    filename: `ARK ticket ${t.title}.png`.replace(/[^\w .-]/g, ""),
  });
}
