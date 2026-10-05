import QRCode from "qrcode";
import { Logo } from "@/components/logo";
import { siteUrl } from "@/lib/email";
import { type Offering, whenLabel } from "@/lib/schedule";

/** Where a class's QR code points. `qr=1` sends signed-out members to sign in first. */
export const bookingUrl = (origin: string, id: string) => `${origin}/e/${id}?qr=1`;

/** One printable page: the class, when it runs, and a QR code to book it. */
export async function Poster({ o }: { o: Offering }) {
  const url = bookingUrl(await siteUrl(), o.id);
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  return (
    <section className="qr-poster">
      <Logo tone="dark" height={44} />
      <p className="qr-kicker">Scan to book</p>
      <h1>{o.title}</h1>
      <p className="qr-when">
        {whenLabel(o)}
        {o.location && <> · {o.location}</>}
      </p>
      <div className="qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="qr-foot">
        Open your phone’s camera and point it at the code. Members sign in with
        the email on their membership, then pick a date.
      </p>
      <a
        className="btn qr-dl"
        href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        download={`${o.title.replace(/[^\w]+/g, "-").toLowerCase()}-qr.svg`}
      >
        Download QR code
      </a>
    </section>
  );
}
