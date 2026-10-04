import type { Metadata } from "next";
import QRCode from "qrcode";
import { GateFlash } from "@/components/gate-flash";
import { PortalHead } from "@/components/portal-head";
import { SaveImageButton } from "@/components/save-image";
import { getViewer } from "@/lib/auth";
import { siteUrl } from "@/lib/email";
import { PASS_STATE, passCode, passValidity } from "@/lib/pass";
import { LogEntryButton } from "./pass-actions";

export const metadata: Metadata = { title: "Member pass", robots: { index: false } };

export default async function PassPage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const { supabase, staff } = await getViewer();
  const [{ data: p }, { data: org }] = await Promise.all([
    supabase.rpc("pass_by_token", { p_token: token }).maybeSingle(),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  const orgName = org?.name ?? "The ARK";
  const tz = org?.timezone ?? "America/Costa_Rica";
  const head = (
    <PortalHead
      name={orgName}
      sub={staff ? "Gate check" : "Member pass"}
      link={staff ? { href: "/gate", label: "Gate console" } : p?.is_mine ? { href: "/portal", label: "Members portal" } : undefined}
    />
  );

  if (!p) {
    return (
      <>
        {head}
        {staff && <GateFlash ok={false} title="Not a valid pass" detail="This code isn’t on any membership." />}
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

  const url = `${await siteUrl()}/p/${token}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 0 });
  const ok = p.state === "valid";
  const time = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });

  return (
    <>
      {head}
      {p.can_log && (
        <GateFlash
          ok={ok}
          title={ok ? `Let ${p.holder.split(/\s+/)[0]} in` : PASS_STATE[p.state] ?? "Not valid"}
          detail={`${p.holder} · ${passValidity(p)}${p.last_entry_at ? ` · last in ${time(p.last_entry_at)}` : ""}`}
          action={ok ? <LogEntryButton token={token} className="gf-btn" /> : undefined}
        />
      )}
      <div className="p-body">
        <div className="ticket pass">
          <span className="ptype">{orgName} · Member pass</span>
          <h1>{p.holder}</h1>
          <p style={{ margin: "4px 0 0" }}>{passValidity(p)}</p>
          {/* QR markup generated on the server from our own URL. */}
          <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="code">{passCode(token)}</div>
          <span className={`state ${ok ? "ok" : "bad"}`}>{PASS_STATE[p.state] ?? "Not valid"}</span>
          {p.can_log && p.last_entry_at && (
            <p className="muted" style={{ fontSize: 13.5, margin: "10px 0 0" }}>Last entry {time(p.last_entry_at)}</p>
          )}
          <div className="acts">
            {p.can_log && ok && <LogEntryButton token={token} />}
            {(p.is_mine || !staff) && (
              <SaveImageButton href={`/p/${token}/image.png`} filename="ARK member pass.png" className="btn primary" />
            )}
          </div>
          <p className="gate-note" style={{ marginTop: 16 }}>
            {ok
              ? "Show this at the gate, any time of day. Security scans it with a phone camera."
              : "If this doesn’t look right, write to us and we’ll sort it out."}
          </p>
        </div>
      </div>
    </>
  );
}
