import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { Poster } from "./poster";

export const metadata: Metadata = { title: "Class QR codes", robots: { index: false } };

/** Every published class, one poster per page, to print in one go. */
export default async function AllClassQr() {
  const { supabase } = await getViewer();
  const { data } = await supabase
    .from("offerings")
    .select("*")
    .eq("kind", "class")
    .eq("status", "published")
    .order("title");
  if (!data?.length) {
    return (
      <div className="empty" style={{ maxWidth: 520, margin: "40px auto" }}>
        <h2>No published classes</h2>
        <p>Publish a class under Schedule and its QR code will be here.</p>
      </div>
    );
  }
  return data.map((o) => <Poster key={o.id} o={o} />);
}
