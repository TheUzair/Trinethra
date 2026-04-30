import rubric from "@/data/rubric.json";

/**
 * Build the system + user prompt for the supervisor-feedback analyzer.
 *
 * Design notes (Challenge 1 in assignment.md):
 *   We use ONE prompt that returns the entire structured analysis as JSON.
 *   Rationale: a 10-min transcript fits comfortably in a small model's context,
 *   the rubric/KPI definitions are small, and a single round-trip is dramatically
 *   faster on local hardware than a chain of calls. We instead invest in (a) a
 *   detailed schema in the prompt, (b) Ollama JSON mode (`format: "json"`), and
 *   (c) a tolerant parser with regex fallback for reliability (Challenge 2).
 */
export function buildAnalysisPrompt(transcript: string, meta?: {
  fellowName?: string;
  supervisor?: string;
  company?: string;
}) {
  const fellowName = meta?.fellowName || "the Fellow";
  const rubricText = rubric.rubric.bands
    .flatMap((b) =>
      b.levels.map(
        (l) =>
          `  ${l.score} – ${l.label} (${b.band}): ${l.description} Signals: ${l.signals.join("; ")}.`
      )
    )
    .join("\n");

  const dimText = rubric.assessmentDimensions
    .map((d) => `  - ${d.id} (${d.label}): ${d.description}`)
    .join("\n");

  const kpiText = rubric.kpis
    .map((k) => `  - ${k.id} (${k.label}): ${k.description}`)
    .join("\n");

  const system = `You are an expert performance analyst at DeepThought. You read a phone-call transcript in which a client supervisor describes how a DT Fellow is performing inside their company, and you produce a STRUCTURED, EVIDENCE-BASED draft analysis that a human psychology intern will review.

Hard rules:
1. ONLY use evidence that is literally present in the transcript. Never invent facts.
2. Every score, KPI mapping, and gap MUST cite at least one direct quote.
3. Be aware of supervisor biases:
   - HELPFULNESS bias: "She handles all my calls now" sounds like an 8 but is usually 5–6 (task absorption, not systems building).
   - PRESENCE bias: praise for being "on the floor" can mask the absence of Layer 2 work; criticism of "spending time on the laptop" can mask real systems building.
   - HALO/HORN: one big story coloring the whole assessment.
   - RECENCY: weight evidence across the full tenure, not just the latest anecdote.
4. The CRITICAL boundary is 6 vs 7. A 6 executes tasks defined by others. A 7 identifies problems the supervisor had NOT articulated. Use this to break ties.
5. Apply the SURVIVABILITY TEST: if the Fellow left tomorrow, would the system keep running? If no → it is task absorption (Layer 1), not systems building (Layer 2).
6. Return a SINGLE valid JSON object that matches the schema below. No prose, no markdown, no code fences.

Rubric (1–10):
${rubricText}

Assessment dimensions (use these IDs in "gaps"):
${dimText}

Business KPIs (use these IDs in "kpiMapping"):
${kpiText}

Output JSON schema (return EXACTLY this shape):
{
  "score": {
    "value": <integer 1-10>,
    "label": "<rubric label for that score>",
    "band": "<Need Attention | Productivity | Performance>",
    "confidence": "<low | medium | high>",
    "justification": "<2-4 sentences. Cite evidence. Explicitly address the 6-vs-7 boundary if value is 5,6,7.>"
  },
  "evidence": [
    {
      "quote": "<verbatim snippet from the transcript>",
      "signal": "<positive | negative | neutral>",
      "dimension": "<execution | systems_building | kpi_impact | change_management>",
      "interpretation": "<one sentence of why this quote matters and which Layer (1 execution / 2 systems) it indicates>"
    }
  ],
  "kpiMapping": [
    {
      "kpi": "<one of the kpi IDs above>",
      "evidence": "<short quote or paraphrase>",
      "systemOrPersonal": "<system | personal>"
    }
  ],
  "gaps": [
    {
      "dimension": "<one of the assessment dimension IDs>",
      "detail": "<what the transcript fails to cover and why it matters>"
    }
  ],
  "followUpQuestions": [
    {
      "question": "<concrete question the intern should ask next call>",
      "targetGap": "<dimension id this question probes>",
      "lookingFor": "<what answer would change the score>"
    }
  ],
  "biasFlags": [
    {
      "bias": "<helpfulness | presence | halo | horn | recency>",
      "detail": "<which sentence in the transcript triggers this flag>"
    }
  ]
}

Provide 4–8 evidence items, 1–4 KPI mappings, 1–4 gaps, 3–5 follow-up questions, and 0–3 bias flags.`;

  // Safety-trim: keep transcript under ~10 000 chars (≈2 500 tokens) so the
  // total request (system ~1 500 t + transcript + response ~1 000 t) stays well
  // within Groq free-tier limits (14 400 TPM for gemma2-9b-it).
  const MAX_TRANSCRIPT_CHARS = 6_000;
  const trimmedTranscript =
    transcript.trim().length > MAX_TRANSCRIPT_CHARS
      ? transcript.trim().slice(0, MAX_TRANSCRIPT_CHARS) + "\n\n[transcript truncated for length]"
      : transcript.trim();

  const user = `Fellow: ${fellowName}
${meta?.supervisor ? `Supervisor: ${meta.supervisor}\n` : ""}${meta?.company ? `Company: ${meta.company}\n` : ""}
Transcript:
"""
${trimmedTranscript}
"""

Return the JSON object now. Do not wrap it in code fences.`;

  return { system, user };
}
