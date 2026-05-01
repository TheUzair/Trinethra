"use client";

import React, { useState, useTransition, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowPathIcon,
  BookmarkIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  PlayIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Sample = {
  id: string;
  fellow: { name: string };
  company: { name: string; industry?: string };
  supervisor: { name: string; role?: string };
  transcript: string;
};

type Evidence = {
  quote: string;
  signal: "positive" | "negative" | "neutral";
  dimension: string;
  interpretation: string;
};

type Analysis = {
  score: {
    value: number;
    label: string;
    band: string;
    confidence: "low" | "medium" | "high";
    justification: string;
  };
  evidence: Evidence[];
  kpiMapping: { kpi: string; evidence: string; systemOrPersonal: "system" | "personal" }[];
  gaps: { dimension: string; detail: string }[];
  followUpQuestions: { question: string; targetGap: string; lookingFor: string }[];
  biasFlags: { bias: string; detail: string }[];
};

// ── Review state ──────────────────────────────────────────────────────────────
type FindingState = "pending" | "accepted" | "rejected";

type ScoreReview = { state: FindingState; editedValue: number | null; editedJustification: string | null };
type EvidenceReview = { state: FindingState; editedSignal: Evidence["signal"] | null; editedInterpretation: string | null };
type KpiReview = { state: FindingState };
type GapReview = { state: FindingState };
type FollowUpReview = { state: FindingState; editedQuestion: string | null };
type BiasFlagReview = { state: FindingState };

type ReviewState = {
  score: ScoreReview;
  evidence: EvidenceReview[];
  kpiMapping: KpiReview[];
  gaps: GapReview[];
  followUpQuestions: FollowUpReview[];
  biasFlags: BiasFlagReview[];
};

function initReviewState(a: Analysis): ReviewState {
  return {
    score: { state: "pending", editedValue: null, editedJustification: null },
    evidence: a.evidence.map(() => ({ state: "pending", editedSignal: null, editedInterpretation: null })),
    kpiMapping: a.kpiMapping.map(() => ({ state: "pending" })),
    gaps: a.gaps.map(() => ({ state: "pending" })),
    followUpQuestions: a.followUpQuestions.map(() => ({ state: "pending", editedQuestion: null })),
    biasFlags: a.biasFlags.map(() => ({ state: "pending" })),
  };
}

const DIMENSION_LABEL: Record<string, string> = {
  execution: "Driving Execution",
  systems_building: "Systems Building",
  kpi_impact: "KPI Impact",
  change_management: "Change Management",
};

const KPI_LABEL: Record<string, string> = {
  lead_generation: "Lead Generation",
  lead_conversion: "Lead Conversion",
  upselling: "Upselling",
  cross_selling: "Cross-selling",
  nps: "NPS",
  pat: "PAT",
  tat: "TAT",
  quality: "Quality",
};

function bandClass(value: number) {
  if (value <= 3) return "band-need";
  if (value <= 6) return "band-prod";
  return "band-perf";
}

export function Analyzer({
  initialAnalysis = null,
  initialTranscript = "",
  initialFellowName = "",
  initialCompany = "",
  initialSupervisor = "",
  initialModel = "",
}: {
  initialAnalysis?: unknown;
  initialTranscript?: string;
  initialFellowName?: string;
  initialCompany?: string;
  initialSupervisor?: string;
  initialModel?: string;
}) {
  const [transcript, setTranscript] = useState(initialTranscript);
  const [fellowName, setFellowName] = useState(initialFellowName);
  const [supervisor, setSupervisor] = useState(initialSupervisor);
  const [company, setCompany] = useState(initialCompany);
  const [model, setModel] = useState(initialModel);
  const [save, setSave] = useState(true);

  const [samples, setSamples] = useState<Sample[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(
    (initialAnalysis as Analysis) ?? null
  );
  const [usedModel, setUsedModel] = useState<string | null>(
    initialModel || null
  );
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [, startTransition] = useTransition();
  const [highlightQuote, setHighlightQuote] = useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const [reviewedAnalysis, setReviewedAnalysis] = useState<Analysis | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [showFinal, setShowFinal] = useState(false);

  // Reset review state whenever analysis changes (derived-state pattern)
  if (analysis !== reviewedAnalysis) {
    setReviewedAnalysis(analysis);
    setReview(analysis ? initReviewState(analysis) : null);
    setShowFinal(false);
  }

  function updateScoreReview(update: Partial<ScoreReview>) {
    setReview((r) => r ? { ...r, score: { ...r.score, ...update } } : r);
  }
  function updateEvidenceReview(idx: number, update: Partial<EvidenceReview>) {
    setReview((r) => r ? { ...r, evidence: r.evidence.map((e, i) => i === idx ? { ...e, ...update } : e) } : r);
  }
  function updateKpiReview(idx: number, update: Partial<KpiReview>) {
    setReview((r) => r ? { ...r, kpiMapping: r.kpiMapping.map((k, i) => i === idx ? { ...k, ...update } : k) } : r);
  }
  function updateGapReview(idx: number, update: Partial<GapReview>) {
    setReview((r) => r ? { ...r, gaps: r.gaps.map((g, i) => i === idx ? { ...g, ...update } : g) } : r);
  }
  function updateFollowUpReview(idx: number, update: Partial<FollowUpReview>) {
    setReview((r) => r ? { ...r, followUpQuestions: r.followUpQuestions.map((q, i) => i === idx ? { ...q, ...update } : q) } : r);
  }
  function updateBiasFlagReview(idx: number, update: Partial<BiasFlagReview>) {
    setReview((r) => r ? { ...r, biasFlags: r.biasFlags.map((b, i) => i === idx ? { ...b, ...update } : b) } : r);
  }

  async function loadSamples() {
    if (samples.length) return;
    const res = await fetch("/api/samples");
    if (res.ok) {
      const data = (await res.json()) as { transcripts: Sample[] };
      setSamples(data.transcripts);
    }
  }

  function applySample(s: Sample) {
    setTranscript(s.transcript);
    setFellowName(s.fellow.name);
    setSupervisor(`${s.supervisor.name}${s.supervisor.role ? ` (${s.supervisor.role})` : ""}`);
    setCompany(s.company.name);
    setAnalysis(null);
    setError(null);
  }

  function run() {
    setError(null);
    setAnalysis(null);
    setThinkingText("");
    setConnected(false);
    setStreaming(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    startTransition(async () => {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            fellowName: fellowName || undefined,
            supervisor: supervisor || undefined,
            company: company || undefined,
            model: model || undefined,
            save,
          }),
          signal,
        });

        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Analysis failed");
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.replace(/^data: /, "").trim();
            if (!line) continue;
            try {
              const evt = JSON.parse(line) as
                | { type: "ping" }
                | { type: "token"; text: string }
                | { type: "result"; analysis: Analysis; model: string }
                | { type: "error"; message: string };
              if (evt.type === "ping") {
                setConnected(true);
              } else if (evt.type === "token") {
                setThinkingText((t) => t + evt.text);
              } else if (evt.type === "result") {
                setAnalysis(evt.analysis);
                setUsedModel(evt.model);
                setStreaming(false);
              } else if (evt.type === "error") {
                setError(evt.message);
                setStreaming(false);
              }
            } catch {
              // malformed SSE line — skip
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Analysis failed");
        }
        setStreaming(false);
      }
    });
  }

  return (
    <>
      <div className="flex h-full overflow-hidden divide-x divide-border">
        {/* ── LEFT PANEL: input form ────────────────────── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-5 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5" />
                      Supervisor transcript
                    </CardTitle>
                    <CardDescription>Paste the call transcript. Add metadata if you know it.</CardDescription>
                  </div>
                  <SampleMenu samples={samples} onOpen={loadSamples} onPick={applySample} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Fellow name" value={fellowName} onChange={setFellowName} placeholder="e.g. Karthik Narayanan" />
                  <Field label="Company" value={company} onChange={setCompany} placeholder="e.g. Veerabhadra Auto" />
                  <Field label="Supervisor" value={supervisor} onChange={setSupervisor} placeholder="e.g. Mr. Suresh Patil" />
                  <Field label="Groq model (optional)" value={model} onChange={setModel} placeholder="default: llama-3.3-70b-versatile" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transcript">Transcript</Label>
                  <Textarea
                    id="transcript"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Paste the full supervisor transcript here…"
                    className="min-h-70 font-mono text-[13px] leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{transcript.length.toLocaleString()} characters</span>
                    <span>≈ {Math.max(1, Math.ceil(transcript.split(/\s+/).filter(Boolean).length / 130))} min read</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button onClick={run} disabled={streaming || transcript.trim().length < 50} size="lg">
                    {streaming ? (
                      <>
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <PlayIcon className="h-4 w-4" />
                        Run analysis
                      </>
                    )}
                  </Button>
                  {streaming ? (
                    <button
                      type="button"
                      onClick={() => { abortRef.current?.abort(); setStreaming(false); }}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Cancel
                    </button>
                  ) : null}
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
                    <input
                      type="checkbox"
                      checked={save}
                      onChange={(e) => setSave(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-accent"
                    />
                    Save to history
                  </label>
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </div>
                ) : null}
              </CardContent>
            </Card>
            {transcript ? <TranscriptCard transcript={transcript} highlight={highlightQuote} /> : null}
          </div>
        </div>

        {/* ── RIGHT PANEL: output ───────────────────────── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-5">
            <AnimatePresence mode="wait">
              {streaming ? (
                <ThinkingBox key="thinking" text={thinkingText} connected={connected} />
              ) : analysis ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <ScoreCard analysis={analysis} model={usedModel} review={review?.score ?? null} onUpdate={updateScoreReview} />
                  <EvidenceCard
                    analysis={analysis}
                    transcript={transcript}
                    onHover={setHighlightQuote}
                    highlight={highlightQuote}
                    review={review?.evidence ?? null}
                    onUpdate={updateEvidenceReview}
                  />
                  <KpiCard analysis={analysis} review={review?.kpiMapping ?? null} onUpdate={updateKpiReview} />
                  <GapsCard analysis={analysis} review={review?.gaps ?? null} onUpdate={updateGapReview} />
                  <FollowUpCard analysis={analysis} review={review?.followUpQuestions ?? null} onUpdate={updateFollowUpReview} />
                  {analysis.biasFlags.length > 0 ? <BiasCard analysis={analysis} review={review?.biasFlags ?? null} onUpdate={updateBiasFlagReview} /> : null}
                  {review && <ReviewProgress review={review} onFinalize={() => setShowFinal(true)} />}
                </motion.div>
              ) : (
                <EmptyState key="empty" />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {showFinal && analysis && review && (
        <FinalizedModal
          analysis={analysis}
          review={review}
          fellowName={fellowName}
          company={company}
          supervisor={supervisor}
          onClose={() => setShowFinal(false)}
        />
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function SampleMenu({
  samples,
  onOpen,
  onPick,
}: {
  samples: Sample[];
  onOpen: () => void;
  onPick: (s: Sample) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => {
          onOpen();
          setOpen((v) => !v);
        }}
      >
        <SparklesIcon className="h-4 w-4" />
        Load sample
        {open ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-border bg-card p-1 shadow-lg">
          {samples.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
          ) : (
            samples.map((s) => (
              <button
                key={s.id}
                type="button"
                className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{s.fellow.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.company.name}
                  {s.company.industry ? ` · ${s.company.industry}` : ""}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function ConfidencePill({ confidence }: { confidence: "low" | "medium" | "high" }) {
  const map: Record<string, string> = {
    low: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    medium: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
    high: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", map[confidence])}>
      {confidence} confidence
    </span>
  );
}

function ScoreCard({
  analysis,
  model,
  review,
  onUpdate,
}: {
  analysis: Analysis;
  model: string | null;
  review: ScoreReview | null;
  onUpdate: (u: Partial<ScoreReview>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const effectiveScore = review?.editedValue ?? analysis.score.value;
  const effectiveJust = review?.editedJustification ?? analysis.score.justification;
  const state = review?.state ?? "pending";
  const [editVal, setEditVal] = useState(effectiveScore);
  const [editJust, setEditJust] = useState(effectiveJust);

  function openEdit() {
    setEditVal(effectiveScore);
    setEditJust(effectiveJust);
    setEditing(true);
  }
  function saveEdit() {
    onUpdate({ state: "accepted", editedValue: editVal, editedJustification: editJust });
    setEditing(false);
  }

  return (
    <Card className={cn("card-hover", state === "accepted" && "border-emerald-400 dark:border-emerald-700", state === "rejected" && "opacity-60")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base text-muted-foreground">Suggested rubric score</CardTitle>
            <div className={cn("mt-2 flex items-baseline gap-3", state === "rejected" && "line-through decoration-red-500")}>
              <span className={cn("rounded-2xl px-4 py-2 text-4xl font-bold tabular-nums", bandClass(effectiveScore))}>{effectiveScore}</span>
              <div>
                <div className="text-lg font-semibold">{analysis.score.label}</div>
                <div className="text-xs text-muted-foreground">{analysis.score.band}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ConfidencePill confidence={analysis.score.confidence} />
            {model ? (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {model}
              </span>
            ) : null}
            {review && (
              <FindingControls
                state={state}
                onAccept={() => { onUpdate({ state: "accepted" }); setEditing(false); }}
                onReject={() => { onUpdate({ state: "rejected" }); setEditing(false); }}
                onEdit={openEdit}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {editing && (
          <div className="mb-3 space-y-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/30">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium whitespace-nowrap">Score (1–10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={editVal}
                onChange={(e) => setEditVal(Math.max(1, Math.min(10, Number(e.target.value))))}
                className="w-16 rounded border border-border bg-background px-2 py-1 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Justification</label>
              <textarea
                value={editJust}
                onChange={(e) => setEditJust(e.target.value)}
                rows={4}
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm leading-relaxed"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={saveEdit} className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </div>
        )}
        <p className={cn("text-sm leading-relaxed text-foreground/80", state === "rejected" && "line-through decoration-red-400")}>{effectiveJust}</p>
        {state === "accepted" ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            <strong className="font-medium">✓ Accepted{review?.editedValue !== null ? " (edited)" : ""}.</strong> Intern has reviewed this score.
          </div>
        ) : state === "rejected" ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-xs text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            <strong className="font-medium">✕ Rejected.</strong> Intern has dismissed this score suggestion.
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <strong className="font-medium">Draft, not verdict.</strong> Accept, reject, or edit before finalizing.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function signalBadge(signal: Evidence["signal"]) {
  if (signal === "positive") return <Badge variant="success">positive</Badge>;
  if (signal === "negative") return <Badge variant="danger">negative</Badge>;
  return <Badge variant="outline">neutral</Badge>;
}

function EvidenceCard({
  analysis,
  onHover,
  highlight,
  review,
  onUpdate,
}: {
  analysis: Analysis;
  transcript: string;
  onHover: (q: string | null) => void;
  highlight: string | null;
  review: EvidenceReview[] | null;
  onUpdate: (idx: number, u: Partial<EvidenceReview>) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editSignal, setEditSignal] = useState<Evidence["signal"]>("neutral");
  const [editInterp, setEditInterp] = useState("");

  function openEdit(i: number, e: Evidence, r: EvidenceReview) {
    setEditSignal(r.editedSignal ?? e.signal);
    setEditInterp(r.editedInterpretation ?? e.interpretation);
    setEditingIdx(i);
  }
  function saveEdit(i: number) {
    onUpdate(i, { state: "accepted", editedSignal: editSignal, editedInterpretation: editInterp });
    setEditingIdx(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
          Evidence ({analysis.evidence.length})
        </CardTitle>
        <CardDescription>Hover a quote to highlight it in the transcript. Accept, reject, or edit each piece of evidence.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {analysis.evidence.map((e, i) => {
          const r = review?.[i];
          const state = r?.state ?? "pending";
          const effSignal = r?.editedSignal ?? e.signal;
          const effInterp = r?.editedInterpretation ?? e.interpretation;
          return (
            <div
              key={i}
              onMouseEnter={() => state !== "rejected" && onHover(e.quote)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "rounded-lg border p-3 transition",
                state === "accepted" && "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20",
                state === "rejected" && "border-border opacity-50",
                state === "pending" && highlight === e.quote && "border-accent ring-1 ring-accent/40",
                state === "pending" && highlight !== e.quote && "border-border"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {signalBadge(effSignal)}
                  <Badge variant="outline">{DIMENSION_LABEL[e.dimension] ?? e.dimension}</Badge>
                </div>
                {r && (
                  <FindingControls
                    state={state}
                    onAccept={() => { onUpdate(i, { state: "accepted" }); setEditingIdx(null); }}
                    onReject={() => { onUpdate(i, { state: "rejected" }); setEditingIdx(null); }}
                    onEdit={() => editingIdx === i ? setEditingIdx(null) : openEdit(i, e, r)}
                  />
                )}
              </div>
              <blockquote className={cn("border-l-2 border-border pl-3 text-sm italic text-foreground/90", state === "rejected" && "line-through decoration-red-400")}>
                &ldquo;{e.quote}&rdquo;
              </blockquote>
              {editingIdx === i ? (
                <div className="mt-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/30">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium">Signal</label>
                    <select
                      value={editSignal}
                      onChange={(e) => setEditSignal(e.target.value as Evidence["signal"])}
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                    >
                      <option value="positive">positive</option>
                      <option value="negative">negative</option>
                      <option value="neutral">neutral</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Interpretation</label>
                    <textarea
                      value={editInterp}
                      onChange={(e) => setEditInterp(e.target.value)}
                      rows={3}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-xs leading-relaxed"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => saveEdit(i)} className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">Save</button>
                    <button type="button" onClick={() => setEditingIdx(null)} className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className={cn("mt-2 text-xs text-muted-foreground", state === "rejected" && "line-through decoration-red-400")}>{effInterp}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  analysis,
  review,
  onUpdate,
}: {
  analysis: Analysis;
  review: KpiReview[] | null;
  onUpdate: (idx: number, u: Partial<KpiReview>) => void;
}) {
  if (analysis.kpiMapping.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">KPI mapping</CardTitle>
        <CardDescription>Which business outcomes the supervisor is describing. Accept or reject each mapping.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {analysis.kpiMapping.map((k, i) => {
          const r = review?.[i];
          const state = r?.state ?? "pending";
          return (
            <div key={i} className={cn(
              "rounded-lg border p-3 transition",
              state === "accepted" && "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20",
              state === "rejected" && "border-border opacity-50",
              state === "pending" && "border-border"
            )}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge>{KPI_LABEL[k.kpi] ?? k.kpi}</Badge>
                  <span className={cn("text-xs font-medium", k.systemOrPersonal === "system" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>
                    {k.systemOrPersonal === "system" ? "system" : "personal"}
                  </span>
                </div>
                {r && (
                  <FindingControls
                    state={state}
                    onAccept={() => onUpdate(i, { state: "accepted" })}
                    onReject={() => onUpdate(i, { state: "rejected" })}
                  />
                )}
              </div>
              <p className={cn("mt-2 text-sm text-foreground/80", state === "rejected" && "line-through decoration-red-400")}>{k.evidence}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function GapsCard({
  analysis,
  review,
  onUpdate,
}: {
  analysis: Analysis;
  review: GapReview[] | null;
  onUpdate: (idx: number, u: Partial<GapReview>) => void;
}) {
  if (analysis.gaps.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
          What the transcript didn&apos;t cover
        </CardTitle>
        <CardDescription>Gaps the next call should fill. Accept or reject each identified gap.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {analysis.gaps.map((g, i) => {
          const r = review?.[i];
          const state = r?.state ?? "pending";
          return (
            <div key={i} className={cn(
              "rounded-lg border p-3 transition",
              state === "accepted" && "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20",
              state === "rejected" && "border-border opacity-50",
              state === "pending" && "border-border"
            )}>
              <div className="flex items-center justify-between gap-2">
                <div className={cn("text-sm font-medium", state === "rejected" && "line-through decoration-red-400")}>
                  {DIMENSION_LABEL[g.dimension] ?? g.dimension}
                </div>
                {r && (
                  <FindingControls
                    state={state}
                    onAccept={() => onUpdate(i, { state: "accepted" })}
                    onReject={() => onUpdate(i, { state: "rejected" })}
                  />
                )}
              </div>
              <p className={cn("mt-1 text-sm text-muted-foreground", state === "rejected" && "line-through decoration-red-400")}>{g.detail}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FollowUpCard({
  analysis,
  review,
  onUpdate,
}: {
  analysis: Analysis;
  review: FollowUpReview[] | null;
  onUpdate: (idx: number, u: Partial<FollowUpReview>) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editQ, setEditQ] = useState("");

  if (analysis.followUpQuestions.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LightBulbIcon className="h-5 w-5 text-accent" />
          Suggested follow-up questions
        </CardTitle>
        <CardDescription>Use these in the next call to close the gaps. Accept, reject, or reword each question.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {analysis.followUpQuestions.map((q, i) => {
          const r = review?.[i];
          const state = r?.state ?? "pending";
          const effQ = r?.editedQuestion ?? q.question;
          return (
            <div key={i} className={cn(
              "rounded-lg border p-3 transition",
              state === "accepted" && "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20",
              state === "rejected" && "border-border opacity-50",
              state === "pending" && "border-border"
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <CheckCircleIcon className={cn("mt-0.5 h-4 w-4 shrink-0", state === "accepted" ? "text-emerald-500" : state === "rejected" ? "text-muted-foreground" : "text-emerald-500")} />
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", state === "rejected" && "line-through decoration-red-400")}>{effQ}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{DIMENSION_LABEL[q.targetGap] ?? q.targetGap}</Badge>
                      <span>Looking for: {q.lookingFor}</span>
                    </div>
                  </div>
                </div>
                {r && (
                  <FindingControls
                    state={state}
                    onAccept={() => { onUpdate(i, { state: "accepted" }); setEditingIdx(null); }}
                    onReject={() => { onUpdate(i, { state: "rejected" }); setEditingIdx(null); }}
                    onEdit={() => {
                      if (editingIdx === i) { setEditingIdx(null); return; }
                      setEditQ(effQ);
                      setEditingIdx(i);
                    }}
                  />
                )}
              </div>
              {editingIdx === i && (
                <div className="mt-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/30">
                  <label className="text-xs font-medium">Question text</label>
                  <textarea
                    value={editQ}
                    onChange={(e) => setEditQ(e.target.value)}
                    rows={3}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm leading-relaxed"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { onUpdate(i, { state: "accepted", editedQuestion: editQ }); setEditingIdx(null); }} className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">Save</button>
                    <button type="button" onClick={() => setEditingIdx(null)} className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function BiasCard({
  analysis,
  review,
  onUpdate,
}: {
  analysis: Analysis;
  review: BiasFlagReview[] | null;
  onUpdate: (idx: number, u: Partial<BiasFlagReview>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Potential supervisor biases</CardTitle>
        <CardDescription>Biases to weigh before finalizing. Accept (flagging it as worth noting) or reject (dismissing it).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {analysis.biasFlags.map((b, i) => {
          const r = review?.[i];
          const state = r?.state ?? "pending";
          return (
            <div key={i} className={cn(
              "rounded-lg border p-3 transition",
              state === "accepted" && "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20",
              state === "rejected" && "border-border opacity-50",
              state === "pending" && "border-border"
            )}>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="warning">{b.bias}</Badge>
                {r && (
                  <FindingControls
                    state={state}
                    onAccept={() => onUpdate(i, { state: "accepted" })}
                    onReject={() => onUpdate(i, { state: "rejected" })}
                  />
                )}
              </div>
              <p className={cn("mt-1 text-sm text-muted-foreground", state === "rejected" && "line-through decoration-red-400")}>{b.detail}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Shared review controls ────────────────────────────────────────────────────
function FindingControls({
  state,
  onAccept,
  onReject,
  onEdit,
}: {
  state: FindingState;
  onAccept: () => void;
  onReject: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={onAccept}
        title="Accept"
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border text-xs transition-all",
          state === "accepted"
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-border text-muted-foreground hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
        )}
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onReject}
        title="Reject"
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border text-xs transition-all",
          state === "rejected"
            ? "border-red-500 bg-red-500 text-white"
            : "border-border text-muted-foreground hover:border-red-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
        )}
      >
        ✕
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Edit"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40"
        >
          ✎
        </button>
      )}
    </div>
  );
}

// ── Finalized analysis builder ────────────────────────────────────────────────
function buildFinalizedAnalysis(analysis: Analysis, review: ReviewState): Analysis {
  return {
    score: {
      ...analysis.score,
      value: review.score.editedValue ?? analysis.score.value,
      justification: review.score.editedJustification ?? analysis.score.justification,
    },
    evidence: analysis.evidence
      .map((e, i) => ({
        ...e,
        signal: review.evidence[i]?.editedSignal ?? e.signal,
        interpretation: review.evidence[i]?.editedInterpretation ?? e.interpretation,
      }))
      .filter((_, i) => (review.evidence[i]?.state ?? "pending") !== "rejected"),
    kpiMapping: analysis.kpiMapping.filter(
      (_, i) => (review.kpiMapping[i]?.state ?? "pending") !== "rejected"
    ),
    gaps: analysis.gaps.filter(
      (_, i) => (review.gaps[i]?.state ?? "pending") !== "rejected"
    ),
    followUpQuestions: analysis.followUpQuestions
      .map((q, i) => ({ ...q, question: review.followUpQuestions[i]?.editedQuestion ?? q.question }))
      .filter((_, i) => (review.followUpQuestions[i]?.state ?? "pending") !== "rejected"),
    biasFlags: analysis.biasFlags.filter(
      (_, i) => (review.biasFlags[i]?.state ?? "pending") !== "rejected"
    ),
  };
}

// ── Finalized summary modal ───────────────────────────────────────────────────
function FinalizedModal({
  analysis,
  review,
  fellowName,
  company,
  supervisor,
  onClose,
}: {
  analysis: Analysis;
  review: ReviewState;
  fellowName: string;
  company: string;
  supervisor: string;
  onClose: () => void;
}) {
  const final = buildFinalizedAnalysis(analysis, review);
  const scoreEdited = review.score.editedValue !== null || review.score.editedJustification !== null;

  const textReport = [
    `TRINETHRA — FINALIZED ASSESSMENT`,
    `Fellow: ${fellowName || "—"}  |  Company: ${company || "—"}  |  Supervisor: ${supervisor || "—"}`,
    ``,
    `SCORE: ${final.score.value}/10 — ${final.score.label} (${final.score.band})`,
    `Confidence: ${final.score.confidence}`,
    `Justification: ${final.score.justification}`,
    ``,
    `EVIDENCE (${final.evidence.length} accepted)`,
    ...final.evidence.map((e) => `  [${e.signal.toUpperCase()}] "${e.quote}"\n  → ${e.interpretation}`),
    ``,
    `KPI MAPPING`,
    ...final.kpiMapping.map((k) => `  • ${KPI_LABEL[k.kpi] ?? k.kpi} (${k.systemOrPersonal}): ${k.evidence}`),
    ``,
    `GAPS TO PROBE`,
    ...final.gaps.map((g) => `  • ${DIMENSION_LABEL[g.dimension] ?? g.dimension}: ${g.detail}`),
    ``,
    `FOLLOW-UP QUESTIONS`,
    ...final.followUpQuestions.map((q, i) => `  ${i + 1}. ${q.question}`),
    ``,
    `BIAS FLAGS`,
    ...final.biasFlags.map((b) => `  • ${b.bias}: ${b.detail}`),
  ].join("\n");

  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(textReport).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-4 overflow-y-auto backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Finalized assessment</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Intern-reviewed draft — rejected findings removed, edits applied.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/70 transition-colors"
            >
              {copied ? "✓ Copied!" : "Copy as text"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/70 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Meta */}
          {(fellowName || company || supervisor) && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {fellowName && <span><strong>Fellow:</strong> {fellowName}</span>}
              {company && <span><strong>Company:</strong> {company}</span>}
              {supervisor && <span><strong>Supervisor:</strong> {supervisor}</span>}
            </div>
          )}

          {/* Score */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Score</h3>
            <div className={cn("flex items-baseline gap-3 rounded-xl p-4", bandClass(final.score.value))}>
              <span className="text-4xl font-bold tabular-nums">{final.score.value}</span>
              <div>
                <div className="font-semibold">{final.score.label}</div>
                <div className="text-xs opacity-80">{final.score.band}</div>
              </div>
              {scoreEdited && (
                <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                  edited by intern
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-foreground/80 leading-relaxed">{final.score.justification}</p>
          </section>

          {/* Evidence */}
          {final.evidence.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Evidence ({final.evidence.length})
              </h3>
              <div className="space-y-2">
                {final.evidence.map((e, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      {signalBadge(e.signal)}
                      <Badge variant="outline">{DIMENSION_LABEL[e.dimension] ?? e.dimension}</Badge>
                    </div>
                    <blockquote className="border-l-2 border-border pl-3 text-sm italic text-foreground/90">&ldquo;{e.quote}&rdquo;</blockquote>
                    <p className="mt-1.5 text-xs text-muted-foreground">{e.interpretation}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* KPI */}
          {final.kpiMapping.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">KPI mapping</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {final.kpiMapping.map((k, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge>{KPI_LABEL[k.kpi] ?? k.kpi}</Badge>
                      <span className={cn("text-xs font-medium", k.systemOrPersonal === "system" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>
                        {k.systemOrPersonal}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80">{k.evidence}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Gaps */}
          {final.gaps.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Gaps to probe</h3>
              <div className="space-y-2">
                {final.gaps.map((g, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="text-sm font-medium">{DIMENSION_LABEL[g.dimension] ?? g.dimension}</div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{g.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Follow-up questions */}
          {final.followUpQuestions.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Follow-up questions</h3>
              <ol className="space-y-2 list-none">
                {final.followUpQuestions.map((q, i) => (
                  <li key={i} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{i + 1}. {q.question}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Target gap: {DIMENSION_LABEL[q.targetGap] ?? q.targetGap} · Looking for: {q.lookingFor}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Bias flags */}
          {final.biasFlags.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bias flags</h3>
              <div className="space-y-2">
                {final.biasFlags.map((b, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <Badge variant="warning">{b.bias}</Badge>
                    <p className="mt-1 text-sm text-muted-foreground">{b.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Finalized by intern review · {new Date().toLocaleDateString()} · Rejected findings removed · Edits applied
        </div>
      </div>
    </div>
  );
}

function ReviewProgress({ review, onFinalize }: { review: ReviewState; onFinalize: () => void }) {
  const items: FindingState[] = [
    review.score.state,
    ...review.evidence.map((e) => e.state),
    ...review.kpiMapping.map((k) => k.state),
    ...review.gaps.map((g) => g.state),
    ...review.followUpQuestions.map((q) => q.state),
    ...review.biasFlags.map((b) => b.state),
  ];
  const total = items.length;
  const accepted = items.filter((s) => s === "accepted").length;
  const rejected = items.filter((s) => s === "rejected").length;
  const done = accepted + rejected;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
        <span className="font-medium">Review progress</span>
        <span>{done}/{total} reviewed · {accepted} accepted · {rejected} rejected</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", done === total ? "bg-emerald-500" : "bg-blue-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {done === total && done > 0 && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            ✓ All findings reviewed — ready to finalize.
          </p>
          <button
            type="button"
            onClick={onFinalize}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Finalize →
          </button>
        </div>
      )}
    </div>
  );
}

function TranscriptCard({ transcript, highlight }: { transcript: string; highlight: string | null }) {
  const markRef = useRef<HTMLElement | null>(null);
  const segments = useMemo(() => {
    if (!highlight) return [{ text: transcript, hit: false }];
    const idx = transcript.indexOf(highlight);
    if (idx === -1) return [{ text: transcript, hit: false }];
    return [
      { text: transcript.slice(0, idx), hit: false },
      { text: transcript.slice(idx, idx + highlight.length), hit: true },
      { text: transcript.slice(idx + highlight.length), hit: false },
    ];
  }, [transcript, highlight]);

  useEffect(() => {
    if (highlight && markRef.current) {
      markRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlight]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookmarkIcon className="h-5 w-5" />
          Transcript
        </CardTitle>
        <CardDescription>Hover an evidence quote on the right to highlight it here.</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap wrap-break-word font-sans text-[13px] leading-relaxed text-foreground/90">
          {segments.map((s, i) =>
            s.hit ? (
              <mark key={i} ref={(el) => { markRef.current = el; }} className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-900/60">
                {s.text}
              </mark>
            ) : (
              <span key={i}>{s.text}</span>
            )
          )}
        </pre>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-100 items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center"
    >
      <div className="max-w-sm space-y-2">
        <SparklesIcon className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="text-base font-medium">No analysis yet</h3>
        <p className="text-sm text-muted-foreground">
          Paste a transcript on the left and click <strong>Run analysis</strong>. Groq will
          extract evidence, suggest a rubric score, and flag gaps. Output streams in here.
        </p>
      </div>
    </motion.div>
  );
}

function ThinkingBox({ text, connected }: { text: string; connected: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll as tokens arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [text]);

  const hasTokens = text.length > 0;
  const estTotal = 2400;
  const pct = hasTokens ? Math.min(98, Math.round((text.length / estTotal) * 100)) : 0;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const elapsedStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const phase = !connected
    ? "Connecting to Groq…"
    : !hasTokens
      ? "Model is thinking…"
      : "Streaming response…";

  return (
    <motion.div
      key="thinking"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-3"
    >
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ArrowPathIcon className="h-4 w-4 animate-spin text-accent" />
            {phase}
          </div>
          {/* always show elapsed so user knows it's alive */}
          <span className="tabular-nums text-xs text-muted-foreground">{elapsedStr}</span>
        </div>

        {/* progress bar */}
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          {hasTokens ? (
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          ) : (
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent/40" />
          )}
        </div>

        {/* status badges */}
        <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
          <span className={cn(
            "rounded-full border px-2 py-0.5 font-medium",
            connected
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          )}>
            {connected ? "✓ Connected" : "Connecting…"}
          </span>
          <span className={cn(
            "rounded-full border px-2 py-0.5 font-medium",
            hasTokens
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-border bg-muted text-muted-foreground"
          )}>
            {hasTokens ? `✓ ${text.length} chars` : "Waiting for first token…"}
          </span>
        </div>

        {hasTokens ? (
          <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {text}
            <div ref={bottomRef} />
          </pre>
        ) : (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              {connected
                ? "Groq is generating the analysis JSON. This is usually very fast — tokens appear here as they stream in."
                : "Establishing connection to Groq…"}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
