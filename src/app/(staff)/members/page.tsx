import { Planned } from "@/components/planned";
import { requireStaff } from "@/lib/auth";

export default async function Page() {
  await requireStaff("members");
  return <Planned module="members" />;
}
