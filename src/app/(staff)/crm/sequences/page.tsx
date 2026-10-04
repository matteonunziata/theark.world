import { redirect } from "next/navigation";

// Sequences are now called workflows.
export default function SequencesPage() {
  redirect("/crm/workflows");
}
