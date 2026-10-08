"use client";

import { useState } from "react";
import { money, planHref, PLANS, stayCost } from "./plans";

const QUESTIONS = [
  {
    key: "weeks",
    q: "How long will you be in Santa Teresa?",
    options: [
      [1, "A week"],
      [4, "About a month"],
      [13, "Around three months"],
      [26, "Half the year"],
      [52, "All year"],
    ],
  },
  {
    key: "daysPerWeek",
    q: "How many days a week would you come to The ARK?",
    options: [
      [1, "Once"],
      [3, "Two or three"],
      [5, "Most weekdays"],
      [7, "Every day"],
    ],
  },
  {
    key: "guestsPerMonth",
    q: "How often would you bring a guest?",
    options: [
      [0, "Rarely"],
      [2, "Now and then"],
      [4, "Weekly"],
      [8, "Twice a week"],
    ],
  },
  {
    key: "extrasPerMonth",
    q: "What might you spend each month on courts, events and Farm products?",
    options: [
      [0, "Very little"],
      [50_000, "Around ₡50,000"],
      [150_000, "Around ₡150,000"],
      [300_000, "₡300,000 or more"],
    ],
  },
] as const;

type Answers = Record<(typeof QUESTIONS)[number]["key"], number>;

export function Calculator() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Partial<Answers>>({});

  if (!started) {
    return (
      <div className="ms-calc">
        <h3>Not sure which one is right for you?</h3>
        <p>
          Four quick questions about how you’d spend your time here, and we’ll show which pass or
          membership makes the most sense.
        </p>
        <button type="button" className="ms-btn solid" onClick={() => setStarted(true)}>
          Show me the numbers
        </button>
      </div>
    );
  }

  if (step < QUESTIONS.length) {
    const q = QUESTIONS[step];
    return (
      <div className="ms-calc">
        <p className="ms-eyebrow">
          Question {step + 1} of {QUESTIONS.length}
        </p>
        <h3>{q.q}</h3>
        <div className="ms-choices">
          {q.options.map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={a[q.key] === v}
              onClick={() => {
                setA({ ...a, [q.key]: v });
                setStep(step + 1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {step > 0 && (
          <button type="button" className="ms-link" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
      </div>
    );
  }

  const answers = a as Answers;
  const results = PLANS.map((p) => ({ p, ...stayCost(p, answers) })).sort((x, y) => x.total - y.total);
  const best = results[0];
  const dayRate = results.find((r) => r.p.key === "day")!;
  const saved = dayRate.total - best.total;

  return (
    <div className="ms-calc">
      <p className="ms-eyebrow">Our suggestion</p>
      <h3>{best.p.name}</h3>
      <p>
        About {money(best.total, "CRC")} for your time here
        {saved > 0 && <>, {money(saved, "CRC")} less than paying day by day</>}.
        {best.p.kind === "membership" && " Memberships begin with an application."}
      </p>
      <ul className="ms-compare">
        {results.map((r) => (
          <li key={r.p.key} className={r === best ? "best" : ""}>
            <span>{r.p.name}</span>
            <span>{money(r.total, "CRC")}</span>
          </li>
        ))}
      </ul>
      <p className="ms-fine">
        Includes guests beyond your allowance at the day rate, and member savings on courts, events
        and Farm products. Food is separate.
      </p>
      <div className="ms-row">
        <a className="ms-btn solid" href={planHref(best.p)}>
          {best.p.kind === "membership" ? "Apply for membership" : "Buy a pass"}
        </a>
        <button
          type="button"
          className="ms-link"
          onClick={() => {
            setA({});
            setStep(0);
          }}
        >
          Start over
        </button>
      </div>
    </div>
  );
}
