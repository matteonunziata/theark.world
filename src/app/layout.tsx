import type { Metadata, Viewport } from "next";
import "./globals.css";

// Loaded as a stylesheet rather than next/font: next/font/google fails to
// resolve under Turbopack on Vercel's build machines.
const FONTS =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Figtree:wght@400;500;600&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap";

export const metadata: Metadata = {
  title: { default: "ARK OS", template: "%s · ARK OS" },
  description:
    "The operating system for The ARK, Santa Teresa: community, club, land, farm, and team.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
