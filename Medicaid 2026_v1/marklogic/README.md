# Medicaid 2026 MarkLogic Backend

This project deploys the Medicaid decision-ledger backend (databases, security, services, trigger, and TDE).

## What Gets Deployed

1. App server + REST API (`mlRestPort` default `8003`).
2. Security roles/users (`%%mlAppName%%-reader`, `%%mlAppName%%-writer`, `%%mlAppName%%-admin`).
3. Resource extensions:
   - `processAndEnrich`
   - `eligibilityDeterminations`
   - `analytics`
   - `chatbot`
4. Optional trigger: `corticonTrigger`.
5. TDE template: `src/main/ml-schemas/tde/corticon-output.tde`.

## Important Runtime Collections

Using `collectionPrefix` (default `Medicaid 2026_v1`):

1. `<prefix>_input`
2. `<prefix>_output`
3. `<prefix>_trace` (when trace artifacts are present)
4. `<prefix>` (project-wide grouping collection)

## Setup

From project root (`Medicaid 2026_v1`):

```powershell
Copy-Item .env.template .env
.\scripts\init-from-env.ps1
```

## Deploy

```powershell
cd marklogic
gradle mlDeploy -i
```

## Optional Seed Load

If you add split docs under `src/main/ml-data/split`, load with:

```powershell
gradle mlLoadData -i
```

## Smoke Test

```powershell
curl.exe --location --request POST "http://localhost:8003/v1/resources/processAndEnrich" `
  --header "Content-Type: application/json" `
  --digest --user corticonml-writer:admin `
  --data-binary "@..\data\input.json"
```

## Endpoint Summary

1. `POST /v1/resources/processAndEnrich`
2. `GET /v1/resources/eligibilityDeterminations`
3. `GET /v1/resources/analytics`
4. `GET/POST /v1/resources/chatbot`

## Notable Files

1. `src/main/ml-modules/ext/processAndEnrichUpdate.sjs` - update transaction module for paired input/output writes.
2. `src/main/ml-modules/ext/corticonTrigger.sjs` - optional ingestion trigger execution path.
3. `src/main/ml-modules/ext/medicaidUiLib.sjs` - shared utility library for resource services.
4. `src/main/ml-modules/services/eligibilityDeterminations.sjs` - filtering, faceting, paging for determinations UI.
5. `src/main/ml-modules/services/analytics.sjs` - dashboard aggregations and cohort/rule analytics.
6. `src/main/ml-modules/services/chatbot.sjs` - support question resolution using determination and analytics context.
7. `src/main/ml-schemas/tde/corticon-output.tde` - SQL projection of decision payloads and trace metrics.
8. `build.gradle` - ml-gradle plugin and post-deploy REST authentication configuration.
9. `gradle-template.properties` - tokenized deployment property template rendered from `.env`.
10. `src/main/ml-config/triggers/corticonTrigger.json` - trigger definition (disabled by default).

## Reuse Guidance

For new domains, start with the generic template docs in <https://github.com/corticon/explainable-decision-ledger/blob/main/docs/README.md> and then adapt this Medicaid backend where domain-specific analytics/chat behavior is needed.


