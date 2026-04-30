# Trinethra — Supervisor Feedback Analyzer

> A web app that turns a 60-minute supervisor transcript into a 10-minute
> evidence-grounded performance review. Built for the **DeepThought / Trinethra**
> psychology-intern workflow. Local LLM via **Ollama**. Zero data leaves the box.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748)](https://prisma.io)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com)

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
| LLM       | **Ollama** locally — `llama3.2` by default, swappable per-request                                                                 |
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
OLLAMA_MODEL="llama3.2"
```

### 4. Database

```bash
npx prisma migrate dev --name init
```

### 5. Ollama

```bash
ollama pull llama3.2          # ~2 GB; first run only
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
       │ (Neon)      │           │ default llama3.2 │
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
