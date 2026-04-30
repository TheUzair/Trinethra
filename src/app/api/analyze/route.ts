import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildAnalysisPrompt } from "@/lib/prompt";
import { streamGroqTokens, analysisSchema, extractJson } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 480;

const schema = z.object({
  transcript: z.string().min(50, "Transcript must be at least 50 characters"),
  fellowName: z.string().max(120).optional(),
  supervisor: z.string().max(120).optional(),
  company: z.string().max(120).optional(),
  model: z.string().max(60).optional(),
  save: z.boolean().optional(),
});

function sseEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { transcript, fellowName, supervisor, company, model, save } = parsed.data;
  const { system, user } = buildAnalysisPrompt(transcript, { fellowName, supervisor, company });

  const encoder = new TextEncoder();
  const userId = session.user.id;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(data)));

      // Immediately flush a ping so the client knows the connection is live
      // (Ollama can take 10-30 s before emitting its first token)
      send({ type: "ping" });

      try {
        let accumulated = "";
        let usedModel = model || "llama-3.3-70b-versatile";
        let firstToken = true;

        for await (const token of streamGroqTokens({ system, user, model })) {
          if (firstToken) {
            firstToken = false;
            console.log(`[analyze] first token received from Groq`);
          }
          // sentinel carrying the resolved model name
          if (token.startsWith("\x00MODEL:")) {
            usedModel = token.slice(7);
            continue;
          }
          accumulated += token;
          send({ type: "token", text: token });
        }

        // Parse and validate
        const rawParsed = extractJson(accumulated);
        const validated = analysisSchema.safeParse(rawParsed);
        if (!validated.success) {
          send({ type: "error", message: "Model output did not match expected schema." });
          controller.close();
          return;
        }
        const analysis = validated.data;

        // Optionally persist
        let savedId: string | null = null;
        if (save) {
          const row = await prisma.analysis.create({
            data: { userId, fellowName, supervisor, company, transcript, model: usedModel, result: analysis },
          });
          savedId = row.id;
        }

        send({ type: "result", analysis, model: usedModel, savedId });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
