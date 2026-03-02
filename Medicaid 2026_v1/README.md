# Medicaid 2026 Decision Ledger Demo

This project demonstrates an end-to-end Medicaid eligibility decision platform built with Corticon.js, MarkLogic, FastTrack, and a proxy-assisted support assistant flow.

## Intent

The demo is designed to show how to:

1. Execute Medicaid eligibility rules in-database with Corticon.js.
2. Persist explainable decision artifacts (input, output, trace, and metadata) in MarkLogic.
3. Expose determinations, analytics, and support-chat context through resource extensions.
4. Power management and support UIs with reusable API contracts.

## Core Features

1. Resource-based decision execution (`/v1/resources/processAndEnrich`) with batch support.
2. Optional trigger-based execution (`corticonTrigger`) for ingestion-time automation.
3. Rich determination retrieval endpoint with filtering/faceting (`/v1/resources/eligibilityDeterminations`).
4. Analytics endpoint for summary, ineligibility reasons, geography, cohort, and rule hotspot analysis (`/v1/resources/analytics`).
5. Chatbot endpoint for support workflows and analytics-aware responses (`/v1/resources/chatbot`).
6. TDE model for SQL-ready household/person/pathway/determination/trace analytics.
7. FastTrack React UI + proxy server + optional OpenAI synthesis path.

## Project Components

```text
Medicaid 2026_v1/
  .env.template                   # environment template for MarkLogic + FastTrack values
  scripts/init-from-env.ps1       # renders marklogic/gradle.properties from template values
  marklogic/                      # ml-gradle deployable backend (services, trigger, TDE, security)
  ui-fasttrack/                   # FastTrack-based React UI
  ui-fasttrack/proxy/             # Node proxy/middleware for UI and chatbot orchestration
  mockup/                         # optional alternate UI mockup app (Vite + TypeScript)
  data/                           # sample payload sets
  CORTICON_PLATFORM_DECISION_TRANSPARENCY*.md
```

## Decision Flow

1. Input payload is submitted to `/v1/resources/processAndEnrich`.
2. MarkLogic executes `decisionServiceBundle.js`.
3. Service writes paired input/output documents with `_decisionLedger` metadata.
4. Output is tagged with `%%collectionPrefix%%_output`; trace-bearing docs also receive `%%collectionPrefix%%_trace`.
5. UI/API endpoints query TDE-backed views and document payloads for support/analytics use cases.

## Prerequisites

1. MarkLogic 12+
2. Java 17+
3. Gradle 8+
4. Node.js 18+
5. `curl`
6. Optional: OpenAI API key for proxy chatbot synthesis (`/api/chatbot`)

## Setup and Deploy

1. Prepare environment values:

```powershell
cd "Medicaid 2026_v1"
Copy-Item .env.template .env
notepad .env
```

2. Generate backend `gradle.properties`:

```powershell
.\scripts\init-from-env.ps1
```

3. Deploy backend:

```powershell
cd marklogic
gradle mlDeploy -i
```

4. (Optional) enable trigger execution:
   - set `enabled` to `true` in `marklogic/src/main/ml-config/triggers/corticonTrigger.json`
   - redeploy with `gradle mlDeploy -i`

## Execute Sample Decision Request

Use the included sample payload:

```powershell
curl.exe --location --request POST "http://localhost:8003/v1/resources/processAndEnrich" `
  --header "Content-Type: application/json" `
  --digest --user corticonml-writer:admin `
  --data-binary "@data/input.json"
```

Or submit the larger root payload file:

```powershell
curl.exe --location --request POST "http://localhost:8003/v1/resources/processAndEnrich" `
  --header "Content-Type: application/json" `
  --digest --user corticonml-writer:admin `
  --data-binary "@input data payload.json"
```

## Verify Results

In Query Console (JavaScript):

```javascript
cts.estimate(cts.collectionQuery("Medicaid 2026_v1_output"));
fn.head(cts.search(cts.collectionQuery("Medicaid 2026_v1_output"))).toObject();
```

## Run FastTrack UI and Proxy

1. Start proxy:

```powershell
cd ui-fasttrack/proxy
npm install
npm start
```

2. Start UI:

```powershell
cd ..
npm install
npm run dev
```

Default URLs:

1. Proxy: `http://localhost:14001`
2. UI: `http://localhost:5173`

## Key API Endpoints

1. `POST /v1/resources/processAndEnrich`
2. `GET /v1/resources/eligibilityDeterminations`
3. `GET /v1/resources/analytics?rs:action=<dashboard|summary|ineligibility-reasons|geographic-commonalities|cohort-commonalities|rules-by-program>`
4. `GET /v1/resources/chatbot?rs:q=<question>`
5. `POST /v1/resources/chatbot`
6. `POST /api/chatbot` (proxy endpoint; optional OpenAI synthesis)

## Additional Documentation

1. Backend details: `marklogic/README.md`
2. FastTrack UI details: `ui-fasttrack/README.md`
3. Proxy details: `ui-fasttrack/proxy/README.md`
4. Decision transparency notes:
   - `CORTICON_PLATFORM_DECISION_TRANSPARENCY.md`
   - `CORTICON_PLATFORM_DECISION_TRANSPARENCY_SLIDE_READY.md`
5. Reusable starter template: `../decision-ledger-accelerator-template/README.md`
