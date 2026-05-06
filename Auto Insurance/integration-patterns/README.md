# Auto Insurance Integration Patterns

This folder captures concrete integration patterns for combining Corticon.js and MarkLogic in the Auto Insurance demo. The goal is to keep the examples implementation-oriented so you can reuse them directly in other MarkLogic 12 projects.

## 1. Synchronous Decisioning API

Use this when the caller wants an immediate enriched result back in the same request/response cycle.

- Runtime endpoint: `POST /v1/resources/processAndEnrich`
- MarkLogic module: `mlCorticonAutoInsurance/src/main/ml-modules/services/processAndEnrich.sjs`
- Update transaction: `mlCorticonAutoInsurance/src/main/ml-modules/ext/processAndEnrichUpdate.sjs`

Why it works well:

- The caller controls when the decision executes.
- Input and output are persisted in paired collections for replay, audit, and traceability.
- This is the cleanest pattern for middleware-driven orchestration.

Example:

```powershell
curl.exe --digest --user admin:password \
  --header "Content-Type: application/json" \
  --data-binary "@auto-insurance-input.json" \
  http://localhost:8004/v1/resources/processAndEnrich
```

## 2. Trigger-Driven Post-Commit Enrichment

Use this when raw documents land in MarkLogic first and the decision should execute automatically as part of the ingestion pipeline.

- Trigger definition: `mlCorticonAutoInsurance/src/main/ml-config/triggers/autoInsuranceTrigger.json`
- Trigger module: `mlCorticonAutoInsurance/src/main/ml-modules/ext/autoInsuranceTrigger.sjs`
- Shared execution library: `mlCorticonAutoInsurance/src/main/ml-modules/ext/autoInsuranceLib.sjs`

Why it works well:

- Works with Flux, Data Hub style loaders, REST document inserts, or any producer that can tag the input collection.
- Keeps ingestion simple for upstream systems.
- Preserves the original input URI and writes a canonical enriched output URI.

Recommended input collection for this demo:

- `http://example.com/data/policy-input`

## 3. Batch Ingestion via Flux or mlLoadData

Use this when many applications must be processed in bulk.

Recommended sequence:

1. Load raw JSON into the input collection watched by the trigger.
2. Let the trigger persist enriched output documents.
3. Query the output and trace collections through REST resources or TDE-backed views.

For MarkLogic-native replay after a bulk load, invoke:

- `mlCorticonAutoInsurance/src/main/ml-modules/ext/examples/reprocessPolicy.sjs`

That pattern is useful when rules change and you need to recalculate decisions without reingesting source documents.

## 4. Collection Tagging for Traceability and Explainability

The backend now applies both domain collections and integration-specific collections:

- `auto-insurance`
- `auto-insurance_input`
- `auto-insurance_output`
- `auto-insurance_trace`
- `http://example.com/data/policy-input`
- `http://example.com/data/policy`

Recommended use of those collections:

- `auto-insurance`: project-wide grouping for administrative queries.
- `auto-insurance_input`: source requests exactly as received.
- `auto-insurance_output`: canonical enriched decisions for UI/API access.
- `auto-insurance_trace`: outputs that contain execution metrics or trace artifacts.
- `http://example.com/data/policy-input` and `http://example.com/data/policy`: compatibility collections for existing demo assets.

The `_decisionLedger` metadata attached by `autoInsuranceLib.sjs` gives every persisted document stable pointers to:

- application id
- input URI
- output URI
- invocation mode (`resource`, `trigger`, `replay`)
- collection prefix
- trace participation

## 5. TDE-Backed Analytics Over Corticon Output

Use this when you want explainability and operational reporting without flattening JSON into a second persistence model.

- TDE template: `mlCorticonAutoInsurance/src/main/ml-schemas/tde/simple.tde`
- Analytics resource: `mlCorticonAutoInsurance/src/main/ml-modules/services/analytics.sjs`

Relevant TDE views already available in this demo:

- `policy.Details`
- `policy.Drivers`
- `policy.Vehicles`
- `policy.Coverages`
- `policy.Discounts`
- `policy.Surcharges`
- `corticon.Messages`
- `policy.AttributeChanges`

This is the best pattern when you need to ask questions like:

- Which states have the highest average premium?
- Which discount categories are driving most pricing change?
- Which rulesheets are producing the most messages?
- Which outputs contain trace detail suitable for deeper review?

Example:

```powershell
curl.exe --digest --user admin:password \
  "http://localhost:8004/v1/resources/analytics?rs:state=Virginia"
```

## 6. Rule-Authored Service Callouts Into MarkLogic

Use this when the decision request should stay lean and the rules themselves decide when to retrieve reference data.

- Example SCO: `rule-project/examples/AccessMarkLogicRiskProfileServiceCallout.js`
- Related sample inspiration: `corticon.js-samples/Importable-Rule-Projects/DailyInsurance/_Service Callouts files/AccessMarkLogicServiceCallout.js`

Recommended usage:

1. Keep large reference or enrichment datasets in MarkLogic documents.
2. Pass `cts` into the Corticon service-callout configuration when running inside MarkLogic.
3. Let the ruleflow decide when the SCO should execute.

That pattern works well for:

- territory or garage risk lookup
- prior carrier history
- VIN or anti-theft enrichment
- dynamic lists that business users update independently of rule deployment

## 7. Choosing Between Trigger, Resource, and SCO Patterns

Use `processAndEnrich` when:

- the caller expects synchronous confirmation
- orchestration is owned by middleware or a UI backend

Use the trigger when:

- MarkLogic is the landing zone for source documents
- ingestion is asynchronous or batch-oriented

Use a service callout when:

- only some rules need external data
- you want business logic to decide whether the lookup is necessary
- pushing all reference data in the request would be wasteful

Combine them when necessary:

- middleware calls `processAndEnrich`
- the decision bundle executes a service callout for selective reference data retrieval
- output is persisted with `_decisionLedger` metadata and queried through TDE-backed services