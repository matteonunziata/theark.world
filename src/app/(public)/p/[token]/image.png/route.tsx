import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/email";
import { passCode, passValidity } from "@/lib/pass";
import { passImage } from "@/lib/pass-image";

export async function GET(_req: Request, ctx: RouteContext<"/p/[token]/image.png">) {
  const { token } = await ctx.params;
  const supabase = await createClient();
  const { data: p } = await supabase.rpc("pass_by_token", { p_token: token }).maybeSingle();
  if (!p) return new Response("Not found", { status: 404 });
  return passImage({
    url: `${await siteUrl()}/p/${token}`,
    eyebrow: "Member pass",
    title: p.tier_name ?? "Member",
    holder: p.holder,
    lines: [passValidity(p)],
    code: passCode(token),
    filename: "ARK member pass.png",
  });
}
