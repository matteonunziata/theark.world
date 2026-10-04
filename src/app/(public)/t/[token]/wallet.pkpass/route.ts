import { PKPass } from "passkit-generator";
import { fmtDate, timeRange } from "@/lib/dates";
import { ticketCode } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { pem, walletEnabled } from "@/lib/wallet";

const IMAGES = ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png", "logo@3x.png"];

// An Apple Wallet event ticket for one booking. The QR holds the same ticket
// link the gate scans everywhere else.
export async function GET(req: Request, ctx: RouteContext<"/t/[token]/wallet.pkpass">) {
  if (!walletEnabled()) {
    return new Response("Apple Wallet isn’t set up yet.", { status: 404 });
  }
  const { token } = await ctx.params;
  const supabase = await createClient();
  const [{ data: t }, { data: org }] = await Promise.all([
    supabase.rpc("ticket_by_token", { p_token: token }).maybeSingle(),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  if (!t) return new Response("Ticket not found", { status: 404 });

  const origin = new URL(req.url).origin;
  const url = `${origin}/t/${token}`;
  const images = Object.fromEntries(
    await Promise.all(
      IMAGES.map(async (f) => [
        f,
        Buffer.from(await (await fetch(`${origin}/brand/wallet/${f}`)).arrayBuffer()),
      ]),
    ),
  );

  const pass = new PKPass(
    {
      ...images,
      "pass.json": Buffer.from(
        JSON.stringify({
          formatVersion: 1,
          passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
          teamIdentifier: process.env.APPLE_TEAM_ID,
          organizationName: org?.name ?? "The ARK",
          description: `${t.title} ticket`,
          serialNumber: t.registration_id,
          backgroundColor: "rgb(33, 64, 45)",
          foregroundColor: "rgb(239, 239, 232)",
          labelColor: "rgb(169, 188, 174)",
          eventTicket: {},
        }),
      ),
    },
    {
      wwdr: pem("APPLE_WWDR_CERT"),
      signerCert: pem("APPLE_PASS_CERT"),
      signerKey: pem("APPLE_PASS_KEY"),
      signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE,
    },
  );

  pass.primaryFields.push({ key: "event", label: t.kind === "event" ? "EVENT" : "CLASS", value: t.title });
  pass.secondaryFields.push(
    { key: "date", label: "DATE", value: fmtDate(t.session_date, { weekday: "short", month: "short", day: "numeric" }) },
    { key: "time", label: "TIME", value: timeRange(t) || "All day" },
  );
  pass.auxiliaryFields.push(
    { key: "holder", label: "GUEST", value: t.holder },
    { key: "where", label: "WHERE", value: t.location ?? org?.location ?? "" },
  );
  pass.backFields.push(
    { key: "code", label: "Ticket code", value: ticketCode(token) },
    { key: "link", label: "Ticket", value: url },
  );
  pass.setBarcodes({ message: url, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: ticketCode(token) });
  if (t.start_time) {
    pass.setRelevantDate(new Date(`${t.session_date}T${t.start_time.slice(0, 5)}:00-06:00`));
  }

  return new Response(new Uint8Array(pass.getAsBuffer()), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="the-ark-ticket.pkpass"`,
    },
  });
}
