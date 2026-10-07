/* eslint-disable @next/next/no-img-element -- photos come from the main site's CDN */
import type { Metadata } from "next";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { getViewer } from "@/lib/auth";
import { dow, todayIn } from "@/lib/dates";
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
  ["La Cocineta", `${CDN}/attachments/b40591a5-f3cf-454e-a889-6452f787c45e.png`],
  ["Spa Deck", `${CDN}/attachments/30ca26f5-6138-400d-a687-4f9407f14783.jpg`],
  ["Cowork", `${CDN}/attachments/59d985a0-4c06-4c69-9e33-871246a2fb56.png`],
  ["Shala", `${CDN}/attachments/6805acf4-3f55-4ca6-bccd-a4c2c5f687f6.jpg`],
  ["Courts", `${CDN}/attachments/93923496-a0fc-4e93-a5ea-1a35f25bbe86.png`],
  ["Jungle Gym", `${CDN}/attachments/075ad673-4250-4832-9dd7-76c22c9eff32.jpg`],
] as const;

const WORLD = [
  ["The ARK Village", "Santa Teresa, Costa Rica", `${CDN}/assets/043187a9-4c3c-48c0-a8d5-e7f35145d7ce.png`],
  ["ARK Guesthouses", "Global member network", `${CDN}/assets/4c90b3bd-f7d1-43eb-9a3b-de3b5a06d99b.png`],
  ["ARK Expeditions", "Journeys worth traveling", `${CDN}/assets/534db0fb-18ab-441d-b9b3-2b45cd3cc53e.png`],
  ["Gatherings & Events", "Worldwide dinners & concerts", `${CDN}/assets/5743b66c-49cb-4b42-9413-eb07e223a750.png`],
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
    "Unlimited classes at the Shala, the Spa Deck, the Cowork, and the Jungle Gym, every day from 8am to 8pm. Courts are booked separately, at member rates.",
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
        <Link href="/ark-membership" aria-label="The ARK">
          <img src="/brand/ark-lockup-dark.png" alt="The ARK" height={34} />
        </Link>
        <nav>
          <a href="#spaces">The days</a>
          <a href="#schedule">Schedule</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <Link href="/courts">Courts</Link>
          <Link href="/portal/login" className="ms-btn small ms-login">
            Member log in
          </Link>
          <Link href={APPLY_URL} className="ms-btn small solid">
            Apply
          </Link>
        </nav>
      </header>

      <section className="ms-hero" style={{ backgroundImage: `url(${SPACES[5][1]})` }}>
        <div className="ms-hero-in">
          <p className="ms-eyebrow light">Santa Teresa · Costa Rica</p>
          <h1>Your dream days are here.</h1>
          <p className="ms-lede">
            Unlimited access to The ARK — cowork, spa deck, jungle gym, workshops, and classes —
            every day, 8am to 8pm.
          </p>
          <div className="ms-hero-ctas">
            <Link href={APPLY_URL} className="ms-btn solid">
              Apply for membership
            </Link>
            <a href={passUrl("day")} className="ms-btn light">
              Buy a pass
            </a>
          </div>
          <p className="ms-fine light">
            Memberships by invitation & application. Day and week passes, no application needed.
          </p>
        </div>
      </section>

      <section className="ms-sec" id="spaces">
        <div className="ms-split">
          <div>
            <p className="ms-eyebrow">Membership</p>
            <h2>
              Ordinary days,
              <br />
              <em>made extraordinary.</em>
            </h2>
          </div>
          <div className="ms-prose">
            <p>
              Morning yoga class at the Shala. Chef cooked breakfast followed by a deep work
              session. Pickleball game and sauna at sunset with incredible people.
            </p>
            <p>Nothing here is a special occasion. It’s just a Tuesday.</p>
            <p>
              Spaces built for movement, creativity, and nourishment, and a community that helps you
              grow in every part of your life.
            </p>
          </div>
        </div>
        <ul className="ms-spaces">
          {SPACES.map(([name, src]) => (
            <li key={name}>
              <img src={src} alt={name} loading="lazy" />
              <span>{name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ms-sec dark">
        <div className="ms-narrow">
          <h2>Membership is an invitation.</h2>
          <p>
            The ARK World is a curated, international community of creators, builders, and people
            who choose to live deliberately.
          </p>
          <p>
            This isn’t a gym membership, a coworking pass, or unlimited sauna. It’s a place in a
            living ecosystem, where people gather, grow, and create together.
          </p>
          <p>
            Membership isn’t given lightly. We choose members carefully, to protect the community
            already here and to make sure you find the people who will push your work and life
            forward. What you bring matters as much as what you receive.
          </p>
        </div>
      </section>

      <section className="ms-sec">
        <div className="ms-split">
          <h2>
            Your membership,
            <br />
            <em>worldwide.</em>
          </h2>
          <div className="ms-prose">
            <p>It begins in Santa Teresa, on a hill above the Pacific. It doesn’t end there.</p>
            <p>
              As ARK Guesthouses open in new countries, each one becomes a place you already belong.
              ARK Expeditions take the community to places worth the journey, with members first to
              board. And wherever you land, people from the network are already there, ready to open
              a door.
            </p>
            <p>One membership. A village that travels with you.</p>
          </div>
        </div>
        <ul className="ms-world">
          {WORLD.map(([name, sub, src]) => (
            <li key={name}>
              <img src={src} alt={name} loading="lazy" />
              <div>
                <h3>{name}</h3>
                <p>{sub}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="ms-sec tint" id="schedule">
        <p className="ms-eyebrow">Santa Teresa · Costa Rica</p>
        <h2>Member class schedule</h2>
        <p className="ms-fine">Included in your ARK membership. Schedule updates seasonally.</p>
        <Schedule
          classes={classes ?? []}
          today={dow(todayIn())}
        />
      </section>

      <section className="ms-sec" id="pricing">
        <p className="ms-eyebrow">Santa Teresa · Costa Rica</p>
        <h2>Choose your rhythm</h2>
        <p className="ms-prose">Find the right way to belong to The ARK.</p>
        <Pricing passPrices={passPrices} />
      </section>

      <section className="ms-sec tint">
        <div className="ms-split">
          <div>
            <p className="ms-eyebrow">Which one is right for you?</p>
            <h2>
              See what <em>you’d</em> spend.
            </h2>
            <p className="ms-prose">
              The calculator compares every pass and membership against how you plan to spend your
              time here.
            </p>
          </div>
          <Calculator />
        </div>
      </section>


      <section className="ms-sec" id="faq">
        <div className="ms-split">
          <div>
            <p className="ms-eyebrow">FAQ</p>
            <h2>Questions, answered.</h2>
          </div>
          <div className="ms-faq">
            {FAQ.map(([q, a]) => (
              <details key={q} name="faq">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="ms-foot">
        <img src="/brand/ark-mark-light.png" alt="" height={40} />
        <p>The ARK · Santa Teresa, Costa Rica</p>
        <p>
          <Link href="/portal/login">Member log in</Link>
        </p>
      </footer>
    </div>
  );
}
