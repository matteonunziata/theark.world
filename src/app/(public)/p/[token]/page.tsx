import type { Metadata } from "next";
import QRCode from "qrcode";
import { ScanResult } from "@/components/scan-result";
import { PortalHead } from "@/components/portal-head";
import { SaveImageButton } from "@/components/save-image";
import { getViewer } from "@/lib/auth";
import { siteUrl } from "@/lib/email";
import { PASS_STATE, passCode, passValidity } from "@/lib/pass";
import { LogEntryButton } from "./pass-actions";

export const metadata: Metadata = { title: "Member pass", robots: { index: false } };

export default async function PassPage({ params, searchParams }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const { look } = await searchParams;
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
      sub={staff ? "Security check" : "Member pass"}
      link={staff ? { href: "/security", label: "Security console" } : p?.is_mine ? { href: "/portal", label: "Members portal" } : undefined}
    />
  );

  if (!p) {
    return (
      <>
        {head}
        {staff && <ScanResult ok={false} title="Not valid" detail="This code isn’t on any membership." />}
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
  // Security scanning a valid pass lets the member in and logs the entry.
  // Passes work every day, so there's no "already used" for members.
  const admitted = p.can_log && ok && !look && !(await supabase.rpc("log_pass_entry", { p_token: token })).error;
  const time = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });

  return (
    <>
      {head}
      {p.can_log && !look && (
        <ScanResult
          ok={ok}
          title={ok ? "Access approved" : (PASS_STATE[p.state] ?? "Not valid")}
          name={p.holder}
          detail={passValidity(p)}
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
            {p.can_log && ok && !admitted && <LogEntryButton token={token} />}
            {(p.is_mine || !staff) && (
              <SaveImageButton href={`/p/${token}/image.png`} filename="ARK member pass.png" className="btn primary" />
            )}
          </div>
          <p className="gate-note" style={{ marginTop: 16 }}>
            {ok
              ? "Show this to security when you arrive, any time of day. They scan it with a phone camera."
              : "If this doesn’t look right, write to us and we’ll sort it out."}
          </p>
        </div>
      </div>
    </>
  );
}
