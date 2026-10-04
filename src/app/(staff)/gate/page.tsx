import { redirect } from "next/navigation";

// The gate console is now called Security.
export default function GatePage() {
  redirect("/security");
}
