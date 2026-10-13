import type { PublicLot } from "@/lib/public-lots";
import type { Home } from "./homes-data";

/** A home's status and asking price. The real estate inventory wins when the lot is listed there; the live site's copy fills the gaps. */
export function resolveHome(home: Home, lots: PublicLot[]) {
  const lot = lots.find((l) => l.code === home.lot);
  const sold = lot ? lot.status !== "available" : home.liveStatus === "SOLD";
  const price = lot?.status === "available" && lot.price ? `$${Number(lot.price).toLocaleString("en-US")}` : home.livePrice;
  return { sold, price };
}
