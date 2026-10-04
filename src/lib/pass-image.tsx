import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { BRAND } from "@/lib/email-template";

let logo: Promise<string> | null = null;
const lockup = () =>
  (logo ??= readFile(join(process.cwd(), "public/brand/ark-lockup-light.png")).then(
    (b) => `data:image/png;base64,${b.toString("base64")}`,
  ));

/**
 * A phone-sized PNG of a pass or ticket, for saving to the camera roll.
 * The QR is the same link security scans at the gate.
 */
export async function passImage(p: {
  url: string;
  eyebrow: string;
  title: string;
  holder: string;
  lines: string[];
  code: string;
  filename: string;
}) {
  const [qr, logoSrc] = await Promise.all([
    QRCode.toDataURL(p.url, { width: 720, margin: 1, color: { dark: BRAND.canopy, light: "#FFFFFF" } }),
    lockup(),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: BRAND.canopy,
          padding: "110px 80px 90px",
          color: BRAND.canopyInk,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={logoSrc} width={300} height={80} />
        <div style={{ display: "flex", flex: 1, width: "100%", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            background: "#FFFFFF",
            borderRadius: 56,
            padding: "64px 56px 56px",
            color: BRAND.ink,
          }}
        >
          <div style={{ fontSize: 30, letterSpacing: 4, textTransform: "uppercase", color: BRAND.sea, fontWeight: 700 }}>
            {p.eyebrow}
          </div>
          <div style={{ fontSize: 64, fontWeight: 700, marginTop: 14, textAlign: "center", lineHeight: 1.1 }}>{p.title}</div>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={qr} width={600} height={600} style={{ marginTop: 48 }} />
          <div style={{ fontSize: 40, letterSpacing: 8, marginTop: 18, fontFamily: "monospace" }}>{p.code}</div>
          <div style={{ fontSize: 50, fontWeight: 700, marginTop: 44 }}>{p.holder}</div>
          {p.lines.map((l) => (
            <div key={l} style={{ fontSize: 34, color: BRAND.muted, marginTop: 10, textAlign: "center" }}>
              {l}
            </div>
          ))}
        </div>
        </div>
        <div style={{ fontSize: 28, color: BRAND.canopyMuted, textAlign: "center" }}>
          Show this to security · Santa Teresa, Costa Rica
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${p.filename}"`,
      },
    },
  );
}
