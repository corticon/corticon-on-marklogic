# Auto Insurance Middle-Tier (Node)

This lightweight Node server sits between the React UI and MarkLogic. It centralizes Digest auth, avoids browser CORS hassles, and optionally generates natural‑language explanations of Corticon decisions using an LLM.

---

## Business Value

- Streamlines access to MarkLogic by proxying `/v1` with Digest authentication.
- Adds a chat endpoint that turns raw decision output into concise, explainable text for business users.
- Keeps credentials and API keys out of the browser, simplifying local and demo setups.

---

## Prerequisites

- Node.js 18+ (for built‑in `fetch` and modern syntax)
- MarkLogic 12 running locally (default REST port: 8004)
- Auto Insurance backend deployed (enriched docs exist under `/data/policy/`)
- Optional: OpenAI API key for `/api/chat`

---

## Setup

1) From this folder, install dependencies:

```bash
npm install
```

2) Create your `.env` files from the single provided template:

```bash
# Windows
copy .env.template .env
copy .env.template ui\.env

# macOS / Linux
cp .env.template .env
cp .env.template ui/.env
```

Then open both copies and fill in your credentials:

| Variable | Used by | Description |
|---|---|---|
| `ML_USER` | middleware | MarkLogic username (default role: `corticonml-admin`) |
| `ML_PASS` | middleware | MarkLogic password |
| `OPENAI_API_KEY` | middleware | OpenAI API key — required for the `/api/chat` endpoint |
| `VITE_ML_OPTIONS` | both | MarkLogic REST resource name (default: `corticonml-options`) |
| `VITE_ML_HOST` / `VITE_ML_PORT` | UI | Middleware host/port seen by the browser (defaults: `localhost`/`4004`) |

> **Why two `.env` files?** Vite's build tooling only reads a `.env` file located in its own project root (`ui/`), and Node/dotenv only reads the `.env` in the directory where the server starts (`insurance-chatbot/`). Neither process can reach the other's file — they are resolved at different times (build time vs. runtime) by different tools. Two runtime files are therefore unavoidable, but a single `.env.template` keeps the source of truth in one place.

> **Note:** Both `.env` files are excluded from git (via `.gitignore`). `.env.template` is the single committed reference — never put real credentials in it.

---

## Run

```bash
npm start
```

- Health check: `GET http://localhost:4004/health` → `{ ok: true }`
- Proxy target: logs show `Proxy running at http://localhost:4004 -> localhost:8004`

---

## Endpoints

- `POST /api/chat` — Given `{ message: string }`, resolves a policy by ID tokens found in the message, then asks an LLM to produce a friendly, auditable explanation. Requires `OPENAI_API_KEY`.
- `ALL /v1/*` — Transparent proxy to MarkLogic REST with Digest auth (`ML_USER`/`ML_PASS`). Used by the UI for documents, search, and custom resources.
- `GET /health` — Returns `{ ok: true }` for basic readiness.

---

## Notable Files

- `src/server.js` — Express app implementing `/api/chat`, `/v1/*` proxy, and CORS.
- `package.json` — Scripts (`npm start`) and dependencies (`digest-fetch`, `express`).
- `.env.template` — Single committed template; copy to `.env` **and** `ui/.env`, then fill in credentials.
- `.env` / `ui/.env` — Your local environment configuration (both excluded from git).

---

## How the Chat Works (High Level)

- Extracts candidate policy IDs from the user message.
- Calls the custom MarkLogic resource (`corticonml-options`) to retrieve the enriched policy.
- Builds a concise context block with policy JSON and key Corticon messages (discounts, surcharges, etc.).
- Calls the OpenAI Responses API to generate a readable explanation for the user.

Tip: If you don’t need LLM explanations, you can omit `OPENAI_API_KEY` and rely on the UI’s explainability tabs (Decision Log, Execution Trace) via the `/v1` proxy.
