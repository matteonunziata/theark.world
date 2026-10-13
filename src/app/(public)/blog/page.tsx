import type { Metadata } from "next";
import { SiteHero, SiteShell } from "../site/site-shell";
import { BLOG_HERO, POSTS } from "./blog-data";

export const metadata: Metadata = {
  title: { absolute: "Blog — The ARK, Santa Teresa" },
  description:
    "Writing on Costa Rica real estate, regenerative housing, village life and wellness communities, from The ARK in Santa Teresa.",
};

export default function BlogPage() {
  return (
    <SiteShell here="/blog">
      <SiteHero eyebrow="The ARK · Santa Teresa" title="The ARK Blog" image={`/site/blog/${BLOG_HERO}`} />
      <section className="sec">
        <div className="wrap">
          <div className="pcards articles">
            {POSTS.map(([title, summary, date, image]) => (
              <article key={title} className="pcard">
                <div className="ph">
                  {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/site/blog/${image}`} alt={title} loading="lazy" />
                  )}
                  <span className="tag">{date}</span>
                </div>
                <h3>{title}</h3>
                <p>{summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
