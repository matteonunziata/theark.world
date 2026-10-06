/** Passes and memberships as listed on theark.world/ark-membership. */
export type Plan = {
  key: string;
  name: string;
  price: number; // colones
  days: number; // days of access, for the per-day price
  perks: string[];
  kind: "pass" | "membership";
  badge?: string;
  discount: number; // % off courts, events & Farm products
  guests: number; // guest passes a month
  payLink?: string; // passes are bought straight away
  note?: string;
};

/** Memberships start with an application; passes go straight to payment. */
export const APPLY_URL = "/ark-membership/apply";
export const planHref = (p: Plan) => p.payLink ?? `${APPLY_URL}?plan=${p.key}`;

export const PLANS: Plan[] = [
  {
    key: "day",
    name: "Day Pass",
    price: 20_000,
    days: 1,
    kind: "pass",
    discount: 0,
    guests: 0,
    payLink: "https://links.mightysales.io/payment-link/6ab163b79f7ff2c808a76c62",
    perks: ["Full access, 8am to 8pm", "Shala classes", "The Spa Deck", "The ARK House coworking"],
  },
  {
    key: "week",
    name: "Week Pass",
    price: 50_000,
    days: 7,
    kind: "pass",
    discount: 0,
    guests: 0,
    payLink: "https://links.mightysales.io/payment-link/6ab16d3ef426560dbc2f174b",
    perks: ["Everything in the Day Pass", "Valid for seven days"],
  },
  {
    key: "month",
    name: "1 Month",
    price: 130_000,
    days: 30,
    kind: "membership",
    discount: 10,
    guests: 4,
    note: "Starts with a day pass, so you can see if it’s a good fit.",
    perks: ["Full access", "10% off courts, events & Farm products", "4 guest passes"],
  },
  {
    key: "quarter",
    name: "3 Months",
    price: 340_000,
    days: 90,
    kind: "membership",
    badge: "Most popular",
    discount: 10,
    guests: 4,
    perks: ["Full access", "10% off courts, events & Farm products", "4 guest passes a month"],
  },
  {
    key: "half",
    name: "6 Months",
    price: 630_000,
    days: 180,
    kind: "membership",
    discount: 10,
    guests: 4,
    perks: ["Full access", "10% off courts, events & Farm products", "4 guest passes a month"],
  },
  {
    key: "year",
    name: "Annual",
    price: 1_100_000,
    days: 365,
    kind: "membership",
    badge: "Best value",
    discount: 20,
    guests: 8,
    perks: [
      "Full access",
      "20% off courts, events & Farm products",
      "8 guest passes a month",
      "Preferential Arkadia pricing",
    ],
  },
];

/** Approximate colones per dollar, for the USD view only. Checkout is in colones. */
export const CRC_PER_USD = 505;

export function money(crc: number, currency: "CRC" | "USD") {
  return currency === "CRC"
    ? `₡${Math.round(crc).toLocaleString("en-US")}`
    : `$${Math.round(crc / CRC_PER_USD).toLocaleString("en-US")}`;
}

/**
 * What a stay costs on each plan, in colones: the cheapest mix of that plan
 * (or passes for the leftovers), plus guests over the allowance at the day
 * rate, minus member savings on courts, events and Farm products.
 */
export function stayCost(
  plan: Plan,
  { weeks, daysPerWeek, guestsPerMonth, extrasPerMonth }: {
    weeks: number;
    daysPerWeek: number;
    guestsPerMonth: number;
    extrasPerMonth: number;
  },
) {
  const months = weeks / (52 / 12);
  const visits = weeks * daysPerWeek;
  let access: number;
  if (plan.key === "day") access = visits * plan.price;
  else if (plan.key === "week") access = weeks * plan.price;
  else {
    const planMonths = Math.round(plan.days / 30.4);
    access = Math.max(1, Math.ceil(months / planMonths - 0.01)) * plan.price;
  }
  const extraGuests = Math.max(0, guestsPerMonth - plan.guests) * months;
  const guests = extraGuests * 20_000;
  const savings = (extrasPerMonth * months * plan.discount) / 100;
  return { total: access + guests - savings, access, guests, savings };
}
