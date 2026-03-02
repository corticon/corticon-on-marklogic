# Collection Tagging Strategy (Design Considerations)

Collections are one of the most important design choices in a MarkLogic-based decision ledger.

This article documents the collection patterns observed in the harvested projects and shows how the template keeps collection naming generic through `collectionPrefix`.

## 1. Why Collections Matter in This Pattern

Collections are used for:

1. trigger watch scopes
2. query isolation (input vs output vs trace)
3. TDE template scoping
4. UI filters and data access boundaries
5. operational separation of demo/reference data

In a decision ledger, collection design directly affects explainability and analytics usability.

## 2. Observed Collection Naming Patterns

### A. Domain-Specific URI-Style Collection Names

Examples from harvested trigger/TDE patterns:

1. `http://example.com/data/ledger`
2. `http://example.com/data/policy-input`
3. `http://example.com/data/policy`
4. `http://example.com/data/medicaid-input`
5. `http://example.com/data/medicaid`
6. `http://example.com/data/eligibility-output`
7. `http://example.com/data/eligibility-trace`

Visible in:

1. [`reference-patterns/marklogic/triggers/trade-data-settlement/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/trade-data-settlement/corticonTrigger.json)
2. [`reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.json)
3. [`reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.json)
4. [`reference-patterns/marklogic/tde/eligibility-output.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-output.tde)
5. [`reference-patterns/marklogic/tde/eligibility-trace-flags.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-trace-flags.tde)
6. [`reference-patterns/marklogic/tde/medicaid-template.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/medicaid-template.tde)

### B. Multi-Tag Business + Analytics Collections (Accenture Pattern)

Observed example collections:

1. `corticon-results`
2. `fraud-detection`
3. `decision-audit`

Visible in:

1. [`reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.sjs)
2. [`reference-patterns/marklogic/tde/accenture-corticon-data.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/accenture-corticon-data.tde)
3. [`reference-patterns/marklogic/tde/accenture-corticon-alerts.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/accenture-corticon-alerts.tde)

This pattern supports overlapping retrieval use cases (result domain + audit + feature area).

### C. Template Prefix-Based Collections (Generic Starter Pattern)

Template examples:

1. `<prefix>`
2. `<prefix>_input`
3. `<prefix>_output`
4. `<prefix>_trace`

Implemented in:

1. [`marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs)
2. [`marklogic/src/main/ml-modules/ext/corticonTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/corticonTrigger.sjs)
3. [`marklogic/src/main/ml-data/split/**/collections.properties`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-data/split/**/collections.properties)

This keeps the starter template reusable without hard-coding domain names.

## 3. Recommended Collection Layers to Consider (Not Mandatory)

Based on the harvested patterns, a practical collection scheme usually benefits from multiple dimensions:

1. project/use-case
   - example: `<prefix>`
2. artifact type
   - example: `<prefix>_input`, `<prefix>_output`, `<prefix>_trace`
3. optional business topic
   - example: `fraud-detection`
4. optional operational/audit purpose
   - example: `decision-audit`

You do not need all layers for every demo.

## 4. Trigger Watch Collections vs Query Collections

A common beginner mistake is using one collection for everything.

Better pattern (observed across projects):

1. input/watch collection (trigger scope)
2. separate output collection
3. optional separate trace collection

Why:

1. prevents accidental trigger loops
2. makes UI and TDE scoping simpler
3. avoids mixing raw input docs with enriched decision artifacts

Template trigger support for separate output/trace tagging:

1. [`marklogic/src/main/ml-modules/ext/corticonTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/corticonTrigger.sjs)

## 5. Dynamic Trace Collection Tagging (Template Pattern)

The template trigger and resource modules check whether a result contains trace artifacts and only then add `<prefix>_trace`.

Why this is useful:

1. keeps trace collection semantically meaningful
2. avoids polluting trace analytics with non-trace docs
3. supports mixed workloads where some executions omit trace/metrics

See:

1. [`marklogic/src/main/ml-modules/ext/corticonTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/corticonTrigger.sjs)
2. [`marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs)

## 6. Split-Data Collection Metadata Files

When using `mlLoadData`, the folder-level `collections.properties` pattern is a major productivity and consistency improvement.

Template examples:

1. [`marklogic/src/main/ml-data/split/claim/collections.properties`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-data/split/claim/collections.properties)
2. [`marklogic/src/main/ml-data/split/corticon/entities/alert/collections.properties`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-data/split/corticon/entities/alert/collections.properties)

Observed pattern:

1. claim-like/reference docs tagged as output/business collections
2. alert/trace-like docs also tagged with trace/explainability collection

This supports clean TDE scoping later.

## 7. TDE Collection Scoping Depends on Your Collection Strategy

TDE templates often scope extraction to collections.

Examples:

1. [`reference-patterns/marklogic/tde/eligibility-output.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-output.tde) scopes to output collection
2. [`reference-patterns/marklogic/tde/eligibility-trace-flags.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-trace-flags.tde) scopes to trace collection
3. [`reference-patterns/marklogic/tde/accenture-corticon-data.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/accenture-corticon-data.tde) scopes to multiple business/audit collections

If you change collections, remember to update:

1. trigger/resource `documentInsert` calls
2. `collections.properties`
3. TDE `collections` arrays
4. UI query/resource filters

## 8. Naming Considerations for Novices

Questions to answer before choosing names:

1. Do I need to preserve raw input docs separately?
2. Will trace be queried independently from output?
3. Will multiple demos share one MarkLogic instance?
4. Do I want domain-specific names or generic template names at first?
5. Will SQL views target output only, trace only, or both?

## 9. Practical Starter Recommendation (Safe Default)

For first-time template use, start with:

1. `<prefix>_input`
2. `<prefix>_output`
3. `<prefix>_trace`

Then add domain/business/audit tags only when you need them for filtering, governance, or dashboard segmentation.

## 10. Validation Checklist

After implementing your collection scheme, verify:

1. trigger watch collection matches the collection you actually insert input docs into
2. output docs are not landing in the input-only collection
3. trace docs (or docs with trace artifacts) are queryable via your trace collection
4. TDEs extract rows from the intended collections only
5. UI explorer and analytics endpoints query the right collection(s)

## Related Articles

1. [`docs/03-data-ingestion-and-decision-trigger-patterns.md`](03-data-ingestion-and-decision-trigger-patterns.md)
2. [`docs/06-persisting-output-messages-and-trace.md`](06-persisting-output-messages-and-trace.md)
3. [`docs/07-tde-design-by-objective.md`](07-tde-design-by-objective.md)

