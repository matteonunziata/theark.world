import type { Metadata } from "next";
import { loadFinance } from "../data";
import { EntryList } from "../entry-list";

export const metadata: Metadata = { title: "Transactions" };

export default async function Page() {
  const { entries, lines, conv, today } = await loadFinance();
  return (
    <EntryList
      entries={entries}
      lines={lines}
      conv={conv}
      today={today}
      mode="all"
    />
  );
}
