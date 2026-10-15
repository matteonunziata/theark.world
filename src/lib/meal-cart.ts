"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/** One meal on one day in the cart. Nothing is reserved until checkout. */
export type CartLine = {
  offeringId: string;
  offeringTitle: string;
  time: string;
  date: string;
  ticketTypeId: string;
  ticketName: string;
  price: number;
  currency: string;
  qty: number;
};

const KEY = "ark-meal-cart";
const EVENT = "ark-meal-cart-change";
const EMPTY = "[]";

const read = () => {
  try {
    return window.localStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
};
// Without storage (a private window), the cart still works until the page closes.
let fallback = EMPTY;
let useFallback = false;
const snapshot = () => (useFallback ? fallback : read());

const write = (lines: CartLine[]) => {
  const raw = JSON.stringify(lines);
  try {
    window.localStorage.setItem(KEY, raw);
    useFallback = false;
  } catch {
    fallback = raw;
    useFallback = true;
  }
  window.dispatchEvent(new Event(EVENT));
};

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
};

export const lineKey = (l: Pick<CartLine, "offeringId" | "date" | "ticketTypeId">) =>
  `${l.offeringId}|${l.date}|${l.ticketTypeId}`;

/** The meal cart: shared by breakfast and lunch, on the public pages and in the portal. */
export function useMealCart() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const lines = useMemo<CartLine[]>(() => {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }, [raw]);
  /** Adds meals; the same meal on the same day adds to what is there. */
  const add = useCallback(
    (line: CartLine) => {
      const next = [...lines];
      const i = next.findIndex((l) => lineKey(l) === lineKey(line));
      if (i >= 0) next[i] = { ...next[i], qty: next[i].qty + line.qty };
      else next.push(line);
      next.sort((a, b) => a.date.localeCompare(b.date) || a.offeringTitle.localeCompare(b.offeringTitle));
      write(next);
    },
    [lines],
  );
  const remove = useCallback((key: string) => write(lines.filter((l) => lineKey(l) !== key)), [lines]);
  const clear = useCallback(() => write([]), []);
  return { lines, add, remove, clear };
}
