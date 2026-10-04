import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { SaveImageButton } from "@/components/save-image";
import { siteUrl } from "@/lib/email";
import { PASS_STATE, passCode, passValidity } from "@/lib/pass";
import { loadPortal } from "@/lib/portal";

export const metadata: Metadata = { title: "Your pass" };

export default async function MyPass() {
  const p = await loadPortal();
  const { data: token } = p.memberId ? await p.supabase.rpc("my_pass_token") : { data: null };
  const { data: pass } = token
    ? await p.supabase.rpc("pass_by_token", { p_token: token }).maybeSingle()
    : { data: null };

  if (!token || !pass) {
    return (
      <div className="pv-empty">
        <h3>No member pass</h3>
        <p>
          {p.staff
            ? "You’re signed in as staff. Member passes belong to members; open one from their CRM profile."
            : "Passes come with an active membership. Write to us and we’ll sort it out."}
        </p>
      </div>
    );
  }

  const url = `${await siteUrl()}/p/${token}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#21402D", light: "#FFFFFF" } });
  const ok = pass.state === "valid";

  return (
    <div className="pv-pass-wrap">
      <div className="pv-pass">
        <div className="pv-pass-top">
          <span>{p.orgName}</span>
          <span>Member pass</span>
        </div>
        <div className="pv-pass-body">
          <h1>{pass.holder}</h1>
          <p>{passValidity(pass)}</p>
          {/* QR markup generated on the server from our own URL. */}
          <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="code">{passCode(token)}</div>
          <span className={`pv-pass-state ${ok ? "ok" : "no"}`}>{PASS_STATE[pass.state] ?? "Not valid"}</span>
        </div>
      </div>
      <div className="pv-pass-acts">
        <SaveImageButton href={`/p/${token}/image.png`} filename="ARK member pass.png" className="pv-btn" label="Save to Photos" />
        <Link className="pv-btn ghost" href={`/p/${token}`}>Open full screen</Link>
      </div>
      <p className="pv-pass-note">
        Show the code at the gate{ok ? ", any time of day" : ""}. Saved to your photos, it works without
        signal. Your class and event tickets are under <Link href="/portal/bookings">Bookings</Link>.
      </p>
    </div>
  );
}
