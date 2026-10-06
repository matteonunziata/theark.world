import { requireStaff } from "@/lib/auth";
import { PrintButton } from "./print-button";

export default async function QrLayout({ children }: LayoutProps<"/qr">) {
  await requireStaff("events");
  return (
    <main className="qr-page">
      <div className="qr-bar">
        <span>Print on A4 or letter, one class per page.</span>
        <PrintButton />
      </div>
      {children}
    </main>
  );
}
