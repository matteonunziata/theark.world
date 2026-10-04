import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// AI drafting for workflows. Off until ANTHROPIC_API_KEY is set (it costs
// money per call). Drafts always land in the editor for a person to review
// and save; nothing is sent automatically.

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const MODEL = "claude-opus-5-5";

const VOICE = `You write messages for The ARK, a members club, farm and community in Santa Teresa, Costa Rica.

Voice: an invitation, not a sales pitch. Plain, warm and specific. No hype, no exclamation marks, no emoji unless asked. Short sentences. Sound like a person on the team writing to someone they know.

Merge fields you can use: {{first_name}}, {{name}}, {{org}}. Start emails with "Hi {{first_name}},".

Message format (plain text, blank line between blocks). Use these marks only when they help:
- "## Heading" for a section heading
- "**words**" for bold
- lines starting "- " for a list
- "[[Button text|https://link]]" on its own line for a button (only with a real link you were given)
- "![description](https://image-url)" on its own line for an image (only with an image URL you were given; keep any that are already in the message)

WhatsApp messages are short, have no subject, and use none of these marks except links.`;

const Step = z.object({
  channel: z.enum(["email", "whatsapp"]),
  delay_days: z.number().int(),
  subject: z.string(),
  body: z.string(),
});

const Workflow = z.object({
  name: z.string(),
  description: z.string(),
  steps: z.array(Step),
});

const Message = z.object({ subject: z.string(), body: z.string() });

type StepIn = z.infer<typeof Step>;

async function ask<T extends z.ZodType>(schema: T, prompt: string): Promise<z.infer<T>> {
  const client = new Anthropic();
  try {
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, the API retries on a suitable model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: VOICE,
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      throw new Error("The AI couldn’t write that one. Try rewording the request.");
    }
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("The AI key isn’t valid. Check ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("The AI is busy. Try again in a minute.");
    if (e instanceof Anthropic.APIError) throw new Error("The AI didn’t answer. Try again.");
    throw e;
  }
}

/** Draft a whole workflow, or change an existing one, from a request. */
export function draftWorkflow(input: { request: string; name: string; description: string; steps: StepIn[] }) {
  const current = input.steps.length
    ? `The workflow right now:\n${JSON.stringify({ name: input.name, description: input.description, steps: input.steps }, null, 2)}`
    : "There is no workflow yet; write one from scratch.";
  return ask(
    Workflow,
    `${current}

The request from the team:
${input.request}

Return the complete workflow after the change: a short name, who it's for, and every step in order. delay_days is the wait after the previous step (the first step's wait is counted from enrolment). Keep steps the request doesn't mention as they are. Email subjects are short and specific; WhatsApp steps have an empty subject.`,
  );
}

/** Write or rewrite one step. */
export function draftStep(input: {
  request: string;
  channel: string;
  subject: string;
  body: string;
  workflowName: string;
  description: string;
  position: number;
  total: number;
}) {
  return ask(
    Message,
    `This is step ${input.position} of ${input.total} in the workflow "${input.workflowName || "Untitled"}"${input.description ? ` (for: ${input.description})` : ""}.
Channel: ${input.channel === "whatsapp" ? "WhatsApp" : "Email"}.

${input.body.trim() ? `The message right now:\nSubject: ${input.subject}\n\n${input.body}` : "The message is empty; write it from scratch."}

The request from the team:
${input.request}

Return the new subject (empty for WhatsApp) and the full message body.`,
  );
}
