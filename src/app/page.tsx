import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  BeakerIcon,
  ChartBarIcon,
  EyeIcon,
  LockClosedIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-16">
        <section className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <SparklesIcon className="h-3.5 w-3.5" />
              DeepThought · Trinethra module
            </span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Turn 60-minute supervisor calls into a 10-minute structured review.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Paste a supervisor transcript. A local LLM (Ollama) extracts evidence,
              suggests a 1–10 rubric score, maps work to the 8 business KPIs, flags
              what the supervisor didn&apos;t cover, and writes follow-up questions.
              You stay in charge — the tool drafts, you decide.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/register">
                <Button size="lg">Create your account</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Sign in
                </Button>
              </Link>
            </div>
            <ul className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <BeakerIcon className="mt-0.5 h-4 w-4 text-accent" />
                Local Ollama — no cloud, no leaked transcripts
              </li>
              <li className="flex items-start gap-2">
                <ChartBarIcon className="mt-0.5 h-4 w-4 text-accent" />
                Rubric-grounded scoring with bias flags
              </li>
              <li className="flex items-start gap-2">
                <EyeIcon className="mt-0.5 h-4 w-4 text-accent" />
                Evidence-linked: every score cites a quote
              </li>
              <li className="flex items-start gap-2">
                <LockClosedIcon className="mt-0.5 h-4 w-4 text-accent" />
                Email + password or Google sign-in
              </li>
            </ul>
          </div>
          <div className="relative">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-xl card-hover">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Suggested score
                </span>
                <span className="rounded-full band-prod px-3 py-1 text-xs font-semibold">
                  6 · Reliable and Productive
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/80">
                &ldquo;He helps me with production tracking. Every evening he updates the
                sheet and sends it on WhatsApp.&rdquo; — supervisor describes strong task
                execution, but the system depends entirely on the Fellow being there.
                The 6→7 boundary is not crossed.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-muted p-3">
                  <div className="font-medium">Evidence</div>
                  <div className="text-muted-foreground">6 quotes</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="font-medium">KPIs</div>
                  <div className="text-muted-foreground">Quality, TAT</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="font-medium">Gaps</div>
                  <div className="text-muted-foreground">2 dimensions</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
