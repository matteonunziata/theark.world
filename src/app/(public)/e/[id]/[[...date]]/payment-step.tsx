"use client";

import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { useEffect, useRef, useState } from "react";
import { confirmTicketPayment, startTicketPayment } from "../../actions";

type Paid = "paid" | "pending" | "unknown";

/**
 * Stripe's payment form inside our own page. The booking already exists (held or
 * confirmed); this charges it. When the form says it's complete we record the payment
 * straight away, the same as the webhook would, and hand back what came of it.
 */
export function PaymentStep({ token, onPaid }: { token: string; onPaid: (state: Paid) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "ready"; amount: string; summary: string } | { kind: "recording" } | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    let checkout: StripeEmbeddedCheckout | null = null;
    (async () => {
      const start = await startTicketPayment(token);
      if (cancelled) return;
      if (!start.ok) return setState({ kind: "error", message: start.error });
      const stripe = await loadStripe(start.publishableKey);
      if (cancelled) return;
      if (!stripe) return setState({ kind: "error", message: "We couldn’t load the payment form. Check your connection and try again." });
      checkout = await stripe.createEmbeddedCheckoutPage({
        clientSecret: start.clientSecret,
        onComplete: async () => {
          setState({ kind: "recording" });
          const r = await confirmTicketPayment(start.sessionId);
          onPaid(r.state);
        },
      });
      if (cancelled) {
        checkout.destroy();
        return;
      }
      if (box.current) checkout.mount(box.current);
      setState({ kind: "ready", amount: start.amount, summary: start.summary });
    })().catch(() => !cancelled && setState({ kind: "error", message: "We couldn’t open the payment form. Nothing was charged." }));
    return () => {
      cancelled = true;
      checkout?.destroy();
    };
    // onPaid is a fresh function each render; the form must not restart because of that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div>
      {state.kind === "loading" && <p className="muted">Opening the payment form…</p>}
      {state.kind === "recording" && <p className="muted">Payment received. Confirming your booking…</p>}
      {state.kind === "error" && (
        <div className="form-error" role="alert">
          {state.message}
        </div>
      )}
      {state.kind === "ready" && (
        <p className="note" style={{ marginTop: 0 }}>
          {state.summary}: <b>{state.amount}</b>
        </p>
      )}
      <div ref={box} hidden={state.kind === "recording" || state.kind === "error"} />
    </div>
  );
}
