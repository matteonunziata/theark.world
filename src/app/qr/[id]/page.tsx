import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { Poster } from "../poster";

export const metadata: Metadata = { title: "Class QR code", robots: { index: false } };

export default async function ClassQr({ params }: PageProps<"/qr/[id]">) {
  const { id } = await params;
  const { supabase } = await getViewer();
  const { data: o } = await supabase.from("offerings").select("*").eq("id", id).maybeSingle();
  if (!o) notFound();
  return <Poster o={o} />;
}
