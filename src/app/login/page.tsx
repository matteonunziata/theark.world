import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LeafMark } from "@/components/leaf-mark";
import { getViewer } from "@/lib/auth";
import { GoogleButton } from "./google-button";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { error } = await searchParams;
  const { staff } = await getViewer();
  if (staff) redirect("/");

  return (
    <main className="auth">
      <div className="auth-card">
        <LeafMark className="auth-leaf" />
        <div className="mark">
          ARK <small>OS</small>
        </div>
        <h1>Team sign-in</h1>
        <p>Use your @theark.world Google account.</p>
        {typeof error === "string" && (
          <p className="auth-err" role="alert">
            {error}
          </p>
        )}
        <GoogleButton />
        <p className="auth-foot">
          A member? <Link href="/portal/login">Go to the members portal</Link>
        </p>
      </div>
    </main>
  );
}
