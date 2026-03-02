# Data Ingestion and Decision Trigger Patterns

This article compares the trigger and resource patterns harvested from the reference projects and explains how they relate to the template.

The focus is on how data enters MarkLogic, how Corticon.js is invoked, and where the results are persisted.

## 1. Pattern Summary (Observed Variants)

The harvested projects show multiple valid patterns:

1. Trigger, pre-commit, in-place overwrite
2. Trigger, post-commit, create separate output document
3. Resource extension, explicit POST, create output document
4. Resource extension, explicit POST, store both input and output with correlation metadata

The template includes:

1. resource-based baseline (`processAndEnrich`)
2. optional trigger-based path (`corticonTrigger`)

## 2. Trigger Definition Anatomy (MarkLogic)

A MarkLogic trigger definition JSON typically includes:

1. name/description
2. event scope (collection + create/update)
3. `when` (`pre-commit` or `post-commit`)
4. module path
5. module database/root
6. enabled/recursive flags

Example harvested definitions:

1. [`reference-patterns/marklogic/triggers/trade-data-settlement/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/trade-data-settlement/corticonTrigger.json)
2. [`reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.json)
3. [`reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.json)
4. [`reference-patterns/marklogic/triggers/medicaid-2026-template/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-2026-template/corticonTrigger.json)

Template trigger definition:

1. [`marklogic/src/main/ml-config/triggers/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-config/triggers/corticonTrigger.json)

## 3. Pattern A: Pre-Commit Trigger with In-Place Enrichment (Trade Data Settlement)

Harvested source:

1. [`reference-patterns/marklogic/triggers/trade-data-settlement/marklogic.trigger.sample.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/trade-data-settlement/marklogic.trigger.sample.sjs)
2. [`reference-patterns/marklogic/triggers/trade-data-settlement/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/trade-data-settlement/corticonTrigger.json)

Observed behavior:

1. watches a collection
2. reads the newly created document using trigger-provided `uri`
3. runs `decisionServiceBundle.js`
4. normalizes output shape for TDE compatibility
5. writes back to the same URI (overwrite/in-place)

Why this can be useful:

1. simple demo flow
2. one URI per case
3. easy to query if you do not need separate input/output records

Important tradeoff:

1. original input is no longer preserved unless you store it somewhere else or embed it

## 4. Pattern B: Post-Commit Trigger Creating a Separate Output Document (Auto Insurance)

Harvested source:

1. [`reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.sjs)
2. [`reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.json)

Observed behavior:

1. watches input collection (`policy-input`)
2. executes on `post-commit`
3. normalizes numeric strings after Corticon execution
4. unwraps nested payload variants into a stable array
5. creates a new output URI (for example `/data/policy/<id>.json`)
6. persists enriched payload + `corticon` section + `inputPayloadUri`

Why this can be useful:

1. preserves input and output separately
2. clearer lineage (`inputPayloadUri` link)
3. easier explainability drilldown in UIs

Tradeoffs:

1. more storage
2. requires explicit URI and metadata strategy

## 5. Pattern C: Post-Commit Trigger with Envelope Metadata and Dynamic Trace Collections (Medicaid 2026 Template Variant)

Harvested source:

1. [`reference-patterns/marklogic/triggers/medicaid-2026-template/corticonTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-2026-template/corticonTrigger.sjs)
2. [`reference-patterns/marklogic/triggers/medicaid-2026-template/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-2026-template/corticonTrigger.json)

Template equivalent:

1. [`marklogic/src/main/ml-modules/ext/corticonTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/corticonTrigger.sjs)
2. [`marklogic/src/main/ml-config/triggers/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-config/triggers/corticonTrigger.json)

Observed behavior:

1. trigger is disabled by default in config
2. skips URIs created by the resource path (avoids duplicate execution)
3. executes decision service
4. detects whether trace artifacts exist
5. builds `_decisionLedger` metadata envelope (record type, correlation, source URIs)
6. adds `_trace` collection only when trace artifacts are present

Why this is a strong template pattern:

1. supports both trigger and resource execution in one project
2. avoids recursive/duplicate processing
3. keeps query collections aligned with actual stored artifacts

## 6. Pattern D: Post-Commit Trigger with Domain-Specific Envelope (MedicaidEligibility)

Harvested source:

1. [`reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.sjs)
2. [`reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.json)

Observed behavior:

1. reads input doc from trigger `uri`
2. executes a domain-specific Corticon bundle (`medicaidDecisionServiceBundle.js`)
3. normalizes numeric strings while preserving identifiers (for example `householdId`, `ssn`)
4. unwraps multiple possible result shapes
5. creates an envelope with:
   - `payload`
   - `corticon.execution`
   - `corticon.inputPayloadUri`
   - `timestamp`
   - `enrichmentVersion`
6. writes a new document in `/data/medicaid/`

Why it is useful to study:

1. demonstrates identifier preservation during normalization
2. shows domain envelope versioning
3. shows use of metadata properties in `documentInsert`

## 7. Pattern E: Resource-Based Explicit Process-and-Enrich (Accenture / Template)

Harvested source:

1. [`reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.sjs)
2. [`reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.xml`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.xml)

Template implementation:

1. [`marklogic/src/main/ml-modules/services/processAndEnrich.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/services/processAndEnrich.sjs)
2. [`marklogic/src/main/ml-modules/services/processAndEnrich.xml`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/services/processAndEnrich.xml)
3. [`marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs)

Observed behavior differences:

1. Accenture version:
   - POST executes Corticon
   - stores result document only
   - returns stored URI
2. Template version:
   - validates request JSON
   - invokes an update module
   - stores both input and output docs
   - adds `_decisionLedger` metadata
   - supports array payloads (batch POST)

Why resource-based execution is useful:

1. easiest path for manual testing and demos
2. explicit control over when execution happens
3. easier to add request validation and response contracts

## 8. Choosing Trigger vs Resource (Decision Guide)

Choose trigger-first when:

1. ingestion is event-driven and document insertion should initiate decisioning
2. source systems already push into MarkLogic collections
3. you want automated enrichment on arrival

Choose resource-first when:

1. you want an explicit API call to run decisioning
2. you are building a demo UI or integration flow with manual submit actions
3. you want easier batch request support and request validation

Use both in one project when:

1. you need both an operator-driven test endpoint and production-style event trigger
2. you add safeguards to prevent double-processing (as seen in the template trigger)

## 9. Trigger Design Considerations (Non-Prescriptive)

### `pre-commit` vs `post-commit`

Observed:

1. Trade example uses `pre-commit`
2. Auto Insurance / Medicaid variants use `post-commit`

Considerations:

1. `pre-commit`
   - can enforce enrichment before transaction commit
   - simpler for in-place mutation patterns
2. `post-commit`
   - easier for separate-output-document patterns
   - reduces coupling to the incoming write transaction

### In-place vs Separate Output Documents

In-place:

1. simpler URI model
2. weaker raw-input preservation unless separately handled

Separate output:

1. stronger lineage and auditability
2. better for input/output compare UIs
3. requires collection and URI conventions

## 10. Minimal Testing Workflow (Template)

1. Deploy MarkLogic app (`mlDeploy`)
2. Test `processAndEnrich` via `curl`
3. Confirm output and input collections have documents
4. Enable trigger config only after validating the decision bundle and persistence shape
5. Insert one test input doc into watched collection
6. Confirm trigger-created output and collection tags

## 11. Related Articles

1. [`docs/05-collection-tagging-strategy.md`](05-collection-tagging-strategy.md)
2. [`docs/06-persisting-output-messages-and-trace.md`](06-persisting-output-messages-and-trace.md)
3. [`docs/07-tde-design-by-objective.md`](07-tde-design-by-objective.md)

