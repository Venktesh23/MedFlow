# MedFlow

Full-stack agentic clinical assistant: React (Vite) frontend, Node.js Express API, MongoDB, and AI integrations (Anthropic Claude, Deepgram).

## Repository layout

| Path | Purpose |
|------|---------|
| `frontend/` | React application (`medflow-frontend`) |
| `backend/` | Express API (`medflow-backend`) |
| `backend/src/dashboard/` | Dashboard API (aggregated summary for the home screen) |
| `frontend/src/dashboard/` | Dashboard UI (sidebar, navbar, calendar assistant, cards) |
| Root `tsconfig.json`, `components.json` | Shared TypeScript path aliases (`@/*` → `frontend/src/*`) and shadcn metadata |
| `frontend/` | Vite app: `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, and `src/` |

Agent logic for sessions and calendar lives under `backend/src/agents/`.

## Voice conventions (doctors)

**Appointment booking (dashboard calendar assistant)**  
Use a fixed sentence so scheduling parses reliably:

`Schedule [patient full name] for a [visit type] on [date] at [time][ for N minutes].`

Visit types: `follow-up`, `new-visit`, `lab-review`, `annual-physical`, `consultation`.  
Example: `Schedule Maria Lopez for a follow-up on Monday at 14:30 for 30 minutes.`

On the **Appointments** tab, use **Chat with calendar** or **Manage calendar** (voice). The dashboard **Calendar Assistant** uses the same API.

**Visit session → clinical note**  
Label each spoken turn in the live transcript:

- `Patient: …`
- `Doctor: …` (or `Physician:`, `Clinician:`, `MD:`, `RN:`)

After **Stop & save note**, the server **cleans** the live transcript with Claude (removes filler and obvious ASR noise, normalizes `Patient:` / `Doctor:` lines) and then generates the SOAP note from that cleaned text. The stored note keeps the **cleaned** transcript; if cleanup changed the text, the **original capture** is also saved for audit.

The transcript is converted to a **fixed SOAP layout** in JSON/storage:

| Section     | Format |
|------------|--------|
| Subjective | `CC:` / `HPI:` blocks |
| Objective  | `Vitals:` / `Physical exam:` blocks |
| Assessment | `Impression:` |
| Plan       | One action per line, `- …` |

Prompts live in `backend/src/prompts/calendarPrompt.js` and `backend/src/prompts/soapPrompt.js`.

## Prerequisites

- Node.js 18+
- MongoDB
- Optional: API keys for Deepgram and Anthropic Claude (see `backend/.env.example`)

## Install

Install dependencies in each app (two `node_modules` trees):

```bash
cd frontend && npm install
cd ../backend && npm install
```

If you use pnpm, install in each workspace the same way (`pnpm install` inside `frontend` and `backend`).

## Run

**Backend** (default port `5000`):

```bash
cd backend && npm run dev
```

**Frontend** (Vite dev server, port `5173`):

```bash
cd frontend && npm run dev
```

Or from root:

```bash
npm run dev:backend
npm run dev:frontend
```

## Environment variables

**Frontend** (`frontend/.env` — copy from `frontend/.env.example`):

- `VITE_API_BASE_URL` — Base URL for the API host, e.g. `http://localhost:5000`

**Backend** (`backend/.env` — copy from `backend/.env.example`):

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL` — Frontend origin for CORS (e.g. `http://localhost:5173`)
- `DEEPGRAM_API_KEY`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (defaults to `claude-sonnet-4-6` if unset)
- `NODE_ENV` as needed

## Build frontend for production

```bash
npm run build:frontend
```

Output: `frontend/dist/spa/`.
