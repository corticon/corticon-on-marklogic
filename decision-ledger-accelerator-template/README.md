# Decision Ledger Accelerator Template

This folder is a standalone starter template for building a Corticon.js + MarkLogic explainable decision ledger.

It includes:

1. MarkLogic project scaffolding (`ml-gradle` layout, security, REST resources, TDE starter).
2. Generic decision execution patterns (resource-based and optional trigger-based).
3. FastTrack UI starter placeholders.
4. Environment-driven configuration scripts for repeatable setup.

## Template Structure

```text
decision-ledger-accelerator-template/
  .env.template
  scripts/
    init-from-env.ps1
  marklogic/
    build.gradle
    gradle-template.properties
    src/main/
      ml-config/
      ml-data/
      ml-modules/
      ml-schemas/
  ui-fasttrack/
    README.md
    package.template.json
```

## Decision Ledger Data Contract (Generic)

The template assumes output documents include:

1. Business payload (`payload`, or your domain object root).
2. Decision result fields under `corticon` (status/messages/metrics).
3. Ledger metadata under `_decisionLedger`.

Minimal example:

```json
{
  "_decisionLedger": {
    "correlationId": "abc-123",
    "entityId": "case-001",
    "inputPayloadUri": "/data/input/case-001.json",
    "outputPayloadUri": "/results/case-001.json",
    "processedAt": "2026-02-27T12:00:00Z"
  },
  "corticon": {
    "status": "eligible",
    "messages": [
      { "code": "RULE-1", "severity": "info", "message": "Example message" }
    ]
  },
  "payload": {
    "id": "case-001"
  }
}
```

## Quick Start (Windows)

1. Copy and edit environment values:

```powershell
cd decision-ledger-accelerator-template
Copy-Item .env.template .env
notepad .env
```

2. Generate `marklogic/gradle.properties`:

```powershell
.\scripts\init-from-env.ps1
```

3. Replace placeholder bundle:

```text
marklogic/src/main/ml-modules/ext/decisionServiceBundle.js
```

4. Deploy MarkLogic resources:

```powershell
cd marklogic
gradle mlDeploy -i
```

5. Optionally load split seed data:

```powershell
gradle mlLoadData -i
```

6. Execute the service endpoint:

```powershell
curl.exe --location --request POST "http://localhost:8003/v1/resources/processAndEnrich" `
  --header "Content-Type: application/json" `
  --digest --user <writer-user>:<writer-password> `
  --data-raw "{`"id`":`"case-001`",`"state`":`"CA`"}"
```

7. Verify output load:

```javascript
cts.estimate(cts.collectionQuery("decision-ledger-output"))
```

## Where To Customize

1. Decision execution:
   - `marklogic/src/main/ml-modules/services/processAndEnrich.sjs`
   - `marklogic/src/main/ml-modules/ext/corticonTrigger.sjs`
2. Search and retrieval:
   - `marklogic/src/main/ml-modules/services/chunkSearch.sjs`
   - `marklogic/src/main/ml-modules/options/search-options.xml`
3. SQL analytics:
   - `marklogic/src/main/ml-schemas/tde/corticon-output.tde`
4. Load metadata conventions:
   - `marklogic/src/main/ml-data/split/**/collections.properties`
   - `marklogic/src/main/ml-data/split/**/permissions.properties`
5. UI bootstrap:
   - `ui-fasttrack/package.template.json`
   - `ui-fasttrack/README.md`

## Notes

1. Trigger execution is disabled by default in `ml-config/triggers/corticonTrigger.json`.
2. Tokenized roles/users (`%%mlAppName%%-*`) are resolved via generated `gradle.properties`.
3. Keep `.env` local and out of source control.
