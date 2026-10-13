import type { Metadata } from "next";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { SHOP_URL } from "@/lib/farm-catalog";
import { stripeReady } from "@/lib/stripe";
import { FarmShop, type Group } from "./farm-shop";
import "./farm-shop.css";

export const metadata: Metadata = {
  title: { absolute: "Farm shop — The ARK, Santa Teresa" },
  description:
    "Food, drink and goods from the farm and the people we trust, in Santa Teresa, Costa Rica. Order and pay online, then pick up at The ARK. No account needed.",
};

export default async function FarmShopPage({ searchParams }: PageProps<"/farm-shop">) {
  const { paid } = await searchParams;
  const { supabase, memberId, staff } = await getViewer();
  const [{ data: rows }, { data: pct }, { data: me }] = await Promise.all([
    supabase.rpc("public_shop_catalog"),
    memberId ? supabase.rpc("my_shop_discount") : Promise.resolve({ data: 0 }),
    memberId ? supabase.rpc("my_member_profile").maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const percent = Number(pct) || 0;

  // One card per product, with its sizes or flavours as options.
  const groups = new Map<string, Group>();
  for (const r of rows ?? []) {
    const key = `${r.category}|${r.product_group}`;
    const g =
      groups.get(key) ??
      ({ key, name: r.product_group, category: r.category, image: r.image_url, description: r.description, options: [] } satisfies Group);
    g.options.push({ id: r.external_id, label: r.variant, price: Number(r.price) });
    g.image ??= r.image_url;
    groups.set(key, g);
  }

  return (
    <main className="fs">
      <ArkFonts />
      <header className="fs-nav">
        <Link href="/farm-shop" aria-label="The ARK Farm shop">
          <Logo tone="dark" height={36} />
        </Link>
        <div className="links">
          <a href="#shop">Shop</a>
          <a href="#members">Member prices</a>
          <a href="#pickup">Pick up</a>
        </div>
        <div className="right">
          {memberId ? (
            <Link href="/portal/shop" className="btn sm solid">Members portal</Link>
          ) : staff ? (
            <Link href="/shop" className="btn sm solid">Staff view</Link>
          ) : (
            <>
              <Link href="/portal/login?next=/farm-shop" className="login">Member sign in</Link>
              <Link href="/ark-membership" className="btn sm solid">Membership</Link>
            </>
          )}
        </div>
      </header>

      <section className="fs-hero dark">
        <div className="wrap">
          <p className="eyebrow">The ARK · Santa Teresa</p>
          <h1>Farm shop</h1>
          <p className="lede">
            From the farm and the people we trust. Order here, pay by card, and pick up at The ARK. You don’t need an
            account.
          </p>
          <div className="btn-row">
            <a href="#shop" className="btn gold">Shop now</a>
            {!memberId && <a href="#members" className="btn ghost-light">Member prices</a>}
          </div>
        </div>
      </section>

      <section className="fs-sec" id="shop">
        <div className="wrap">
          <div className="fs-sec-h">
            <div>
              <p className="eyebrow">Shop</p>
              <h2>What’s in the shop</h2>
            </div>
            <p className="muted">
              {memberId && percent > 0
                ? `Signed in as ${me?.name ?? "a member"}. Your member price is ${percent}% off, applied at checkout.`
                : "Prices in colones. Add what you’d like and check out as a guest."}
            </p>
          </div>
          <FarmShop
            groups={[...groups.values()]}
            percent={percent}
            member={memberId ? { name: me?.name ?? "", email: me?.email ?? "" } : null}
            payReady={stripeReady()}
            shopUrl={SHOP_URL}
            justPaid={paid === "1"}
          />
        </div>
      </section>

      {!memberId && (
        <section className="fs-sec panel" id="members">
          <div className="wrap">
            <div className="fs-sec-h">
              <div>
                <p className="eyebrow">Members</p>
                <h2>Members pay less</h2>
              </div>
              <p className="muted">
                Anyone can shop here. If you’re a member, sign in and your discount is taken off every price
                automatically.
              </p>
            </div>
            <div className="fs-tiers">
              <div className="fs-tier">
                <span className="pct">10%</span>
                <h3>1, 3 and 6 months</h3>
                <p>Off everything in the Farm shop, for as long as your membership runs.</p>
              </div>
              <div className="fs-tier feat">
                <span className="pct">20%</span>
                <h3>Annual</h3>
                <p>Our best rate on the Farm shop, along with eight guest passes a month.</p>
              </div>
              <div className="fs-tier">
                <span className="pct">Also</span>
                <h3>Courts and events</h3>
                <p>The same member savings apply to padel and pickleball, and to events.</p>
              </div>
            </div>
            <div className="btn-row">
              <Link href="/portal/login?next=/farm-shop" className="btn solid">I’m a member: sign in</Link>
              <Link href="/ark-membership" className="btn">See memberships</Link>
            </div>
            <p className="fs-fine">Day and week passes don’t include the shop discount.</p>
          </div>
        </section>
      )}

      <section className="fs-sec" id="pickup">
        <div className="wrap">
          <div className="fs-sec-h">
            <div>
              <p className="eyebrow">Pick up</p>
              <h2>How it works</h2>
            </div>
          </div>
          <ol className="fs-steps">
            <li><span className="num">1</span><strong>Choose</strong><span>Add what you like to your basket.</span></li>
            <li><span className="num">2</span><strong>Pay by card</strong><span>Your name and email, then Stripe’s secure page. We email your receipt.</span></li>
            <li><span className="num">3</span><strong>Collect</strong><span>Pick your order up at The ARK in Santa Teresa. We’ll have it ready.</span></li>
          </ol>
        </div>
      </section>

      <footer className="fs-foot dark">
        <div className="wrap">
          <span className="brand">
            <Logo tone="light" kind="mark" height={32} /> The ARK · Santa Teresa, Costa Rica
          </span>
          <div className="links">
            <Link href="/ark-membership">Membership</Link>
            <Link href="/courts">Courts</Link>
            <Link href="/stay">Stay</Link>
            <Link href="/portal/login?next=/farm-shop">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
