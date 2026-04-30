"use client";

import { useState, useTransition, useMemo } from "react";
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

type RecentItem = {
  id: string;
  fellowName: string | null;
  company: string | null;
  model: string;
  createdAt: string;
  result: unknown;
};

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

export function Analyzer({ recent }: { recent: RecentItem[] }) {
  const [transcript, setTranscript] = useState("");
  const [fellowName, setFellowName] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [company, setCompany] = useState("");
  const [model, setModel] = useState(""); // empty -> server default
  const [save, setSave] = useState(true);

  const [samples, setSamples] = useState<Sample[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [highlightQuote, setHighlightQuote] = useState<string | null>(null);

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
    startTransition(async () => {
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
      });
      const data = (await res.json().catch(() => ({}))) as
        | { ok: true; analysis: Analysis; model: string }
        | { error: string };
      if (!res.ok || !("ok" in data)) {
        setError("error" in data ? data.error : "Analysis failed");
        return;
      }
      setAnalysis(data.analysis);
      setUsedModel(data.model);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* LEFT: input */}
      <div className="space-y-4">
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
              <Field label="Company" value={company} onChange={setCompany} placeholder="e.g. Veerabhadra Auto Components" />
              <Field label="Supervisor" value={supervisor} onChange={setSupervisor} placeholder="e.g. Mr. Suresh Patil (Founder)" />
              <Field label="Ollama model (optional)" value={model} onChange={setModel} placeholder="default: server config" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transcript">Transcript</Label>
              <Textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste the full supervisor transcript here…"
                className="min-h-[280px] font-mono text-[13px] leading-relaxed"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{transcript.length.toLocaleString()} characters</span>
                <span>≈ {Math.max(1, Math.ceil(transcript.split(/\s+/).filter(Boolean).length / 130))} min read</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={run} disabled={pending || transcript.trim().length < 50} size="lg">
                {pending ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Running local LLM…
                  </>
                ) : (
                  <>
                    <PlayIcon className="h-4 w-4" />
                    Run analysis
                  </>
                )}
              </Button>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={save}
                  onChange={(e) => setSave(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-[rgb(var(--accent))]"
                />
                Save to my history
              </label>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {recent.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent analyses</CardTitle>
              <CardDescription>Click to load the result.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recent.map((r) => {
                const a = r.result as Analysis | null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      if (a) {
                        setAnalysis(a);
                        setUsedModel(r.model);
                        setFellowName(r.fellowName ?? "");
                        setCompany(r.company ?? "");
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <div>
                      <div className="font-medium">
                        {r.fellowName ?? "Unnamed Fellow"}
                        {r.company ? <span className="text-muted-foreground"> · {r.company}</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()} · {r.model}
                      </div>
                    </div>
                    {a ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", bandClass(a.score.value))}>
                        {a.score.value}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* RIGHT: output */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {pending ? (
            <SkeletonResult key="skeleton" />
          ) : analysis ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <ScoreCard analysis={analysis} model={usedModel} />
              <EvidenceCard
                analysis={analysis}
                transcript={transcript}
                onHover={setHighlightQuote}
                highlight={highlightQuote}
              />
              <KpiCard analysis={analysis} />
              <GapsCard analysis={analysis} />
              <FollowUpCard analysis={analysis} />
              {analysis.biasFlags.length > 0 ? <BiasCard analysis={analysis} /> : null}
              {transcript ? <TranscriptCard transcript={transcript} highlight={highlightQuote} /> : null}
            </motion.div>
          ) : (
            <EmptyState key="empty" />
          )}
        </AnimatePresence>
      </div>
    </div>
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

function ScoreCard({ analysis, model }: { analysis: Analysis; model: string | null }) {
  const v = analysis.score.value;
  return (
    <Card className="card-hover">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base text-muted-foreground">Suggested rubric score</CardTitle>
            <div className="mt-2 flex items-baseline gap-3">
              <span className={cn("rounded-2xl px-4 py-2 text-4xl font-bold tabular-nums", bandClass(v))}>{v}</span>
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
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground/80">{analysis.score.justification}</p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <strong className="font-medium">Draft, not verdict.</strong> The intern reviews and edits before this is final.
        </div>
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
}: {
  analysis: Analysis;
  transcript: string;
  onHover: (q: string | null) => void;
  highlight: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
          Evidence ({analysis.evidence.length})
        </CardTitle>
        <CardDescription>Hover a quote to highlight it in the transcript below.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {analysis.evidence.map((e, i) => (
          <div
            key={i}
            onMouseEnter={() => onHover(e.quote)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "rounded-lg border border-border p-3 transition",
              highlight === e.quote && "border-accent ring-1 ring-accent/40"
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              {signalBadge(e.signal)}
              <Badge variant="outline">{DIMENSION_LABEL[e.dimension] ?? e.dimension}</Badge>
            </div>
            <blockquote className="border-l-2 border-border pl-3 text-sm italic text-foreground/90">
              &ldquo;{e.quote}&rdquo;
            </blockquote>
            <p className="mt-2 text-xs text-muted-foreground">{e.interpretation}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function KpiCard({ analysis }: { analysis: Analysis }) {
  if (analysis.kpiMapping.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">KPI mapping</CardTitle>
        <CardDescription>Which business outcomes the supervisor is describing.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {analysis.kpiMapping.map((k, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Badge>{KPI_LABEL[k.kpi] ?? k.kpi}</Badge>
              <span
                className={cn(
                  "text-xs font-medium",
                  k.systemOrPersonal === "system" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
                )}
              >
                {k.systemOrPersonal === "system" ? "system" : "personal"}
              </span>
            </div>
            <p className="mt-2 text-sm text-foreground/80">{k.evidence}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GapsCard({ analysis }: { analysis: Analysis }) {
  if (analysis.gaps.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
          What the transcript didn&apos;t cover
        </CardTitle>
        <CardDescription>Gaps the next call should fill.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {analysis.gaps.map((g, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="text-sm font-medium">{DIMENSION_LABEL[g.dimension] ?? g.dimension}</div>
            <p className="mt-1 text-sm text-muted-foreground">{g.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FollowUpCard({ analysis }: { analysis: Analysis }) {
  if (analysis.followUpQuestions.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LightBulbIcon className="h-5 w-5 text-accent" />
          Suggested follow-up questions
        </CardTitle>
        <CardDescription>Use these in the next call to close the gaps.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {analysis.followUpQuestions.map((q, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">{q.question}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{DIMENSION_LABEL[q.targetGap] ?? q.targetGap}</Badge>
                  <span>Looking for: {q.lookingFor}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BiasCard({ analysis }: { analysis: Analysis }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Potential supervisor biases</CardTitle>
        <CardDescription>Things to weigh when finalizing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {analysis.biasFlags.map((b, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <Badge variant="warning">{b.bias}</Badge>
            <p className="mt-1 text-sm text-muted-foreground">{b.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TranscriptCard({ transcript, highlight }: { transcript: string; highlight: string | null }) {
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookmarkIcon className="h-5 w-5" />
          Transcript
        </CardTitle>
        <CardDescription>Hover an evidence quote above to find it here.</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-foreground/90">
          {segments.map((s, i) =>
            s.hit ? (
              <mark key={i} className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-900/60">
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
      className="flex h-[400px] items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center"
    >
      <div className="max-w-sm space-y-2">
        <SparklesIcon className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="text-base font-medium">No analysis yet</h3>
        <p className="text-sm text-muted-foreground">
          Paste a transcript and click <strong>Run analysis</strong>. The local Ollama model will
          extract evidence, suggest a score, and flag gaps. Output appears here.
        </p>
      </div>
    </motion.div>
  );
}

function SkeletonResult() {
  return (
    <motion.div
      key="sk"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </motion.div>
  );
}
