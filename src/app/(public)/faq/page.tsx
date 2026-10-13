import type { Metadata } from "next";
import { Faq, SiteHero, SiteShell } from "../site/site-shell";
import { FAQ_GROUPS, FAQ_INTRO } from "./faq-data";

export const metadata: Metadata = {
  title: { absolute: "Frequently asked questions — The ARK, Santa Teresa" },
  description:
    "Living, investing and staying at The ARK in Santa Teresa, Costa Rica: the village, the community, ownership and the law, building, pricing and rentals.",
};

export default function FaqPage() {
  return (
    <SiteShell here="/faq">
      <SiteHero eyebrow="The ARK · Santa Teresa" title="Frequently Asked Questions" sub={FAQ_INTRO} />
      <section className="sec">
        <div className="wrap">
          {FAQ_GROUPS.map(([title, items]) => (
            <div key={title} className="faq-group">
              <h2>{title}</h2>
              <Faq items={items} name={title} />
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
