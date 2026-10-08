import { fmtDate, timeRange } from "@/lib/dates";
import { ticketCode } from "@/lib/email";
import { guestCode, passCode, passOk, passValidity } from "@/lib/pass";
import { type WalletKind, type WalletPass, pass2uEnabled, walletLink } from "@/lib/pass2u";
import { kindName } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

// "Add to Apple Wallet / Google Wallet" for any pass: /wallet/t|p|g/{token}.
// Checks the token is a live pass, makes the wallet pass once, and sends the
// person to Pass2U's page, which hands Apple devices the pass and Android the
// Google Wallet / Pass2U one.
export async function GET(req: Request, ctx: RouteContext<"/wallet/[kind]/[token]">) {
  const { kind, token } = await ctx.params;
  if (!pass2uEnabled()) return new Response("Wallet passes aren’t set up yet.", { status: 404 });
  if (kind !== "t" && kind !== "p" && kind !== "g") return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: org } = await supabase.rpc("public_org").maybeSingle();
  const url = `${new URL(req.url).origin}/${kind}/${token}`;
  const elsewhere = org?.location ?? "";
  let pass: WalletPass | null = null;

  if (kind === "t") {
    const { data: t } = await supabase.rpc("ticket_by_token", { p_token: token }).maybeSingle();
    if (t && ["valid", "upcoming", "early"].includes(t.state)) {
      pass = {
        holder: t.holder,
        what: `${kindName(t.kind)}: ${t.title}`,
        when: [fmtDate(t.session_date, { weekday: "short", month: "short", day: "numeric" }), timeRange(t)].filter(Boolean).join(", "),
        where: t.location ?? elsewhere,
        url,
        code: ticketCode(token),
        relevantDate: t.start_time ? `${t.session_date}T${t.start_time.slice(0, 5)}:00-06:00` : undefined,
      };
    }
  } else if (kind === "p") {
    const { data: p } = await supabase.rpc("pass_by_token", { p_token: token }).maybeSingle();
    if (p && (passOk(p.state) || p.state === "checked_in")) {
      pass = { holder: p.holder, what: p.tier_name ?? "Member pass", when: passValidity(p), where: elsewhere, url, code: passCode(token) };
    }
  } else {
    const { data: g } = await supabase.rpc("guest_pass_by_token", { p_token: token }).maybeSingle();
    if (g && (g.state === "valid" || g.state === "upcoming")) {
      pass = {
        holder: g.guest_name,
        what: `Guest of ${g.host_name}`,
        when: fmtDate(g.visit_date, { weekday: "long", month: "long", day: "numeric" }),
        where: elsewhere,
        url,
        code: guestCode(token),
      };
    }
  }
  if (!pass) return new Response("This pass can’t be added to a wallet.", { status: 404 });

  const link = await walletLink(kind as WalletKind, token, pass);
  if (!link) return new Response("Couldn’t make the wallet pass. Try again in a moment.", { status: 502 });
  return Response.redirect(link, 302);
}
