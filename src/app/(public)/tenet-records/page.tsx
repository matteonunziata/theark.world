import type { Metadata } from "next";
import { SectionHead, SiteHero, SiteShell } from "../site/site-shell";

export const metadata: Metadata = {
  title: { absolute: "TENET Records — The ARK, Santa Teresa" },
  description:
    "A purpose-built analog recording studio inside The ARK in Santa Teresa, Costa Rica, designed with Grammy-winning engineer Russell Elevado. Residencies from four days to three months.",
};

const BOOK = "https://tenetrecords.com/";
const IMG = "/site/tenet-records";

const FACTS = [
  ["Location", "Pacific Coast, Costa Rica"],
  ["Residencies", "4 days to 3+ months"],
  ["Accommodation", "On-site at The ARK"],
  ["Included", "Nature · Wellness · Farm · Community"],
] as const;

const SPECS = [
  ["Total area", "574 m² / ~6,000 sq ft"],
  ["Live room", "Conical with skylight oculus"],
  ["Isolation booths", "4 dedicated ISO booths"],
  ["Signal path", "Analog-first, hybrid workflow"],
  ["Primary console", "Neve 8068"],
] as const;

const PEOPLE = [
  {
    name: "Russell Elevado",
    badge: "✦ Grammy award winner",
    role: "Producer · Engineer · Mixer",
    img: "russell-elevado-1aaff6",
    bio: "Widely recognized as a primary architect of the Neo-Soul sound, his exclusive preference for analog processing and production techniques sets him apart from most of his peers. Over four decades he has worked with artists such as D'Angelo, Jon Batiste, Angélique Kidjo, Alicia Keys, and Erykah Badu.",
  },
  {
    name: "Jeff Claeys",
    badge: "✦ 500+ released tracks",
    role: "Musician · Producer · Engineer",
    img: "jeff-claeys-c40312",
    bio: "A Belgian producer, sound engineer, and multi-instrumentalist with over 30 years of international experience. He established his studio in Santa Teresa in 2016. He has engineered and composed for Netflix, FIFA, and international television, and runs the day-to-day of TENET as its resident engineer.",
  },
] as const;

const PROJECTS = [
  ["Voodoo", "D'Angelo", "Russell Elevado", "voodoo-709ddd"],
  ["Fearless Movement", "Kamasi Washington", "Russell Elevado", "fearless-movement-b3cf2b"],
  ["Mama's Gun", "Erykah Badu", "Russell Elevado", "mama-s-gun-6a4e1c"],
  ["Live at Montreux", "Various", "Jeff Claeys", "live-at-montreux-64ab7f"],
  ["Songs in A Minor", "Alicia Keys", "Russell Elevado", "songs-in-a-minor-f4c2c7"],
  ["Hard Groove", "The RH Factor", "Russell Elevado", "hard-groove-d4cf69"],
] as const;

export default function TenetPage() {
  return (
    <SiteShell here="/tenet-records">
      <SiteHero eyebrow="The space defines the sound" title="TENET Records" image={`${IMG}/aerial-19a4f9.webp`}>
        <a className="btn btn-accent" href={BOOK} target="_blank" rel="noreferrer">Book a session</a>
      </SiteHero>

      <section className="sec split">
        <div className="wrap">
          <div className="split-copy">
            <h2>Silence. Nature. Time. The rarest studio amenities.</h2>
            <p>
              TENET is built inside The ARK, a regenerative settlement on the Pacific coast of Costa Rica. Santa Teresa is
              not a backdrop. It is a creative condition.
            </p>
            <p>
              When you come to TENET, the jungle, the ocean, and the quiet they slow everything down. Free yourself from
              distractions and focus on creativity.
            </p>
          </div>
          <div className="cards two" style={{ flex: "999 1 520px" }}>
            {FACTS.map(([k, v]) => (
              <div key={k} className="card">
                <span className="eyebrow">{k}</span>
                <p>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec panel">
        <div className="wrap">
          <SectionHead eyebrow="The engineers" title="5 Grammy Awards. Forty years of craft." />
          <div className="cards">
            {PEOPLE.map((p) => (
              <article key={p.name} className="pcard card" style={{ padding: 0, overflow: "hidden", gap: 0 }}>
                <div className="ph" style={{ borderRadius: 0, height: 300 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG}/${p.img}.webp`} alt={p.name} loading="lazy" />
                  <span className="tag">{p.badge}</span>
                </div>
                <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 10 }}>
                  <h3>{p.name}</h3>
                  <span className="meta">{p.role}</span>
                  <p>{p.bio}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sec split flip">
        <div className="wrap">
          <div className="split-copy">
            <p className="eyebrow">The studio</p>
            <h2>Purpose-built. Opening soon.</h2>
            <p>
              TENET is a purpose-built circular studio of approximately 574 square meters, designed from the ground up in
              direct collaboration with Russell Elevado.
            </p>
            <p>
              A conical live room. A central skylight oculus. Two control rooms both facing into the main live room with
              four isolation booths capable of simultaneous sessions. The studio is focused on the highest quality and
              standards of analog recording.
            </p>
            <a className="btn btn-primary" href={BOOK} target="_blank" rel="noreferrer">Book a session</a>
          </div>
          <div className="split-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG}/studio-render-8173e7.webp`} alt="Studio Render" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="sec white">
        <div className="wrap">
          <SectionHead title="Studio specifications" />
          <div className="cards">
            {SPECS.map(([k, v]) => (
              <div key={k} className="card">
                <span className="eyebrow">{k}</span>
                <h3>{v}</h3>
              </div>
            ))}
          </div>
          <div className="gallery">
            {(
              [
                ["live-room-4d704a", "Live Room"],
                ["control-room-16852f", "Control Room"],
                ["iso-booth-0e4468", "ISO Booth"],
              ] as const
            ).map(([f, alt]) => (
              <div key={f} className="g">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/${f}.webp`} alt={alt} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <SectionHead title="Selected Projects" />
          <div className="pcards">
            {PROJECTS.map(([title, artist, by, img]) => (
              <article key={title} className="pcard">
                <div className="ph" style={{ height: "auto", aspectRatio: "1 / 1" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG}/${img}.webp`} alt={title} loading="lazy" />
                </div>
                <h3>{title}</h3>
                <p>{artist}</p>
                <span className="specs">{by}</span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
