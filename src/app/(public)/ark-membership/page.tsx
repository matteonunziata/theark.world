/* eslint-disable @next/next/no-img-element -- photos come from the main site's CDN */
import type { Metadata } from "next";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { getViewer } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { passStripePrice, stripeReady } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { Calculator } from "./calculator";
import { APPLY_URL, passUrl } from "./plans";
import { Pricing } from "./pricing";
import { Schedule } from "./schedule";
import "./membership.css";

export const metadata: Metadata = {
  title: { absolute: "The ARK Membership — Santa Teresa, Costa Rica" },
  description:
    "Unlimited access to The ARK — cowork, spa deck, jungle gym, workshops and classes — every day, 8am to 8pm. By invitation and application.",
};

const CDN = "https://vibe.filesafe.space/1776339959982732737";

const SPACES = [
  ["La Cocineta", "Chef-cooked breakfast and lunch, every day.", `${CDN}/attachments/b40591a5-f3cf-454e-a889-6452f787c45e.png`],
  ["Space Deck", "Sauna and cold plunge at sunset.", `${CDN}/attachments/30ca26f5-6138-400d-a687-4f9407f14783.jpg`],
  ["ARK House", "Coworking and creation lounge.", `${CDN}/attachments/59d985a0-4c06-4c69-9e33-871246a2fb56.png`],
  ["Shala", "Yoga, Muay Thai, strength and breathwork, every day.", `${CDN}/attachments/6805acf4-3f55-4ca6-bccd-a4c2c5f687f6.jpg`],
  ["Courts", "Padel and pickleball: games, clinics and classes.", `${CDN}/attachments/93923496-a0fc-4e93-a5ea-1a35f25bbe86.png`],
  ["Jungle Gym", "Open-air training under the canopy.", `${CDN}/attachments/075ad673-4250-4832-9dd7-76c22c9eff32.jpg`],
] as const;

const DAY = [
  ["8:00", "Morning yoga / workout", "At the Shala"],
  ["9:00", "Breakfast", "La Cocineta"],
  ["10:00", "Deep work session", "ARK House"],
  ["12:00", "Lunch", "La Cocineta"],
  ["14:00", "Networking + business workshop", "ARK House"],
  ["16:00", "Pickleball game", "The Courts"],
  ["17:00", "Sauna, swim and plunge", "The Space Deck"],
] as const;

const WORLD = [
  ["Santa Teresa, Costa Rica", "The Village", "Where it starts. Open today."],
  ["Global member network", "Guesthouses", "Your global network of homes."],
  ["Journeys worth traveling", "Expeditions", "Members first to board."],
  ["Dinners & concerts", "Gatherings", "Dinners, concerts and gatherings."],
] as const;

const HOW = [
  ["Apply", "A short application: who you are, and what you’d bring to the community."],
  ["We read it personally", "Every application is reviewed by the team, and we’d like to meet you. A free day pass is emailed to you, so you can spend a day here."],
  ["Choose your rhythm", "Once invited, pick 1, 3, 6 or 12 months, and you’re in."],
] as const;

const FAQ = [
  [
    "What’s the difference between a pass and a membership?",
    "Day and Week passes give you full access for that period, and you can buy one instantly. Memberships of one month and longer add guest passes, member discounts, and members-only events, and begin with an application.",
  ],
  [
    "How do I apply?",
    "Send us an application, then meet someone from our team. Membership is curated, so every long-term member is someone we’ve gotten to know. Every application comes with a free day pass, emailed to you, so you can spend a day here while we get to know you.",
  ],
  [
    "What’s included?",
    "Unlimited classes at the Shala, the Space Deck, ARK House, and the Jungle Gym, every day from 8am to 8pm. Courts are booked separately, at member rates.",
  ],
  [
    "Can I bring guests?",
    "Yes. Month, 3-month, and 6-month members get 4 guest passes a month. Annual members get 8. Your guest arrives with you and stays with you. Passes reset monthly.",
  ],
  ["What about my kids?", "Under 10, free. From 10 to 16, half your rate. From 16, their own membership."],
  ["Is food included?", "No. La Cocineta and our cafés are paid separately. Members save on Farm products."],
  [
    "Can I stay overnight?",
    "Membership covers the day. To stay the night, book with ARK Hospitality. Membership is included for every night of your stay.",
  ],
  [
    "I own land at The ARK. Am I a member?",
    "Land and membership are separate. Stewards choose their membership, with a discount based on when they joined The ARK.",
  ],
  [
    "Is there a Costa Rican discount?",
    "Yes. Costa Rican nationals receive a dedicated discount on every pass and membership.",
  ],
  [
    "Can I cancel?",
    "Monthly memberships renew automatically. Cancel at least 7 days before your renewal date. Passes and longer memberships are paid upfront and are non-refundable.",
  ],
] as const;

export default async function MembershipPage() {
  const { supabase } = await getViewer();
  const { data: classes } = await supabase.rpc("public_class_schedule");
  // Day and week passes show the price of their Stripe product.
  const passPrices: Record<string, { amount: number; currency: string }> = {};
  const admin = createAdminClient();
  if (admin && stripeReady()) {
    const { data: tiers } = await admin
      .from("membership_tiers")
      .select("key, name, price, currency, stripe_price_id")
      .in("key", ["day", "week"]);
    await Promise.all(
      (tiers ?? []).map(async (t) => {
        const sp = await passStripePrice(admin, t).catch(() => null);
        if (sp && sp.amount > 0) passPrices[t.key] = sp;
      }),
    );
  }

  return (
    <div className="mship">
      <ArkFonts />

      <header className="ms-nav">
        <Link href="/ark-membership" aria-label="The ARK home">
          <img src="/brand/ark-lockup-dark.png" alt="The ARK" height={40} />
        </Link>
        <div className="ms-nav-links">
          <a href="#days">The days</a>
          <a href="#spaces">Spaces</a>
          <a href="#schedule">Schedule</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <Link href="/courts">Courts</Link>
        </div>
        <div className="ms-nav-end">
          <Link href="/portal/login" className="ms-login">
            Member log in
          </Link>
          <Link href={APPLY_URL} className="ms-btn small solid">
            Apply
          </Link>
        </div>
      </header>

      <section className="ms-hero" id="top">
        <div className="ms-hero-in">
          <p className="ms-eyebrow light">Santa Teresa · Costa Rica</p>
          <h1>Your dream days are here.</h1>
          <p className="ms-lede">
            Unlimited access to The ARK: cowork, spa deck, jungle gym, workshops and classes, every
            day, 8am to 8pm.
          </p>
          <div className="ms-hero-cards">
            <div className="ms-hero-card pale">
              <p className="ms-kick">Live here, or come often</p>
              <h2>Become a member</h2>
              <Link href={APPLY_URL} className="ms-btn solid">
                Apply for membership
              </Link>
            </div>
            <div className="ms-hero-card line">
              <p className="ms-kick">Just passing through</p>
              <h2>Buy a pass</h2>
              <a href={passUrl("day")} className="ms-btn light">
                See passes
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="ms-sec" id="days">
        <div className="ms-in">
          <div className="ms-head">
            <div>
              <p className="ms-eyebrow">A day at The ARK</p>
              <h2>Ordinary days, made extraordinary.</h2>
            </div>
          </div>
          <ol className="ms-day">
            {DAY.map(([t, name, where]) => (
              <li key={t}>
                <span className="t">{t}</span>
                <b>{name}</b>
                <span className="w">{where}</span>
              </li>
            ))}
            <li className="sun">
              <span className="t">Sunset</span>
              <b>Farm to table dinner</b>
              <span className="w">La Cocineta</span>
            </li>
          </ol>
        </div>
      </section>

      <section className="ms-sec" id="spaces" style={{ paddingTop: 0 }}>
        <div className="ms-in" style={{ gap: 40 }}>
          <div>
            <p className="ms-eyebrow">The spaces</p>
            <h2>Six spaces, one membership.</h2>
          </div>
          <ul className="ms-spaces">
            {SPACES.map(([name, line, src]) => (
              <li key={name}>
                <div className="ph">
                  <img src={src} alt={name} loading="lazy" />
                </div>
                <h3>{name}</h3>
                <p>{line}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ms-sec tint" id="schedule">
        <div className="ms-in">
          <div className="ms-cols">
            <div className="ms-side">
              <p className="ms-eyebrow">This week at The ARK</p>
              <h2>Every class is included.</h2>
              <p className="ms-prose">
                Muay Thai, yoga, strength, breathwork, circles and more are part of your membership or pass.
                Pick a class, then choose how to join. The schedule updates seasonally.
              </p>
            </div>
            <div className="ms-main">
              <Schedule classes={classes ?? []} today={todayIn()} />
            </div>
          </div>
        </div>
      </section>

      <section className="ms-sec dark">
        <div className="ms-in">
          <div className="ms-invite">
            <div>
              <p className="ms-eyebrow light">Membership is an invitation</p>
              <h2>Not a gym pass. A place in a living ecosystem.</h2>
              <p>
                The ARK World is a curated, international community of creators, builders and people who
                choose to live deliberately, where people gather, grow and create together.
              </p>
              <p>
                We choose members carefully, to protect the community already here and to make sure you find
                the people who will push your work and life forward. What you bring matters as much as what
                you receive.
              </p>
            </div>
            <div>
              <h3 className="ms-steps-h">How to join</h3>
              <ol className="ms-how">
                {HOW.map(([title, body], i) => (
                  <li key={title}>
                    <span className="n">{i + 1}</span>
                    <div>
                      <strong>{title}</strong>
                      <span>{body}</span>
                    </div>
                  </li>
                ))}
              </ol>
              <Link href={APPLY_URL} className="ms-btn gold">
                Start your application
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="ms-sec">
        <div className="ms-in">
          <div className="ms-head">
            <div>
              <p className="ms-eyebrow">Your membership, worldwide</p>
              <h2>One membership. A village that travels with you.</h2>
            </div>
            <p>
              It begins in Santa Teresa, on a hill above the Pacific. As ARK Guesthouses open in new
              countries, each one becomes a place you already belong.
            </p>
          </div>
          <ul className="ms-world">
            {WORLD.map(([kicker, name, line], i) => (
              <li key={name} className={i === 0 ? "here" : undefined}>
                <span className="k">{kicker}</span>
                <b>{name}</b>
                <span className="d">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ms-sec white" id="pricing">
        <div className="ms-in">
          <Pricing passPrices={passPrices} />
        </div>
      </section>

      <section className="ms-sec" id="calculator">
        <div className="ms-in">
          <Calculator />
        </div>
      </section>

      <section className="ms-sec" id="faq" style={{ paddingTop: 0 }}>
        <div className="ms-in">
          <div className="ms-cols">
            <div className="ms-side">
              <p className="ms-eyebrow">FAQ</p>
              <h2>Questions, answered.</h2>
            </div>
            <div className="ms-main ms-faq">
              {FAQ.map(([q, a]) => (
                <details key={q} name="faq">
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="ms-foot">
        <div className="ms-foot-in">
          <div className="ms-foot-cta">
            <h2>Ready for your dream days?</h2>
            <div>
              <Link href={APPLY_URL} className="ms-btn gold">
                Apply for membership
              </Link>
              <a href={passUrl("day")} className="ms-btn light">
                Buy a day pass
              </a>
            </div>
          </div>
          <div className="ms-foot-bar">
            <span>
              <img src="/brand/ark-lockup-light.png" alt="The ARK" height={32} /> Santa Teresa, Costa Rica
            </span>
            <nav>
              <Link href="/courts">Courts</Link>
              <Link href="/portal/login">Member log in</Link>
              <a href="#faq">FAQ</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
