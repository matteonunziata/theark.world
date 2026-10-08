import "server-only";

// Tilopay charge for a saved card ("Pay with account" at Checkout).
// Server-side only; keys come from env. Hidden until TILOPAY_ENABLED=1 and the
// credentials are set.
//
// NOT VERIFIED AGAINST TILOPAY'S DOCS: their public guides cover tokenizing a
// card but not the server-to-server charge. The endpoints below and the shape
// of the request are a placeholder to be checked against the Tilopay Postman
// docs (or soporte@tilopay.com) before turning the flag on. See OPEN_QUESTIONS.md.

const base = () => (process.env.TILOPAY_API_URL ?? "https://app.tilopay.com/api/v1").replace(/\/$/, "");

export const tilopayReady = () =>
  process.env.TILOPAY_ENABLED === "1" &&
  !!process.env.TILOPAY_API_USER &&
  !!process.env.TILOPAY_API_PASSWORD &&
  !!process.env.TILOPAY_API_KEY;

async function login(): Promise<string> {
  const res = await fetch(`${base()}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      apiuser: process.env.TILOPAY_API_USER,
      password: process.env.TILOPAY_API_PASSWORD,
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !json.access_token) throw new Error("Tilopay sign-in failed.");
  return json.access_token;
}

export type TilopayCharge =
  | { ok: true; transactionId: string }
  | { ok: false; error: string };

/** Charge `amount` colones to a saved card token. Nothing is recorded here. */
export async function chargeSavedCard(token: string, amount: number, orderRef: string): Promise<TilopayCharge> {
  if (!tilopayReady()) return { ok: false, error: "Pay with account isn’t set up yet." };
  try {
    const bearer = await login();
    const res = await fetch(`${base()}/processPaymentToken`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
      body: JSON.stringify({
        key: process.env.TILOPAY_API_KEY,
        amount: amount.toFixed(2),
        currency: "CRC",
        orderNumber: orderRef,
        card_token: token,
      }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      type?: string | number;
      message?: string;
      transaction_id?: string | number;
      orderNumber?: string;
    };
    // Tilopay reports an approved charge with type "100"; anything else is a decline.
    if (!res.ok || String(json.type) !== "100" || !json.transaction_id) {
      return { ok: false, error: json.message ? `Card declined: ${json.message}` : "The card was declined." };
    }
    return { ok: true, transactionId: String(json.transaction_id) };
  } catch {
    return { ok: false, error: "Couldn’t reach Tilopay. Nothing was charged." };
  }
}
