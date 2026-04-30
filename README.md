# Trinethra — Supervisor Feedback Analyzer

> A full-stack web app that turns a 45-minute manual transcript review into a
> **10-minute AI-assisted workflow** for psychology interns at DeepThought.
> Paste a supervisor call transcript → get an evidence-grounded performance
> draft in seconds, powered by **Groq** (cloud, instant) with a local
> **Ollama** fallback.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748)](https://prisma.io)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com)
[![Groq](https://img.shields.io/badge/LLM-Groq-f55036)](https://console.groq.com)

---

## Background

DeepThought places operating Fellows inside Indian manufacturing MSMEs for 3–6
months. Every few weeks a psychology intern calls the client supervisor, records
a 10–15 minute transcript, and manually writes a structured performance review
against a 1–10 rubric. **This takes 45–60 minutes per transcript.**

**Trinethra** is the AI-assisted layer that turns that transcript into a
structured draft in under 10 seconds — so the intern spends their time
reviewing and deciding, not extracting and formatting.

---

## What the analysis produces

| Output                  | Description                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Score (1–10)**        | Rubric label, band (Need Attention / Productivity / Performance), confidence level, and a justification paragraph citing direct evidence  |
| **Evidence**            | Verbatim quotes from the transcript tagged positive / negative / neutral, each mapped to an assessment dimension                          |
| **KPI Mapping**         | Which of the 8 business KPIs the Fellow's work connects to; marked `system` (survives the Fellow leaving) or `personal` (depends on them) |
| **Gap Analysis**        | Assessment dimensions the supervisor never mentioned — what the next call should probe                                                    |
| **Follow-up Questions** | 3–5 concrete questions the intern should ask in the next call, each targeting a specific gap                                              |
| **Bias Flags**          | Helpfulness / presence / halo / horn / recency triggers the intern should weigh before finalising                                         |

Hover any evidence quote → it highlights in the original transcript (evidence linking, Challenge 3).

The score card shows a confidence pill and a persistent **"Draft, not verdict"**
banner so the intern treats output as a starting point, not a final answer
(anti-automation-bias, Challenge 4).

---

## Tech stack

| Layer      | Choice                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Framework  | **Next.js 16** — App Router, Turbopack, `src/` layout                                             |
| Language   | **TypeScript** (strict mode)                                                                      |
| Auth       | **NextAuth.js v5** — Credentials (email + password, remember-me, forgot/reset) + **Google OAuth** |
| Database   | **PostgreSQL via Neon** + **Prisma 7** (pg driver adapter)                                        |
| UI         | **Tailwind CSS v4** + custom shadcn-style primitives, **Heroicons**, **Framer Motion**            |
| LLM        | **Groq API** (`llama-3.3-70b-versatile`, 280 t/s) — instant streaming SSE                         |
| Deployment | **Vercel** (web) + **Neon** (database)                                                            |

---

## Features

- **Split-screen layout** — transcript form on the left, live-streaming analysis on the right
- **Collapsible sidebar** — logo, navigation, recent analyses, dark/light toggle, user info, sign-out; collapses to icon-only mode; state persisted in `localStorage`
- **Streaming SSE** — tokens stream to the browser as the model generates them; a live elapsed timer and connection badges show progress
- **Auth flows** — register, login with remember-me, Google sign-in, forgot password, reset password
- **History** — recent analyses stored in Postgres; click any item in the sidebar to reload the full transcript + result
- **Dark / light mode** — class-based toggle with no flash on load (inline script in `<html>`)
- **Sample transcripts** — 3 built-in transcripts (Karthik, Meena, Anil) you can load with one click

---

## Quick start (local)

### Prerequisites

| Tool         | Version | Notes                                                                        |
| ------------ | ------- | ---------------------------------------------------------------------------- |
| Node.js      | ≥ 20    | `node -v` to check                                                           |
| npm          | ≥ 10    | bundled with Node                                                            |
| PostgreSQL   | any     | Neon free tier works — grab the pooled connection string                     |
| Groq API key | —       | Free at [console.groq.com](https://console.groq.com) — no credit card needed |

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/trinethra.git
cd trinethra
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# PostgreSQL — Neon pooled URL (sslmode=require)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# NextAuth — generate with: npx auth secret
AUTH_SECRET="your-random-secret-here"

# Groq (required for LLM)
GROQ_API_KEY="gsk_..."

# Optional: override default model (llama-3.3-70b-versatile)
# GROQ_MODEL="llama-3.1-8b-instant"

# Google OAuth (optional — comment out to disable)
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
```

### 3. Set up the database

```bash
npx prisma migrate dev --name init
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register an account, and
click **Load sample** to try one of the built-in transcripts.

---

## Deploy to Vercel

1. Push to GitHub.
2. Import the project on [vercel.com/new](https://vercel.com/new).
3. Add all `.env` values in **Project Settings → Environment Variables**.
4. For Google OAuth, add
   `https://<your-app>.vercel.app/api/auth/callback/google` as an
   authorised redirect URI in Google Cloud Console.

---

## LLM: why Groq?

The assignment specifies Ollama (local). This implementation supports **both**:

| Provider            | Default model             | Speed    | Where it runs          |
| ------------------- | ------------------------- | -------- | ---------------------- |
| **Groq** _(active)_ | `llama-3.3-70b-versatile` | ~280 t/s | Groq cloud — free tier |
| Ollama _(fallback)_ | `llama3`                  | 3–8 t/s  | Your machine           |

**Why the switch to Groq:**
Running `llama3` on CPU takes 5–10 minutes per transcript. The assignment
asks for a tool a psychology intern would actually use — a 10-minute wait
defeats the purpose. Groq's LPU hardware runs the same Llama 3 family at
200× the speed, for free, with no data leaving compliant infrastructure.
The Groq streaming path is a drop-in replacement for the Ollama one —
same SSE protocol, same Zod schema, same prompt.

To switch back to Ollama: comment out `GROQ_API_KEY` and set
`OLLAMA_BASE_URL` + `OLLAMA_MODEL` in `.env`, then swap the import in
`src/app/api/analyze/route.ts` from `@/lib/groq` to `@/lib/ollama`.

---

## Design challenges

This codebase takes a position on all 5 challenges from the brief.

### Challenge 1 — One prompt or many?

**One prompt.** A 10-minute transcript fits comfortably in the model's
context window. A single round-trip returns everything in one shot —
score, evidence, KPI mapping, gaps, follow-ups, bias flags — which also
preserves cross-cutting context (the gap detector sees the same evidence
the scorer saw). A chain of 4 calls would be slower _and_ lower quality.
The saved latency is invested in prompt quality (`src/lib/prompt.ts`).

### Challenge 2 — Structured output reliability

Three layers of defence (`src/lib/ollama.ts`, shared by the Groq path):

1. **No `format:"json"` on the streaming path** — Ollama's JSON mode
   buffers all tokens internally, eliminating the streaming UX. Instead
   the system prompt instructs the model to emit a single JSON object.
2. **Tolerant extractor** — `extractJson()` strips code fences, finds the
   first `{` and last `}`, and `JSON.parse`s the slice.
3. **Zod schema with `.catch()`** — every enum uses `.catch(fallback)` so
   a model that returns `"medium-high"` for confidence degrades gracefully
   instead of rejecting the whole response.

### Challenge 3 — Evidence linking

Hovering an evidence quote calls `setHighlightQuote(quote)`. The
`TranscriptCard` component segments the transcript text on that exact
string (simple `indexOf`) and wraps the matching span in a `<mark>`.
No diff library needed — the prompt instructs the model to use verbatim
quotes from the transcript.

### Challenge 4 — Showing uncertainty (anti-automation bias)

- Score card shows a `low | medium | high` **confidence pill**.
- Persistent amber **"Draft, not verdict"** banner on every result.
- **Bias flags** (helpfulness / presence / halo / horn / recency) are a
  first-class output section, not hidden metadata.
- "Save to history" is **opt-in** — analyses aren't silently persisted.

### Challenge 5 — Gap detection

The system prompt gives the model a closed list of 4 assessment dimension
IDs and asks for a `gaps[]` array of whichever IDs the transcript didn't
cover. Set-difference on a closed list is much more reliable for LLMs
than open-ended "what's missing?" recall.

---

## Architecture

```
Browser (Next.js App Router)
│
│  /login  /register  /forgot-password  /reset-password
│  /dashboard  →  Analyzer (client component, split-screen)
│
│  fetch POST /api/analyze  (SSE stream)
│
▼
Route handlers  (Node.js runtime)
│
├─ POST /api/analyze      auth check → Groq SSE → Zod parse → Prisma save
├─ POST /api/register     bcrypt(12) → Prisma create user
├─ POST /api/forgot-pass  sha256 token → Prisma store → (email in prod)
├─ POST /api/reset-pass   verify token → bcrypt → update passwordHash
├─ GET  /api/samples      return bundled fixture transcripts
└─ ANY  /api/auth/[...]   NextAuth v5 handlers
│
├─────────────────────────────────────────────────┐
▼                                                 ▼
PostgreSQL (Neon)                           Groq API
Prisma 7 + pg driver adapter                llama-3.3-70b-versatile
User / Account / Session                    streaming SSE → tokens
Analysis / PasswordResetToken               → extract JSON → Zod
```

**Auth split:** `src/auth.config.ts` is edge-safe (no bcrypt/Prisma) and
runs in the `middleware.ts` Proxy. `src/auth.ts` is the full Node runtime
config with PrismaAdapter + bcrypt + Google provider.

---

## What I'd improve with more time

- **Inline editing** — let the intern edit score, evidence, and
  follow-up questions directly in the UI before saving the finalised record.
- **Email transport** — password reset links are returned in the API
  response in dev; in production they'd go via Resend / AWS SES.
- **Per-user model preference** — currently a per-request override field;
  should be a saved setting in the user profile.
- **Audit log** — persist the raw model output alongside the parsed
  result so the intern can review what the schema validator discarded.
- **Confidence calibration** — compare suggested scores against intern
  final scores over time and surface a per-model calibration offset.

---

## Project layout

```
trinethra/
├─ prisma/
│  ├─ schema.prisma          # User / Account / Session / Analysis / PasswordResetToken
│  └─ migrations/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/             # login, register, forgot-password, reset-password pages
│  │  ├─ api/
│  │  │  ├─ analyze/         # POST → Groq SSE → Zod → Prisma
│  │  │  ├─ auth/[...]/      # NextAuth handlers
│  │  │  ├─ forgot-password/ # POST → sha256 token
│  │  │  ├─ register/        # POST → bcrypt + create user
│  │  │  ├─ reset-password/  # POST → consume token + set hash
│  │  │  └─ samples/         # GET  → fixture transcripts
│  │  ├─ actions.ts          # server actions (signOut)
│  │  ├─ dashboard/          # protected split-screen analyzer
│  │  ├─ globals.css         # Tailwind v4 + CSS vars + .dark class
│  │  ├─ layout.tsx          # root layout + theme init script
│  │  └─ page.tsx            # public landing page
│  ├─ auth.config.ts         # edge-safe NextAuth config (JWT, authorized callback)
│  ├─ auth.ts                # full NextAuth config (PrismaAdapter, Google, Credentials)
│  ├─ components/
│  │  ├─ app-sidebar.tsx     # collapsible sidebar (nav, recent, theme, user, sign-out)
│  │  ├─ providers.tsx       # SessionProvider wrapper
│  │  └─ ui/                 # button, card, input (shadcn-style primitives)
│  ├─ data/
│  │  ├─ rubric.json         # 1-10 rubric loaded into the LLM prompt
│  │  └─ sample-transcripts.json
│  ├─ generated/prisma/      # Prisma client (git-ignored)
│  ├─ lib/
│  │  ├─ groq.ts             # Groq streaming SSE client
│  │  ├─ ollama.ts           # Ollama streaming client + Zod schema + extractJson
│  │  ├─ prisma.ts           # PrismaClient singleton (pg driver adapter)
│  │  ├─ prompt.ts           # buildAnalysisPrompt (rubric + dims + KPIs)
│  │  └─ utils.ts            # cn() helper
│  └─ middleware.ts          # NextAuth edge middleware
├─ .env.example
├─ next.config.ts
├─ package.json
├─ prisma.config.ts
└─ tsconfig.json
```

---

## What it does

Paste a supervisor transcript →

1. **Score (1–10)** with the rubric label, band, confidence, and justification.
2. **Evidence** — every claim cites a verbatim quote, tagged positive/negative
   and mapped to one of the 4 assessment dimensions.
3. **KPI mapping** — which of the 8 business KPIs the work touches, marked
   `system` (survives the Fellow leaving) or `personal` (depends on them).
4. **Gaps** — assessment dimensions the supervisor never covered.
5. **Follow-up questions** — 3–5 concrete questions for the next call.
6. **Bias flags** — helpfulness / presence / halo / horn / recency triggers
   that the intern should consider before finalizing.

Hover any evidence quote and it lights up inside the original transcript
(Challenge 3 — evidence linking).

The intern reviews, edits, and accepts — the AI **drafts**, the human **decides**
(Challenge 4 — the score is shown with a "Draft, not verdict" banner and a
visible confidence pill).

---

## Stack

| Layer     | Choice                                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Framework | **Next.js 16** (App Router, Turbopack)                                                                                            |
| Language  | **TypeScript** (strict)                                                                                                           |
| Auth      | **NextAuth.js v5** — Credentials (email + password, with **Remember me** + **Forgot password**) and **Google** OAuth (extensible) |
| DB / ORM  | **Postgres (Neon)** + **Prisma 7**                                                                                                |
| UI        | **Tailwind CSS v4** + custom shadcn-style component primitives, **Heroicons**, **Framer Motion**                                  |
| LLM       | **Ollama** locally — `llama3` by default, swappable per-request                                                                   |
| Hosting   | **Vercel** (web) + **Neon** (database)                                                                                            |

---

## Quick start (local)

### 1. Prerequisites

- Node.js ≥ 20
- Postgres URL (Neon's free tier works — copy the **pooled** connection string)
- Ollama installed: <https://ollama.com>

### 2. Install

```bash
git clone <your-fork> trinethra
cd trinethra
npm install
```

### 3. Configure `.env`

Copy `.env.example` to `.env` and fill in:

```bash
DATABASE_URL="postgresql://..."          # Neon pooled URL
AUTH_SECRET="$(openssl rand -base64 32)" # or: npx auth secret
AUTH_GOOGLE_ID=""                        # optional
AUTH_GOOGLE_SECRET=""                    # optional
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3"
```

### 4. Database

```bash
npx prisma migrate dev --name init
```

### 5. Ollama

```bash
ollama pull llama3          # ~2 GB; first run only
ollama serve                  # usually auto-starts on install
```

### 6. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>, register an account, paste a transcript (or
click **Load sample**), and hit **Run analysis**.

---

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import the project on Vercel.
3. Add the env vars from `.env.example` in **Project Settings → Environment Variables**.
4. (Google) In Google Cloud → OAuth client → add
   `https://<your-app>.vercel.app/api/auth/callback/google` as a redirect URI.
5. **Important — Ollama is local.** Vercel cannot reach `localhost:11434`.
   For a hosted demo, either tunnel your Ollama (e.g. `ngrok http 11434`) and
   set `OLLAMA_BASE_URL` to the tunnel URL, or run the analysis path against
   a self-hosted Ollama. The app handles `503 — Could not reach Ollama`
   gracefully with an actionable error.

---

## Design challenges tackled

This codebase takes a position on **all 5** challenges from the brief.

### Challenge 1 — One prompt vs many

**Choice: one prompt.** A 10-minute transcript fits comfortably in
`num_ctx: 8192` even for tiny models. A single round-trip on a laptop CPU
costs 20–60 s; a chain of 4 calls would cost 1–3 minutes and be _worse_ —
not better — because each call would lose cross-cutting context (e.g. a
gap detector that doesn't see the evidence).
We invest the saved time into prompt quality (`src/lib/prompt.ts`) and
output reliability instead.

### Challenge 2 — Structured output reliability

Three layers of defense (`src/lib/ollama.ts`):

1. **Ollama JSON mode** (`format: "json"` on `/api/chat`) — the model is
   constrained to emit a single JSON object.
2. **Tolerant extractor** — strips ` ```json ` fences, locates the first
   `{` and last `}`, and `JSON.parse`s the slice.
3. **Zod schema validation** — every output field is validated; enums use
   `.catch(...)` so a model that says `"medium-high"` for confidence
   degrades gracefully instead of failing the whole request.

### Challenge 3 — Evidence linking

Evidence cards on the right are interactive. Hovering one finds and
highlights the exact `<mark>` inside the transcript card below
(`Analyzer.tsx` — `TranscriptCard` segments the text on the chosen
quote). No fancy diff library — simple `indexOf` is enough because the
prompt instructs the model to use **verbatim** quotes.

### Challenge 4 — Showing uncertainty (anti-automation-bias)

- The score card shows a `low | medium | high` **confidence pill**.
- A persistent amber banner reads **"Draft, not verdict — the intern
  reviews and edits before this is final."**
- Bias flags (helpfulness / presence / halo / horn / recency) are a
  first-class output, not buried.
- A "Save to my history" toggle is **opt-in** so analyses aren't auto-
  blessed by being persisted.

### Challenge 5 — Gap detection

The system prompt enumerates the 4 assessment dimensions explicitly and
asks the model to return a `gaps[]` array citing **which dimension
ID was not covered**. By giving the model the closed list of dimensions
upfront, "what's missing?" becomes set-difference reasoning instead of
free-form recall — which small local models handle markedly better.

---

## Architecture

```
┌──────────── Browser (Next.js, App Router) ────────────┐
│  /login /register /forgot-password /reset-password    │
│  /dashboard  → Analyzer (client component)            │
└─────────────┬─────────────────────────────────────────┘
              │ fetch
              ▼
┌──────────── Route handlers (Node runtime) ───────────┐
│  POST /api/register, /api/forgot-password,           │
│       /api/reset-password   ← bcrypt + Prisma         │
│  POST /api/analyze          ← auth check → Ollama →   │
│                                Zod parse → save       │
│  GET  /api/samples          ← built-in fixtures       │
│  ANY  /api/auth/[...]       ← NextAuth handlers       │
└─────────────┬───────────────────────────┬─────────────┘
              │                           │
              ▼                           ▼
       ┌─────────────┐           ┌──────────────────┐
       │ Postgres    │           │ Ollama (local)   │
       │ via Prisma  │           │ /api/chat (JSON) │
       │ (Neon)      │           │ default llama3 │
       └─────────────┘           └──────────────────┘
```

Edge-safe `middleware.ts` redirects unauthenticated users away from
`/dashboard` and authenticated users away from `/login`. Auth config is
split into `src/auth.config.ts` (edge-compatible — no bcrypt/Prisma) and
`src/auth.ts` (full Node runtime), per the NextAuth v5 split-config
pattern.

---

## What I'd improve with more time

- **Side-by-side editor.** Let the intern edit the JSON inline (score,
  evidence, follow-ups) and re-emit a finalized record — currently the
  draft is read-only.
- **Streaming.** Switch the analyze endpoint to Ollama streaming and
  show evidence cards as they arrive — much better perceived latency
  on slow CPUs.
- **Email transport** for password resets. Today the reset link is
  printed to the server log in dev and shown directly in the UI; in
  production we'd send via Resend/SES.
- **Per-user model preference** (currently a per-request override).
- **Audit log** — keep the raw model output alongside the parsed
  result so the intern can review what was discarded by the schema
  validator.

---

## Project layout

```
src/
├─ app/
│  ├─ (auth)/                 # login, register, forgot, reset
│  ├─ api/
│  │  ├─ analyze/route.ts     # POST  → Ollama → save
│  │  ├─ auth/[...nextauth]/  # NextAuth handlers
│  │  ├─ forgot-password/     # POST  → token + email-safe response
│  │  ├─ register/            # POST  → bcrypt + create user
│  │  ├─ reset-password/      # POST  → consume token, set hash
│  │  └─ samples/             # GET   → bundled fixtures
│  ├─ dashboard/              # protected: analyzer + recent
│  ├─ layout.tsx
│  └─ page.tsx                # marketing landing
├─ components/
│  ├─ providers.tsx           # SessionProvider
│  ├─ site-header.tsx
│  └─ ui/                     # button, card, input  (shadcn-style)
├─ data/
│  ├─ rubric.json             # the 1-10 rubric (used in prompt)
│  └─ sample-transcripts.json
├─ lib/
│  ├─ ollama.ts               # JSON-mode client + Zod schema
│  ├─ prisma.ts
│  ├─ prompt.ts               # system + user prompt builder
│  └─ utils.ts                # cn(...)
├─ auth.ts                    # NextAuth (Node)
├─ auth.config.ts             # edge-safe shared config
└─ generated/prisma/          # `prisma generate` output
prisma/
└─ schema.prisma
middleware.ts                 # uses auth.config (edge)
```

---

## License

This project is licensed under the [MIT License](LICENSE).
