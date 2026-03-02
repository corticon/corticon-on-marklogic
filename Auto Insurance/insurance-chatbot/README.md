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

2) Create a `.env` file (example values shown):

```ini
# MarkLogic REST connection used by the proxy and chat route
ML_HOST=localhost
ML_PORT=8004
ML_USER=corticonml-admin
ML_PASS=corticonml-admin

# Port for this middle tier
ML_MIDDLE_TIER_PORT=4004

# Allow the UI origin during development
UI_ORIGIN=http://localhost:5173

# Name of the custom MarkLogic resource used by the UI
VITE_ML_OPTIONS=corticonml-options

# Optional: enable chat explanations
OPENAI_API_KEY=sk-...
# Optional: pick a model (defaults to gpt-4o-mini)
# OPENAI_MODEL=gpt-4o-mini
```

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
- `.env` — Environment configuration for MarkLogic and the UI origin.

---

## How the Chat Works (High Level)

- Extracts candidate policy IDs from the user message.
- Calls the custom MarkLogic resource (`corticonml-options`) to retrieve the enriched policy.
- Builds a concise context block with policy JSON and key Corticon messages (discounts, surcharges, etc.).
- Calls the OpenAI Responses API to generate a readable explanation for the user.

Tip: If you don’t need LLM explanations, you can omit `OPENAI_API_KEY` and rely on the UI’s explainability tabs (Decision Log, Execution Trace) via the `/v1` proxy.

---

## Template Reference

If you need a generic middle-tier + backend scaffold for a new domain, start with:

1. `../../decision-ledger-accelerator-template/README.md`
2. `../../decision-ledger-accelerator-template/ui-fasttrack/README.md`
