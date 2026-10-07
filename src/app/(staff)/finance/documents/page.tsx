import type { Metadata } from "next";
import { loadFinance } from "../data";
import { EntryList } from "../entry-list";

export const metadata: Metadata = { title: "Receipts & invoices" };

export default async function Page() {
  const { entries, lines, conv, today } = await loadFinance();
  return (
    <EntryList
      entries={entries.filter((e) => e.doc_kind || e.file_path)}
      lines={lines}
      conv={conv}
      today={today}
      mode="documents"
    />
  );
}
