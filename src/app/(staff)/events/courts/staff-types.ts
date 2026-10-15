/** What staff_court_day() returns for each booking on a day. */
export type SPlayer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  host: boolean;
  status: string;
  level: number | null;
  share: number;
  checked_in_at: string | null;
  named: boolean;
  equipment: { id: string; label: string; price: number }[];
  equipment_total: number;
  paid: number;
  owed: number;
};

export type SPayment = {
  id: string;
  amount: number;
  method: string;
  amount_usd: number | null;
  usd_rate: number | null;
  vat_amount: number;
  refunded: boolean;
  created_at: string;
  note: string | null;
  player: string | null;
  taken_by: string | null;
};

export type SBooking = {
  id: string;
  court_id: string;
  kind: "booking" | "class";
  status: string;
  name: string;
  email: string | null;
  phone: string | null;
  contact_id: string | null;
  start_time: string;
  end_time: string;
  open_match: boolean;
  private_pay: "whole" | "split" | null;
  spots: number;
  level_min: number | null;
  level_max: number | null;
  notes: string | null;
  source: string;
  currency: string;
  amount: number;
  credit: number;
  moves_used: number;
  share_token: string;
  started_at: string | null;
  override_reason: string | null;
  override_at: string | null;
  override_by: string | null;
  equipment_total: number;
  paid_total: number;
  owed: number;
  state: "green" | "red" | "class";
  players: SPlayer[];
  payments: SPayment[];
};

export const METHODS = [
  ["card_reader", "Card (BAC reader)"],
  ["cash_crc", "Cash, colones"],
  ["cash_usd", "Cash, US dollars"],
  ["sinpe", "SINPE"],
] as const;

export const methodName = (m: string) =>
  m === "card_online" ? "Card, online" : (METHODS.find(([k]) => k === m)?.[1] ?? (m === "other" ? "Other" : m));
