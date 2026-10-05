"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGEST: Record<string, string[]> = {
  "/crm": ["Who should I follow up with this week?", "Which members renew in the next 30 days?"],
  "/finance": ["How did this month compare with last month?", "What’s still unpaid, and since when?"],
  "/events": ["Which classes fill up most?", "Who booked the most sessions this month?"],
  "/hospitality": ["Which homes are free next weekend?", "How many nights are booked this month?"],
  "/estate": ["Which lots are still available, and at what price?", "Summarize this page"],
  "/shop": ["What’s running low?", "Who bought the most from the farm shop?"],
  "/memberships": ["How many active members do we have by tier?", "Who’s paused right now?"],
};
const suggestions = (path: string) =>
  SUGGEST[Object.keys(SUGGEST).find((k) => path.startsWith(k)) ?? ""] ?? [
    "Summarize this page",
    "What needs attention today?",
  ];

/** The "Ask AI" button and the chat that slides out from the right. */
export function AskAi({ variant = "top" }: { variant?: "top" | "bar" }) {
  return (
    <button
      type="button"
      className={`ask-btn ${variant}`}
      onClick={() => window.dispatchEvent(new Event("ask-ai:toggle"))}
    >
      <Sparkle />
      Ask AI
    </button>
  );
}

export function AskAiPanel() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("ask-ai:toggle", toggle);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("ask-ai:toggle", toggle);
      window.removeEventListener("keydown", key);
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("ask-open", open);
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns, status]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const main = document.querySelector("main.main") as HTMLElement | null;
    const history: Turn[] = [...turns, { role: "user", content: q }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setError("");
    setStatus("Thinking");
    setBusy(true);
    abort.current = new AbortController();
    let answer = "";
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({
          turns: history,
          page: { path, title: document.title, text: (main?.innerText ?? "").slice(0, 60000) },
        }),
      });
      if (!res.ok || !res.body) throw new Error((await res.text()) || "The AI didn’t answer. Try again.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const e = JSON.parse(line) as { t: string; v: string };
          if (e.t === "text") {
            answer += e.v;
            setStatus("");
            setTurns([...history, { role: "assistant", content: answer }]);
          } else if (e.t === "status") {
            setStatus(e.v);
          } else if (e.t === "error") {
            throw new Error(e.v);
          }
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
      if (!answer) setTurns(history.slice(0, -1));
      if (!answer) setDraft(q);
    }
    setStatus("");
    setBusy(false);
  }

  const reset = () => {
    abort.current?.abort();
    setTurns([]);
    setError("");
    inputRef.current?.focus();
  };

  return (
    <aside className={`ask-panel ${open ? "open" : ""}`} aria-label="Ask AI" aria-hidden={!open} inert={!open}>
      <header>
        <div>
          <b>
            <Sparkle /> Ask AI
          </b>
          <span>About this page, or anything in ARK OS</span>
        </div>
        {turns.length > 0 && (
          <button type="button" className="linkish-sm" onClick={reset}>
            New chat
          </button>
        )}
        <button type="button" className="ask-x" aria-label="Close" onClick={() => setOpen(false)}>
          ×
        </button>
      </header>

      <div className="ask-list" ref={listRef} aria-live="polite">
        {turns.length === 0 ? (
          <div className="ask-empty">
            <p>
              Ask about what’s on this page, or about people, bookings, sales, stays and money across the
              business. It sees only what you can see.
            </p>
            {suggestions(path).map((s) => (
              <button key={s} type="button" className="ask-sug" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : (
          turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="ask-q">{t.content}</div>
            ) : t.content ? (
              <div key={i} className="ask-a">
                <Rich text={t.content} />
              </div>
            ) : null,
          )
        )}
        {status && <div className="ask-status">{status}…</div>}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
      </div>

      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <textarea
          ref={inputRef}
          aria-label="Your question"
          placeholder="Ask a question"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(draft);
            }
          }}
        />
        {busy ? (
          <button type="button" className="btn" onClick={() => abort.current?.abort()}>
            Stop
          </button>
        ) : (
          <button type="submit" className="btn primary" disabled={!draft.trim()}>
            Ask
          </button>
        )}
      </form>
    </aside>
  );
}

/** Paragraphs, "- " lists, **bold** and [links](/path). Built from React
 * elements, never raw HTML. */
function Rich({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.replace(/^\s*([-*]|\d+\.)\s/, "")} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline text={l.replace(/^#+\s/, "")} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        const bold = p.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <b key={i}>{bold[1]}</b>;
        const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link) {
          const [, label, href] = link;
          if (href.startsWith("/")) return <Link key={i} href={href}>{label}</Link>;
          if (href.startsWith("https://"))
            return (
              <a key={i} href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            );
          return label;
        }
        return p;
      })}
    </>
  );
}

function Sparkle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" />
    </svg>
  );
}
