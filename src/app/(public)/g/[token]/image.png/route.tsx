import { fmtDate } from "@/lib/dates";
import { siteUrl } from "@/lib/email";
import { guestCode } from "@/lib/pass";
import { passImage } from "@/lib/pass-image";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, ctx: RouteContext<"/g/[token]/image.png">) {
  const { token } = await ctx.params;
  const supabase = await createClient();
  const { data: g } = await supabase.rpc("guest_pass_by_token", { p_token: token }).maybeSingle();
  if (!g) return new Response("Not found", { status: 404 });
  return passImage({
    url: `${await siteUrl()}/g/${token}`,
    eyebrow: "Guest pass",
    title: fmtDate(g.visit_date, { weekday: "long", month: "long", day: "numeric" }),
    holder: g.guest_name,
    lines: [`Guest of ${g.host_name}`, "Works once, on this day"],
    code: guestCode(token),
    filename: "ARK guest pass.png",
  });
}
