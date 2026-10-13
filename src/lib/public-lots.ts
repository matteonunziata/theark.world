import { createClient } from "@/lib/supabase/server";

export type PublicLot = {
  code: string;
  name: string | null;
  kind: string;
  status: string;
  size_m2: number | null;
  price: number | null;
  currency: string;
  features: string | null;
  estate_code: string | null;
};

/** The real estate inventory as the public site may see it (see public_lots() in the database). */
export async function loadPublicLots(): Promise<PublicLot[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_lots");
  return (data ?? []) as PublicLot[];
}

/** Titled lots still for sale: plain lots, not the named homes, estates or fractional shares. */
export const titledLotsLeft = (lots: PublicLot[]) =>
  lots.filter((l) => l.kind === "lot" && l.status === "available" && !l.name).length;
