import { createAdminClient } from "@/lib/supabase/admin";

export const CURRENCIES = ["USD", "CRC", "EUR", "CAD", "CHF", "ILS"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Used when the rates service can't be reached. Roughly right, never exact.
const FALLBACK: Record<Currency, number> = { USD: 1, CRC: 505, EUR: 0.92, CAD: 1.37, CHF: 0.88, ILS: 3.7 };

/**
 * Units of each currency per US dollar, for showing prices. Colones use the rate set in Settings → Organization
 * (the one Finance uses); the others come from a public rates feed, cached for an hour.
 */
export async function usdRates(): Promise<Record<Currency, number>> {
  const rates = { ...FALLBACK };
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = (await res.json()) as { rates?: Record<string, number> };
      for (const c of CURRENCIES) if (json.rates?.[c] && json.rates[c] > 0) rates[c] = json.rates[c];
    }
  } catch {
    // keep the fallback rates
  }
  try {
    const admin = createAdminClient();
    const { data } = admin ? await admin.from("org_settings").select("usd_crc_rate").maybeSingle() : { data: null };
    if (Number(data?.usd_crc_rate) > 0) rates.CRC = Number(data!.usd_crc_rate);
  } catch {
    // keep the feed's rate
  }
  rates.USD = 1;
  return rates;
}
