# MarkLogic Subproject

This `ml-gradle` project deploys the decision-ledger backend:

1. Databases and REST app server.
2. Security roles/users.
3. Resource services and optional trigger module.
4. TDE templates for SQL analytics.
5. Optional split data for repeatable loads.

## Key Paths

1. `src/main/ml-config`
   - REST API, databases, users/roles, app server, optional trigger definition.
2. `src/main/ml-modules/ext/decisionServiceBundle.js`
   - Replace with generated Corticon.js bundle.
3. `src/main/ml-modules/services/processAndEnrich.sjs`
   - Resource-based process-and-enrich execution.
4. `src/main/ml-modules/ext/corticonTrigger.sjs`
   - Optional trigger execution path.
5. `src/main/ml-schemas/tde/corticon-output.tde`
   - Generic analytics views.
6. `src/main/ml-data/split`
   - Seed folders for `input`, `output`, and `trace` docs with deterministic metadata.

## Commands

```powershell
gradle mlDeploy -i
gradle mlLoadData -i
gradle mlUndeploy -i
```

## Smoke Test

After deploy, run:

```powershell
curl.exe --location --request POST "http://localhost:8003/v1/resources/processAndEnrich" `
  --header "Content-Type: application/json" `
  --digest --user <writer-user>:<writer-password> `
  --data-raw "{`"id`":`"demo-001`",`"amount`":125.75}"
```

Then in Query Console:

```javascript
cts.estimate(cts.collectionQuery("decision-ledger-output"))
```
