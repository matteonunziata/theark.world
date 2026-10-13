import type { Metadata } from "next";
import { usdRates } from "@/lib/fx";
import { loadPublicLots } from "@/lib/public-lots";
import { SectionHead, SiteHero, SiteShell } from "../site/site-shell";
import { LotExplorer } from "./lot-explorer";

export const metadata: Metadata = {
  title: { absolute: "Live lot prices — The ARK, Santa Teresa" },
  description:
    "Every lot, estate and fractional share still available at The ARK in Santa Teresa, Costa Rica, with its size and live price in six currencies.",
};

// Prices are read from the real estate inventory on every visit.
export const dynamic = "force-dynamic";

export default async function LiveLotPricesPage() {
  const [lots, rates] = await Promise.all([loadPublicLots(), usdRates()]);
  return (
    <SiteShell here="/live-lot-prices">
      <SiteHero
        eyebrow="The ARK · Santa Teresa"
        title="The ARK Live Lot Prices"
        sub="Click or hover on any lot in the interactive map or inventory table below to highlight its location, size, and real-time live valuation."
      />
      <section className="sec">
        <div className="wrap">
          <SectionHead title="Interactive Master Plan Map">Select a lot marker to reveal live pricing and estate specifications.</SectionHead>
          <LotExplorer lots={lots} rates={rates} />
        </div>
      </section>
    </SiteShell>
  );
}
