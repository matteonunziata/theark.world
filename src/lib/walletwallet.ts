import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Add to Apple Wallet / Google Wallet through WalletWallet (walletwallet.dev),
 * which signs the passes itself, so no Apple Developer account is needed.
 * Env: WALLETWALLET_API_KEY (ww_live_...). Also needs SUPABASE_SERVICE_ROLE_KEY,
 * to remember which wallet pass belongs to which ticket.
 */
export const walletWalletEnabled = () => !!(process.env.WALLETWALLET_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** t = event ticket, p = member / day pass, g = guest pass (the same letters as the pass URLs). */
export type WalletKind = "t" | "p" | "g";

export type WalletPass = {
  orgName: string;
  holder: string;
  what: string;
  when: string;
  where: string;
  /** What the QR holds: the pass link security scans. */
  url: string;
  /** Printed under the QR. */
  code: string;
};

/**
 * The page that puts the pass in the right wallet (Apple on iPhone, Google on
 * Android); makes the wallet pass the first time.
 */
export async function walletLink(kind: WalletKind, token: string, pass: WalletPass): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin || !walletWalletEnabled()) return null;

  const saved = () => admin.from("wallet_passes").select("share_url").eq("kind", kind).eq("token", token).maybeSingle();
  const { data: have } = await saved();
  if (have) return have.share_url;

  const res = await fetch("https://api.walletwallet.dev/api/passes", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WALLETWALLET_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      logoText: pass.orgName.slice(0, 35),
      organizationName: pass.orgName.slice(0, 64),
      description: `${pass.what} for ${pass.orgName}`,
      colorPreset: "green",
      barcodeValue: pass.url,
      barcodeFormat: "QR",
      barcodeAltText: pass.code,
      primaryFields: [{ label: "PASS", value: pass.what }],
      secondaryFields: [
        { label: "NAME", value: pass.holder },
        { label: "WHEN", value: pass.when || "-" },
        ...(pass.where ? [{ label: "WHERE", value: pass.where }] : []),
      ],
      backFields: [{ label: "Pass link", value: pass.url }],
    }),
  });
  if (!res.ok) {
    console.error("WalletWallet create failed", res.status, await res.text());
    return null;
  }
  const { serialNumber, shareUrl } = (await res.json()) as { serialNumber?: string; shareUrl?: string };
  if (!serialNumber || !shareUrl) return null;

  const { error } = await admin.from("wallet_passes").insert({ kind, token, serial: serialNumber, share_url: shareUrl });
  if (error?.code === "23505") {
    // A second tap raced this one; use the pass that got saved first.
    const { data: first } = await saved();
    return first?.share_url ?? shareUrl;
  }
  if (error) console.error("Saving wallet pass failed", error);
  return shareUrl;
}
