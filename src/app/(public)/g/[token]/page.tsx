import type { Metadata } from "next";
import QRCode from "qrcode";
import { GateButton } from "@/components/gate-button";
import { PortalHead } from "@/components/portal-head";
import { SaveImageButton } from "@/components/save-image";
import { WalletButton } from "@/components/wallet-button";
import { ScanResult } from "@/components/scan-result";
import { getViewer } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import { siteUrl } from "@/lib/email";
import { guestCode } from "@/lib/pass";
import { letGuestIn } from "../actions";

export const metadata: Metadata = { title: "Guest pass", robots: { index: false } };

const LABEL: Record<string, [string, string]> = {
  valid: ["ok", "Valid today"],
  upcoming: ["soon", "Valid on the day"],
  used: ["used", "Used"],
  expired: ["bad", "Expired"],
  cancelled: ["bad", "Cancelled"],
};

export default async function GuestPassPage({ params, searchParams }: PageProps<"/g/[token]">) {
  const { token } = await params;
  const { look, done } = await searchParams;
  const { supabase, staff } = await getViewer();
  const [{ data: g }, { data: org }] = await Promise.all([
    supabase.rpc("guest_pass_by_token", { p_token: token }).maybeSingle(),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  const orgName = org?.name ?? "The ARK";
  const tz = org?.timezone ?? "America/Costa_Rica";
  const head = (
    <PortalHead
      name={orgName}
      sub={staff ? "Security check" : "Guest pass"}
      link={staff ? { href: "/security", label: "Security console" } : undefined}
    />
  );

  if (!g) {
    return (
      <>
        {head}
        {staff && !look && <ScanResult ok={false} title="Not valid" detail="This code isn’t on any guest pass." />}
        <div className="p-body">
          <div className="ticket">
            <span className="state bad">Not valid</span>
            <h1>Pass not found</h1>
            <p className="muted">The link may be incomplete, or the invite was cancelled.</p>
          </div>
        </div>
      </>
    );
  }

  // Security scans, sees green or red, and taps Let in; that uses the pass up.
  const admitted = !!done && g.state === "used";
  const day = fmtDate(g.visit_date, { weekday: "long", month: "long", day: "numeric" });
  const at = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const scan = admitted
    ? { ok: true, title: "Checked in", detail: `Guest of ${g.host_name}` }
    : g.state === "valid"
      ? { ok: true, title: "Valid", detail: `Guest of ${g.host_name}, today` }
      : {
          ok: false,
          ...({
            used: { title: "Already used", detail: g.used_at ? `Came in at ${at(g.used_at)}` : "" },
            upcoming: { title: "Not today", detail: `This pass is for ${day}` },
            expired: { title: "Expired", detail: `This pass was for ${day}` },
            cancelled: { title: "Cancelled", detail: `${g.host_name} cancelled this invite` },
          }[g.state] ?? { title: "Not valid", detail: "" }),
        };
  const url = `${await siteUrl()}/g/${token}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 0 });
  const [cls, label] = LABEL[g.state] ?? ["bad", "Not valid"];

  return (
    <>
      {head}
      {g.can_log && !look && (admitted || !done) && (
        <ScanResult
          ok={scan.ok}
          title={scan.title}
          name={g.guest_name}
          detail={scan.detail}
          action={g.state === "valid" ? <GateButton token={token} action={letGuestIn} href={`/g/${token}?done=1`} label="Let in" /> : undefined}
        />
      )}
      <div className="p-body">
        <div className="ticket pass">
          <span className="ptype">{orgName} · Guest pass</span>
          <h1>{g.guest_name}</h1>
          <p style={{ margin: "4px 0 0" }}>
            {day}
            <br />
            <span className="muted">Guest of {g.host_name}</span>
          </p>
          {/* QR markup generated on the server from our own URL. */}
          <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="code">{guestCode(token)}</div>
          <span className={`state ${cls}`}>{g.state === "used" && g.used_at ? `Used at ${at(g.used_at)}` : label}</span>
          <div className="acts">
            {g.can_log && g.state === "valid" && (
              <GateButton token={token} action={letGuestIn} href={`/g/${token}?done=1`} label="Let in" />
            )}
            {(g.state === "valid" || g.state === "upcoming") && (
              <SaveImageButton href={`/g/${token}/image.png`} filename="ARK guest pass.png" className="btn primary" />
            )}
          </div>
          {(g.state === "valid" || g.state === "upcoming") && <WalletButton kind="g" token={token} />}
          <p className="gate-note" style={{ marginTop: 16 }}>
            Show this to security when you arrive. It works once, on the day of your visit.
          </p>
        </div>
      </div>
    </>
  );
}
