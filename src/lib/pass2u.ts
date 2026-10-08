import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Add to Apple Wallet / Google Wallet through Pass2U (pass2u.net), which signs
 * the passes itself, so no Apple Developer account is needed. One pass model is
 * designed in their dashboard with these dynamic text fields (keys exactly):
 * holder, what, when, where. The barcode must be "Dynamic - assigned by API".
 * Env: PASS2U_API_KEY, PASS2U_MODEL_ID. Also needs SUPABASE_SERVICE_ROLE_KEY.
 */
export const pass2uEnabled = () =>
  !!(process.env.PASS2U_API_KEY && process.env.PASS2U_MODEL_ID && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** t = event ticket, p = member / day pass, g = guest pass (the same letters as the pass URLs). */
export type WalletKind = "t" | "p" | "g";

export type WalletPass = {
  holder: string;
  what: string;
  when: string;
  where: string;
  /** What the QR holds: the pass link security scans. */
  url: string;
  /** Printed under the QR. */
  code: string;
  /** ISO 8601 with offset; the pass surfaces on the lock screen around then. */
  relevantDate?: string;
};

const API = "https://api.pass2u.net/v2";

/** Where to send the person to add the pass; makes the Pass2U pass the first time. */
export async function walletLink(kind: WalletKind, token: string, pass: WalletPass): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin || !pass2uEnabled()) return null;
  const link = (id: string) => `https://www.pass2u.net/d/${id}`;

  const { data: have } = await admin.from("wallet_passes").select("pass2u_id").eq("kind", kind).eq("token", token).maybeSingle();
  if (have) return link(have.pass2u_id);

  const field = (key: string, label: string, value: string) => ({ key, label, value: value || "-" });
  const res = await fetch(`${API}/models/${process.env.PASS2U_MODEL_ID}/passes?utm_source=ark-os`, {
    method: "POST",
    headers: { "x-api-key": process.env.PASS2U_API_KEY!, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      backgroundColor: "rgb(33, 64, 45)",
      foregroundColor: "rgb(239, 239, 232)",
      labelColor: "rgb(169, 188, 174)",
      ...(pass.relevantDate ? { relevantDate: pass.relevantDate } : {}),
      fields: [
        field("holder", "NAME", pass.holder),
        field("what", "PASS", pass.what),
        field("when", "WHEN", pass.when),
        field("where", "WHERE", pass.where),
      ],
      barcode: { message: pass.url.slice(0, 255), altText: pass.code },
    }),
  });
  if (!res.ok) {
    console.error("Pass2U create failed", res.status, await res.text());
    return null;
  }
  const { passId } = (await res.json()) as { passId?: string };
  if (!passId) return null;

  const { error } = await admin.from("wallet_passes").insert({ kind, token, pass2u_id: passId });
  if (error?.code === "23505") {
    // A second tap raced this one; use the pass that got saved first.
    const { data: first } = await admin.from("wallet_passes").select("pass2u_id").eq("kind", kind).eq("token", token).maybeSingle();
    return link(first?.pass2u_id ?? passId);
  }
  if (error) console.error("Saving wallet pass failed", error);
  return link(passId);
}
