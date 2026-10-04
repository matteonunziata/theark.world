import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { addDays, todayIn } from "@/lib/dates";
import { lotTitle } from "@/lib/estate";
import { ListingEditor } from "./listing-editor";

type Props = PageProps<"/hospitality/[id]">;
const UUID = /^[0-9a-f-]{36}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await requireStaff("hospitality");
  const { data } = UUID.test(id)
    ? await supabase.from("lots").select("code, name, listing_title").eq("id", id).maybeSingle()
    : { data: null };
  return { title: data ? (data.listing_title ?? lotTitle(data)) : "Listing" };
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireStaff("hospitality");
  const today = todayIn();
  const [{ data: lot }, { data: photos }, { data: stays }] = await Promise.all([
    supabase.from("lots").select("*").eq("id", id).maybeSingle(),
    supabase.from("listing_photos").select("*").eq("lot_id", id).order("position").order("created_at"),
    supabase
      .from("stays")
      .select("*")
      .eq("lot_id", id)
      .neq("status", "cancelled")
      .gte("check_out", addDays(today, -31))
      .order("check_in"),
  ]);
  if (!lot) notFound();
  return (
    <div className="page">
      <ListingEditor lot={lot} photos={photos ?? []} stays={stays ?? []} today={today} />
    </div>
  );
}
