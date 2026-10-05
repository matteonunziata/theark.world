import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { askAi, askAiEnabled } from "@/lib/ask-ai";
import { getViewer } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { roleName } from "@/lib/roles";

// Answers stream back as newline-delimited JSON: {"t":"text"|"status"|"error","v":"…"}.

const Body = z.object({
  turns: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20000) }))
    .min(1)
    .max(40),
  page: z.object({
    path: z.string().max(500),
    title: z.string().max(300),
    text: z.string().max(200000),
  }),
});

export async function POST(request: Request) {
  const { supabase, staff } = await getViewer();
  if (!staff) return new Response("Sign in as staff to use Ask AI.", { status: 401 });
  if (!askAiEnabled()) {
    return new Response("Ask AI is off until ANTHROPIC_API_KEY is set.", { status: 503 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("That request didn’t look right.", { status: 400 });

  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (e: { t: string; v: string }) =>
        controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
      try {
        await askAi(
          supabase,
          {
            turns: parsed.data.turns,
            page: parsed.data.page,
            who: staff.name,
            role: roleName(staff.role),
            today: todayIn(),
          },
          send,
        );
      } catch (e) {
        send({
          t: "error",
          v:
            e instanceof Anthropic.AuthenticationError
              ? "The AI key isn’t valid. Check ANTHROPIC_API_KEY."
              : e instanceof Anthropic.RateLimitError
                ? "The AI is busy. Try again in a minute."
                : e instanceof Anthropic.APIError
                  ? "The AI didn’t answer. Try again."
                  : e instanceof Error
                    ? e.message
                    : "Something went wrong. Try again.",
        });
      }
      controller.close();
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
