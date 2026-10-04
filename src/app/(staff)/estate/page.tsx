import { Planned } from "@/components/planned";
import { requireStaff } from "@/lib/auth";

export default async function Page() {
  await requireStaff("estate");
  return <Planned module="estate" />;
}
