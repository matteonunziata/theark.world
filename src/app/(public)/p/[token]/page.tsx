import type { Metadata } from "next";
import QRCode from "qrcode";
import { avatarUrl } from "@/lib/covers";
import { GateButton } from "@/components/gate-button";
import { PortalHead } from "@/components/portal-head";
import { SaveImageButton } from "@/components/save-image";
import { ScanResult } from "@/components/scan-result";
import { getViewer } from "@/lib/auth";
import { siteUrl } from "@/lib/email";
import { PASS_STATE, passCode, passOk, passReason, passValidity } from "@/lib/pass";
import { checkInPass } from "../actions";

export const metadata: Metadata = { title: "Member pass", robots: { index: false } };

export default async function PassPage({ params, searchParams }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const { look, done } = await searchParams;
  const { supabase, staff } = await getViewer();
  const [{ data: p }, { data: org }] = await Promise.all([
    supabase.rpc("pass_by_token", { p_token: token }).maybeSingle(),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  const orgName = org?.name ?? "The ARK";
  const tz = org?.timezone ?? "America/Costa_Rica";
  const scanning = !!staff && !look && !done;
  const head = (
    <PortalHead
      name={orgName}
      sub={staff ? "Security check" : "Member pass"}
      link={staff ? { href: "/security", label: "Security console" } : p?.is_mine ? { href: "/portal", label: "Members portal" } : undefined}
    />
  );

  if (!p) {
    if (scanning) await supabase.rpc("log_gate_scan", { p_token: token });
    return (
      <>
        {head}
        {scanning && <ScanResult ok={false} title="Not valid" detail="This code isn’t on any membership." />}
        <div className="p-body">
          <div className="ticket">
            <span className="state bad">Not valid</span>
            <h1>Pass not found</h1>
            <p className="muted">The link may be incomplete, or the pass was replaced.</p>
          </div>
        </div>
      </>
    );
  }

  // A red scan is logged on sight; a green one when security taps Check in.
  if (scanning && !passOk(p.state)) await supabase.rpc("log_gate_scan", { p_token: token });

  const url = `${await siteUrl()}/p/${token}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 0 });
  const ok = passOk(p.state);
  const justIn = !!done && p.state === "checked_in";
  const time = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
  const photo = p.photo_path ? avatarUrl(p.photo_path) : null;

  return (
    <>
      {head}
      {p.can_log && !look && (justIn || scanning) && (
        <ScanResult
          ok={ok || justIn}
          title={justIn ? "Checked in" : ok ? "Valid" : "Not valid"}
          name={p.holder}
          detail={justIn && p.checked_in_at ? `${p.tier_name ?? "Member"}, ${time(p.checked_in_at)}` : passReason(p, tz)}
          action={ok && !justIn ? <GateButton token={token} action={checkInPass} href={`/p/${token}?done=1`} /> : undefined}
        />
      )}
      <div className="p-body">
        <div className="ticket pass">
          <span className="ptype">{orgName} · Member pass</span>
          {photo && staff && (
            // eslint-disable-next-line @next/next/no-img-element -- member photo from storage
            <img src={photo} alt="" width={96} height={96} style={{ borderRadius: "50%", objectFit: "cover", margin: "10px auto 0", display: "block" }} />
          )}
          <h1>{p.holder}</h1>
          <p style={{ margin: "4px 0 0" }}>{passValidity(p)}</p>
          {/* QR markup generated on the server from our own URL. */}
          <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="code">{passCode(token)}</div>
          <span className={`state ${ok ? "ok" : p.state === "checked_in" ? "used" : "bad"}`}>
            {p.state === "checked_in" && p.checked_in_at ? `Checked in ${time(p.checked_in_at)}` : (PASS_STATE[p.state] ?? "Not valid")}
          </span>
          {p.can_log && !ok && p.state !== "checked_in" && (
            <p className="muted" style={{ fontSize: 13.5, margin: "10px 0 0" }}>{passReason(p, tz)}</p>
          )}
          {p.can_log && p.last_entry_at && !justIn && p.state !== "checked_in" && (
            <p className="muted" style={{ fontSize: 13.5, margin: "10px 0 0" }}>Last visit {time(p.last_entry_at)}</p>
          )}
          <div className="acts">
            {p.can_log && ok && <GateButton token={token} action={checkInPass} href={`/p/${token}?done=1`} />}
            {(p.is_mine || !staff) && (
              <SaveImageButton href={`/p/${token}/image.png`} filename="ARK member pass.png" className="btn primary" />
            )}
          </div>
          <p className="gate-note" style={{ marginTop: 16 }}>
            {p.state === "unused"
              ? "Show this to security on your first visit; that starts your pass. Use it within the next three months."
              : ok
                ? "Show this to security when you arrive. They scan it with a phone camera and check you in once a day."
                : p.state === "checked_in"
                  ? "You’re checked in for today."
                  : "If this doesn’t look right, write to us and we’ll sort it out."}
          </p>
        </div>
      </div>
    </>
  );
}
