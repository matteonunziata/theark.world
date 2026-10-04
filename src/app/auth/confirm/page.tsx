import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { Confirm } from "./confirm";

export const metadata: Metadata = { title: "Signing in" };

export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const { next } = await searchParams;
  const safe =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo tone="dark" height={34} />
        </div>
        <Confirm next={safe} />
      </div>
    </main>
  );
}
