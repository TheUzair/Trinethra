# Trinethra — Supervisor Feedback Analyzer

> **DeepThought Software Developer Internship assignment.**
> A full-stack web app that replaces a 45–60 minute manual transcript review
> with a **10-minute AI-assisted workflow** for psychology interns. Paste a
> supervisor call transcript → get a structured, evidence-grounded performance
> draft in seconds. The AI suggests; the intern reviews and decides.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748)](https://prisma.io)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com)
[![Groq](https://img.shields.io/badge/LLM-Groq%20%2F%20Ollama-f55036)](https://console.groq.com)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?logo=vercel)](https://trinethra-olive.vercel.app)

---

## Live demo

> **[https://trinethra-olive.vercel.app](https://trinethra-olive.vercel.app)**

| Field    | Value                |
| -------- | -------------------- |
| Email    | `demo@trinethra.app` |
| Password | `demo1234`           |

The login page has a **"Use demo"** button that auto-fills these credentials.
Once signed in, click **Load sample** to load one of the 3 bundled transcripts
and watch the analysis stream in.

---

## What it produces

Every analysis returns six structured outputs:

| Output                  | What it contains                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Score (1–10)**        | Rubric label, band (Need Attention / Productivity / Performance), confidence level (`low/medium/high`), and a justification paragraph citing direct evidence |
| **Evidence**            | Verbatim quotes from the transcript tagged positive / negative / neutral, each mapped to an assessment dimension                                             |
| **KPI Mapping**         | Which of the 8 business KPIs the Fellow's work connects to; marked `system` (survives the Fellow leaving) or `personal` (depends on them)                    |
| **Gap Analysis**        | Assessment dimensions the supervisor never mentioned — what the next call should probe                                                                       |
| **Follow-up Questions** | 3–5 concrete questions the intern should ask in the next call, each targeting a specific gap                                                                 |
| **Bias Flags**          | Helpfulness / presence / halo / horn / recency triggers the intern should weigh before finalising                                                            |

Hovering an evidence quote highlights the matching phrase in the original
transcript panel (Challenge 3 — evidence linking). A persistent amber
**"Draft, not verdict"** banner and an opt-in save button prevent automation
bias (Challenge 4).

---

## Setup (local)

### Prerequisites

| Tool         | Version | Notes                                                                         |
| ------------ | ------- | ----------------------------------------------------------------------------- |
| Node.js      | >= 20   | `node -v` to check                                                            |
| npm          | >= 10   | bundled with Node                                                             |
| PostgreSQL   | any     | [Neon](https://neon.tech) free tier works — grab the pooled connection string |
| Groq API key | —       | Free at [console.groq.com](https://console.groq.com) — no credit card needed  |

### 1. Clone and install

```bash
git clone https://github.com/TheUzair/Trinethra.git
cd Trinethra
npm install          # postinstall runs `prisma generate` automatically
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

# Optional: override default model
# GROQ_MODEL="llama-3.1-8b-instant"

# Google OAuth (optional — leave blank to disable)
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
```

### 3. Set up the database

```bash
npx prisma migrate dev --name init
```

### 4. Seed the demo user (optional)

```bash
npm run db:seed
```

Creates `demo@trinethra.app` / `demo1234`. Idempotent — safe to re-run.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in (or register),
and click **Load sample** to try a bundled transcript.

---

## Model choice

The assignment specifies Ollama (local). **This codebase supports both — Ollama
is still fully wired, Groq is the active default.** Here is why:

| Provider               | Model                     | Speed    | Where it runs            |
| ---------------------- | ------------------------- | -------- | ------------------------ |
| **Groq** (active)      | `llama-3.3-70b-versatile` | ~280 t/s | Groq cloud (free tier)   |
| **Ollama** (available) | `llama3`                  | 3–8 t/s  | Your machine (localhost) |

Running `llama3` on a CPU takes **5–10 minutes per transcript**. A tool a
psychology intern would actually use cannot have a 10-minute wait — it defeats
the purpose of the workflow. Groq's LPU hardware runs the same Llama 3 family
at ~200x the speed, for free, with no data leaving compliant infrastructure.

The Groq path is a **drop-in replacement** for the Ollama one: same SSE
streaming protocol, same Zod schema, same prompt. Switching back to Ollama:
comment out `GROQ_API_KEY` in `.env`, set `OLLAMA_BASE_URL` + `OLLAMA_MODEL`,
and change the import in `src/app/api/analyze/route.ts` from `@/lib/groq` to
`@/lib/ollama`.

---

## Product decisions

**Included:**

- **Full auth** — register, login with remember-me, forgot/reset password, Google
  OAuth. Analysis history is per-user data; a shared session would mix up intern
  records.
- **Streaming SSE with elapsed timer** — removes the "is it frozen?" anxiety
  during a 5–10 s generation; shows the model actively working.
- **Collapsible sidebar with history** — the intern can reload any previous
  transcript + result pair without re-running the LLM.
- **Split-screen layout** — transcript on the left, streaming result on the
  right; both visible simultaneously for cross-referencing without scrolling.

**Explicitly cut:**

- **Inline editing of the draft** — the intern cannot yet edit score or evidence
  items in-place (see "What I'd improve").
- **Email transport for password resets** — the reset link is returned in the
  API response in dev; production would send via Resend/SES.
- **Mobile layout** — desktop-only; split-screen doesn't map to narrow viewports
  and the assignment does not require it.

---

## Architecture

Frontend and backend are colocated in a single Next.js App Router project.

```
Browser (Next.js App Router)
|
|  /login  /register  /forgot-password  /reset-password
|  /dashboard  ->  Analyzer (client component, split-screen)
|
|  POST /api/analyze  — SSE stream
|
v
Route handlers  (Node.js runtime)
|
+- POST /api/analyze      auth check -> Groq SSE -> Zod parse -> Prisma save
+- POST /api/register     bcrypt(12) -> Prisma create user
+- POST /api/forgot-pass  sha256 token -> Prisma store
+- POST /api/reset-pass   verify token -> bcrypt -> update passwordHash
+- GET  /api/samples      return bundled fixture transcripts
+- ANY  /api/auth/[...]   NextAuth v5 handlers
|
+----------------------------------+
v                                  v
PostgreSQL (Neon)            Groq API / Ollama
Prisma 7 + pg driver         llama-3.3-70b-versatile
User, Account, Session       streaming SSE -> tokens
Analysis, PasswordReset      -> extractJson -> Zod validation
```

Auth is split: `src/auth.config.ts` is edge-safe (no bcrypt/Prisma) and runs in
`middleware.ts`. `src/auth.ts` is the full Node runtime config with
PrismaAdapter, bcrypt, and Google OAuth.

Stack: Next.js 16 · TypeScript strict · Tailwind CSS v4 · Prisma 7 ·
NextAuth v5 · Neon Postgres · Vercel.

---

## Design challenges

All 5 challenges from the brief are addressed.

### Challenge 1 — One prompt or many?

**One prompt.** A 10-minute transcript fits comfortably in the model's context
window. A single round-trip returns everything — score, evidence, KPI mapping,
gaps, follow-ups, bias flags — and preserves cross-cutting context: the gap
detector sees the same evidence the scorer saw. A chain of 4 calls would be
slower _and_ lower quality. The saved latency goes into prompt quality
(`src/lib/prompt.ts`).

### Challenge 2 — Structured output reliability

Three layers of defence (shared across Groq and Ollama paths):

1. **Prompt-level constraint** — the system prompt instructs the model to emit
   exactly one JSON object and nothing else. Ollama's `format:"json"` mode
   cannot be used on the streaming path because it buffers all tokens
   internally, eliminating the streaming UX.
2. **Tolerant extractor** — `extractJson()` strips code fences, finds the first
   `{` and last `}`, and `JSON.parse`s the slice. Handles preamble commentary
   the model sometimes adds before the object.
3. **Zod schema with `.catch()`** — every enum uses `.catch(fallback)` so a
   model returning `"medium-high"` for confidence degrades gracefully instead
   of rejecting the whole response.

### Challenge 3 — Evidence linking

Hovering an evidence quote calls `setHighlightQuote(quote)`. The
`TranscriptCard` component segments the raw transcript text on that exact string
(`indexOf`) and wraps the matching span in a `<mark>`. No diff library needed —
the prompt instructs the model to use **verbatim** quotes from the transcript.

### Challenge 4 — Showing uncertainty (anti-automation bias)

- Score card shows a `low | medium | high` **confidence pill**.
- Persistent amber **"Draft, not verdict"** banner on every result.
- **Bias flags** (helpfulness / presence / halo / horn / recency) are a
  first-class output section, not buried metadata.
- "Save to history" is **opt-in** — analyses are not silently persisted.

### Challenge 5 — Gap detection

The system prompt gives the model the closed list of 4 assessment dimension IDs
and asks for a `gaps[]` array of whichever IDs the transcript did not address.
Set-difference on a closed list is far more reliable for LLMs than open-ended
"what's missing?" free-recall.

---

## What I'd improve with more time

- **Inline editing** — let the intern edit score, evidence, and follow-up
  questions directly in the result panel before saving the finalised record.
- **Email transport** — password reset links are returned in the API response
  in dev; production would send via Resend / AWS SES.
- **Per-user model preference** — currently a per-request override field; should
  be a saved setting in the user profile.
- **Audit log** — persist the raw model output alongside the parsed result so
  the intern can review what the Zod schema discarded.
- **Confidence calibration** — track intern-accepted vs AI-suggested scores over
  time and surface a per-model bias offset.

---

## Project layout

```
trinethra/
+- prisma/
|  +- schema.prisma          # User / Account / Session / Analysis / PasswordResetToken
|  +- seed.ts                # idempotent demo-user seed  (npm run db:seed)
|  +- migrations/
+- src/
|  +- app/
|  |  +- (auth)/             # login, register, forgot-password, reset-password
|  |  +- api/
|  |  |  +- analyze/         # POST -> Groq SSE -> Zod -> Prisma
|  |  |  +- auth/[...]/      # NextAuth handlers
|  |  |  +- forgot-password/ # POST -> sha256 token
|  |  |  +- register/        # POST -> bcrypt + create user
|  |  |  +- reset-password/  # POST -> consume token + set hash
|  |  |  +- samples/         # GET  -> fixture transcripts
|  |  +- actions.ts          # server actions (signOut)
|  |  +- dashboard/          # protected split-screen analyzer
|  |  +- globals.css         # Tailwind v4 + CSS vars + .dark class
|  |  +- layout.tsx          # root layout + theme init script
|  |  +- page.tsx            # landing page
|  +- auth.config.ts         # edge-safe NextAuth config
|  +- auth.ts                # full NextAuth config (PrismaAdapter, Google, Credentials)
|  +- components/
|  |  +- app-sidebar.tsx     # collapsible sidebar
|  |  +- providers.tsx       # SessionProvider wrapper
|  |  +- ui/                 # button, card, input (shadcn-style primitives)
|  +- data/
|  |  +- rubric.json         # 1-10 rubric injected into the LLM prompt
|  |  +- sample-transcripts.json
|  +- generated/prisma/      # Prisma client (git-ignored, auto-generated)
|  +- lib/
|  |  +- groq.ts             # Groq streaming SSE client
|  |  +- ollama.ts           # Ollama streaming client + Zod schema + extractJson
|  |  +- prisma.ts           # PrismaClient singleton (pg driver adapter)
|  |  +- prompt.ts           # buildAnalysisPrompt (rubric + dims + KPIs)
|  |  +- utils.ts            # cn() helper
|  +- middleware.ts          # NextAuth edge middleware
+- .env.example
+- next.config.ts
+- package.json
+- tsconfig.json
```

---

## License

This project is licensed under the [MIT License](LICENSE).
