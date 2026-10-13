import type { Metadata } from "next";
import { SectionHead, SiteHero, SiteShell } from "../site/site-shell";
import { FOUNDER_SECTIONS, PODCASTS_INTRO } from "./founder-data";

export const metadata: Metadata = {
  title: { absolute: "Marat Omarov, founder — The ARK, Santa Teresa" },
  description:
    "Marat Omarov founded The ARK, a regenerative village on the Pacific coast of Costa Rica. His story, and conversations about the vision behind it.",
};

const VIDEOS = ["TuGb9duW168", "FejcVGKSNlQ", "6XTUxVfTomQ", "NbLjTySxnhE", "CXXnkbsksnE", "ePNbU7DKlRs"] as const;

export default function FounderPage() {
  return (
    <SiteShell here="/founder-bio">
      <SiteHero eyebrow="The ARK · Santa Teresa" title="Founder" image="/site/founder-bio/450ca2ec.webp" />
      <section className="sec">
        <div className="wrap">
          <div className="prose-wrap">
            <div className="portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/site/founder-bio/6e9cf9ac.webp" alt="Marat Omarov" loading="lazy" />
            </div>
            <div className="prose">
              <h2>Marat Omarov</h2>
              {FOUNDER_SECTIONS.map(([title, paragraphs], i) => (
                <div key={title ?? i} style={{ display: "contents" }}>
                  {title && <h3>{title}</h3>}
                  {paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              ))}
              <p>
                <a href="https://instagram.com/marat.omarov.unofficial" target="_blank" rel="noreferrer">
                  @marat.omarov.unofficial
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="sec panel">
        <div className="wrap">
          <SectionHead title="Conversations & Podcasts">{PODCASTS_INTRO}</SectionHead>
          <div className="embeds">
            {VIDEOS.map((id) => (
              <div key={id} className="embed">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${id}`}
                  title="Marat Omarov in conversation"
                  loading="lazy"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
