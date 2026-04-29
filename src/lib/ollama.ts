import { z } from "zod";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

export const analysisSchema = z.object({
  score: z.object({
    value: z.number().int().min(1).max(10),
    label: z.string(),
    band: z.string(),
    confidence: z.enum(["low", "medium", "high"]).catch("medium"),
    justification: z.string(),
  }),
  evidence: z
    .array(
      z.object({
        quote: z.string(),
        signal: z.enum(["positive", "negative", "neutral"]).catch("neutral"),
        dimension: z.string(),
        interpretation: z.string(),
      })
    )
    .default([]),
  kpiMapping: z
    .array(
      z.object({
        kpi: z.string(),
        evidence: z.string(),
        systemOrPersonal: z.enum(["system", "personal"]).catch("personal"),
      })
    )
    .default([]),
  gaps: z
    .array(
      z.object({
        dimension: z.string(),
        detail: z.string(),
      })
    )
    .default([]),
  followUpQuestions: z
    .array(
      z.object({
        question: z.string(),
        targetGap: z.string(),
        lookingFor: z.string(),
      })
    )
    .default([]),
  biasFlags: z
    .array(
      z.object({
        bias: z.string(),
        detail: z.string(),
      })
    )
    .default([]),
});

export type Analysis = z.infer<typeof analysisSchema>;

/**
 * Tolerant JSON extraction (Challenge 2).
 * Local models sometimes wrap JSON in ```json fences or add a sentence before/after.
 */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? raw;
  // Strip leading prose to first { and trailing prose after last }.
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function runOllama(opts: {
  system: string;
  user: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<{ raw: string; model: string }> {
  const model = opts.model || OLLAMA_MODEL;
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      options: { temperature: 0.2, num_ctx: 8192 },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Ollama request failed (${res.status}). ${body.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as { message?: { content?: string }; response?: string };
  const raw = data.message?.content ?? data.response ?? "";
  if (!raw) throw new Error("Empty response from Ollama");
  return { raw, model };
}

export async function analyzeTranscript(opts: {
  system: string;
  user: string;
  model?: string;
}): Promise<{ analysis: Analysis; model: string; raw: string }> {
  const { raw, model } = await runOllama(opts);

  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch (e) {
    throw new Error(
      `Could not parse JSON from model. First 200 chars of response: ${raw.slice(0, 200)}`
    );
  }

  const result = analysisSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Model output did not match expected schema: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }

  return { analysis: result.data, model, raw };
}

export const ollamaConfig = { baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL };
