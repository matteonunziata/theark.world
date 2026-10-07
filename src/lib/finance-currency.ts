import "server-only";
import { cookies } from "next/headers";
import type { Conv } from "@/lib/finance";
import type { createClient } from "@/lib/supabase/server";

export const FINANCE_CURRENCY_COOKIE = "finance_cur";

/** The currency Finance is being viewed in (cookie, else the org's main one) and the rate. */
export async function getFinanceView(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const [{ data: org }, store] = await Promise.all([
    supabase.from("org_settings").select("currency, usd_crc_rate").maybeSingle(),
    cookies(),
  ]);
  const base: Conv["to"] = org?.currency === "USD" ? "USD" : "CRC";
  const saved = store.get(FINANCE_CURRENCY_COOKIE)?.value;
  const conv: Conv = {
    to: saved === "USD" || saved === "CRC" ? saved : base,
    rate: Number(org?.usd_crc_rate) > 0 ? Number(org?.usd_crc_rate) : 500,
  };
  return { conv, base };
}
