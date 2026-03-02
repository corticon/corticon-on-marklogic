# Medicaid FastTrack Proxy

Express proxy between the Medicaid FastTrack UI and MarkLogic REST.

## Responsibilities

1. Keep MarkLogic credentials off the browser.
2. Proxy `/v1/*` requests to MarkLogic REST.
3. Provide optional `/api/chatbot` orchestration (MarkLogic retrieval + OpenAI synthesis).
4. Provide a single integration point for logging, auth, and request shaping.

## Quick Start

1. Copy `config-template.js` to `config.js` if needed.
2. Update host/port/credentials.
3. Install and run:

```powershell
npm install
npm start
```

Default proxy port: `14001`.

## Optional OpenAI

Set before `npm start`:

1. `OPENAI_API_KEY`
2. `OPENAI_MODEL` (default `gpt-4.1-mini`)
3. `OPENAI_TIMEOUT_MS`

## Key Routes

1. `GET /v1/resources/eligibilityDeterminations`
2. `GET /v1/resources/analytics`
3. `GET /v1/resources/chatbot`
4. `POST /v1/resources/chatbot`
5. `POST /api/chatbot`

## Template Reference

If you need a generic proxy scaffold for a new domain, start from <https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/README.md> and adapt this implementation.


