"use client";

import { useState } from "react";

/** A long description folded to a few lines, with Read more. */
export function ReadMore({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 380 || text.split("\n").length > 6;
  return (
    <div>
      <p className={`ev-desc evp-about${long && !open ? " clamp" : ""}`}>{text}</p>
      {long && (
        <button type="button" className="linkish" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

/** Share the page: the phone's share sheet where there is one, otherwise copy the link. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn sm"
      onClick={async () => {
        const url = window.location.href.split("#")[0];
        try {
          if (navigator.share) {
            await navigator.share({ title, url });
            return;
          }
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* cancelled the share sheet, or no clipboard */
        }
      }}
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

/** Where it is: the name opens Maps, with a small map and directions. */
export function LocationBlock({ name, address }: { name: string | null; address: string | null }) {
  const query = address || `${name}, Santa Teresa, Puntarenas, Costa Rica`;
  const q = encodeURIComponent(query);
  return (
    <section className="evp-loc">
      <h2>Location</h2>
      <div className="evp-loc-grid">
        <div>
          <h3>
            <a href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener noreferrer">
              {name || "The ARK"}
            </a>
          </h3>
          {address && <p>{address}</p>}
          <p>
            <a className="linkish" href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} target="_blank" rel="noopener noreferrer">
              Get directions
            </a>
          </p>
        </div>
        <div className="evp-map">
          <iframe
            title={`Map of ${name || "the event"}`}
            src={`https://maps.google.com/maps?q=${q}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a className="evp-map-open" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener noreferrer">
            Open in Maps
          </a>
        </div>
      </div>
    </section>
  );
}
