import type { Metadata } from "next";
import { loadFinance } from "../data";
import { EntryList } from "../entry-list";

const byDue = (a: { due_date: string | null }, b: { due_date: string | null }) =>
  (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
export const metadata: Metadata = { title: "Receivables" };

export default async function Page() {
  const { entries, lines, currency, today } = await loadFinance();
  return (
    <EntryList
      entries={entries
      .filter((e) => e.kind === "income" && e.status === "unpaid")
      .sort(byDue)}
      lines={lines}
      currency={currency}
      today={today}
      mode="receivables"
    />
  );
}
