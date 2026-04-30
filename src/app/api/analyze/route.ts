import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildAnalysisPrompt } from "@/lib/prompt";
import { analyzeTranscript } from "@/lib/ollama";

export const runtime = "nodejs";
// Local Ollama responses can take a while on small machines.
export const maxDuration = 120;

const schema = z.object({
  transcript: z.string().min(50, "Transcript must be at least 50 characters"),
  fellowName: z.string().max(120).optional(),
  supervisor: z.string().max(120).optional(),
  company: z.string().max(120).optional(),
  model: z.string().max(60).optional(),
  save: z.boolean().optional(),
});

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

  const { system, user } = buildAnalysisPrompt(transcript, {
    fellowName,
    supervisor,
    company,
  });

  try {
    const { analysis, model: usedModel } = await analyzeTranscript({
      system,
      user,
      model,
    });

    let savedId: string | null = null;
    if (save) {
      const row = await prisma.analysis.create({
        data: {
          userId: session.user.id,
          fellowName,
          supervisor,
          company,
          transcript,
          model: usedModel,
          result: analysis,
        },
      });
      savedId = row.id;
    }

    return NextResponse.json({
      ok: true,
      model: usedModel,
      analysis,
      savedId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isOllamaDown =
      message.includes("ECONNREFUSED") || message.includes("fetch failed");
    return NextResponse.json(
      {
        error: isOllamaDown
          ? "Could not reach Ollama. Is it running on " +
          (process.env.OLLAMA_BASE_URL || "http://localhost:11434") +
          "?"
          : message,
      },
      { status: isOllamaDown ? 503 : 500 }
    );
  }
}
