// Turns a past Stripe charge into what ARK OS keeps: which business line it
// belongs to, a Finance category, and the Costa Rica calendar day it was paid.
// The line is a best guess from the charge's description; staff can move an
// entry in Finance. Kept free of server code so it can be unit tested.

export type Guess = { line: string; category: string | null };

const RULES: [RegExp, Guess][] = [
  [/\b(court|padel|pickle ?ball|tennis)\b/i, { line: "Courts", category: "Court time" }],
  [/\b(day pass|week pass|pass|membership|member|monthly|annual|founding|ambassador)\b/i, { line: "Memberships", category: "Membership dues" }],
  [/\b(breakfast|lunch|dinner|brunch|meal|food|caf[eé]|coffee|smoothie|drink)\b/i, { line: "Food & beverage", category: "Food & drink" }],
  [/\b(farm|shop|produce|honey|eggs|vegetables?|box)\b/i, { line: "Farm shop", category: "Shop sales" }],
  [/\b(arkadia|school|tuition|enrol(l)?ment)\b/i, { line: "Arkadia", category: "Tuition" }],
  [/\b(ticket|event|class|workshop|retreat|yoga|ceremony|circle|breathwork|sound bath|course|session)\b/i, { line: "Events & experiences", category: "Tickets" }],
  [/\b(lot|land|reservation deposit|rent|rental|stay|villa|night)\b/i, { line: "Real estate", category: null }],
];

export function guessLine(text: string | null | undefined): Guess {
  const t = (text ?? "").trim();
  for (const [re, g] of RULES) if (re.test(t)) return g;
  return { line: "Other", category: null };
}

/** The calendar day in Costa Rica for a Stripe timestamp (seconds). */
export function crDay(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
}

export const IMPORTABLE = new Set(["usd", "crc"]);
