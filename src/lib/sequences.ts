import { addDays } from "@/lib/dates";

export type Step = {
  position: number;
  channel: string;
  delay_days: number;
  subject: string | null;
  body: string;
};

/** The day step i is due, counting delays from the enrollment date. */
export function stepDue(startedOn: string, steps: Step[], i: number) {
  let d = startedOn;
  for (let k = 0; k <= i; k++) d = addDays(d, Number(steps[k]?.delay_days ?? 0));
  return d;
}

/** Index of the first step not yet sent, or -1 when all are sent. */
export function nextStep(steps: Step[], sent: number[]) {
  return steps.findIndex((s) => !sent.includes(s.position));
}
