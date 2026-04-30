// Groq API provider — drop-in replacement for the Ollama streaming path.
// Uses the OpenAI-compatible /chat/completions endpoint with SSE streaming.
// Re-exports schema utilities so callers only need to import from one place.

export { analysisSchema, extractJson } from "./ollama";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export async function* streamGroqTokens(opts: {
  system: string;
  user: string;
  model?: string;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY environment variable is not set");

  const usedModel = opts.model || GROQ_MODEL;

  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: usedModel,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      stream: true,
      temperature: 0.1,
      max_tokens: 2048,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let resolvedModel = usedModel;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        yield `\x00MODEL:${resolvedModel}`;
        return;
      }
      try {
        const chunk = JSON.parse(data) as {
          model?: string;
          choices?: { delta?: { content?: string } }[];
        };
        if (chunk.model) resolvedModel = chunk.model;
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // malformed SSE chunk — skip
      }
    }
  }
  yield `\x00MODEL:${resolvedModel}`;
}
