# Medicaid Eligibility Analytics Server (Node)

This Node server powers the Medicaid Eligibility analytics UI. It exposes prebuilt analytics over MarkLogic via HTTP and can proxy MarkLogic REST for convenience during demos.

---

## Business Value

- Centralizes MarkLogic access and credentials outside the browser.
- Provides curated analytics endpoints so policy analysts can explore insights without writing SQL.
- Adds robust search and an optional direct `/v1/*` proxy to simplify local setup.

---

## Prerequisites

- Node.js 18+
- MarkLogic 12 running locally
- Medicaid backend deployed with enriched docs in `/data/medicaid/`

---

## Setup

1) Install dependencies in this folder:

```bash
npm install
```

If you see errors about missing modules, install:

```bash
npm install node-fetch@2 abort-controller
```

2) Optionally create a `.env` file with MarkLogic connection overrides:

```ini
ML_HOST=localhost
ML_REST_PORT=8004
ML_USER=admin
ML_PASS=password
```

---

## Run

```bash
node server.js
```

- Server listens on `http://localhost:4001`.
- The UI is already configured (via `vite.config.js`) to proxy `/api` and `/v1` to `http://localhost:4001`.

---

## Endpoints

- `GET /api/analytics?type=...` — Returns JSON rows for the requested analytic. Supported `type` values include:
  - `programEligibilityStats`
  - `nearMissIncomeStats`
  - `nearMissByThreshold`
  - `ruleFiringStats`
  - `demographicTrends`
  - `ruleFiringNearFPL`
  - `pathwaysFinancialPass`
  - `pathwaysUnderHours`
  - `pathwaysNotEnrolledAdults`
  - `proceduralRootCauses`
  - `maternalContinuityCandidates`
  - `decisionPathBySSN` (requires `ssn` query param)
- `ALL /v1/*` — Direct proxy to MarkLogic REST at `ML_HOST:ML_REST_PORT` using `ML_USER`/`ML_PASS`.
- `ALL /api/v1/search` — Smart search proxy that accepts Combined/structured JSON and falls back to qtext when needed; enriches results with document content where possible.

---

## Notable Files

- `server.js` — Express app implementing `/api/analytics`, `/v1/*` proxy, and `/api/v1/search`.
- `../ui/vite.config.js` — Proxies `/api` and `/v1` to this server in dev.
- `../ui/src/api/marklogicService.js` — Calls `/api/analytics` from the UI.
