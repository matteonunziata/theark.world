import { redirect } from "next/navigation";

// My Property moved to the steward platform.
export default function PropertyMoved() {
  redirect("/steward");
}
