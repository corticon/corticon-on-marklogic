# Persisting Output, Rule Messages, and Rule Trace Data

This article covers one of the most important design decisions in an explainable decision ledger: how to persist decision artifacts.

The harvested projects demonstrate several valid patterns. The template supports multiple options and does not assume one mandatory shape.

## 1. Decision Artifacts to Think About Separately

For each evaluated record, you may need to persist some or all of:

1. input payload (raw or normalized)
2. output payload (enriched or derived)
3. rule messages (human-readable reasons/warnings/violations)
4. rule trace / metrics (attribute changes, entity changes, associations, sequence)
5. linkage metadata (correlation IDs, input/output URIs, timestamps, version)

Even if all artifacts come back in one Corticon response, you do not have to store them in one document forever.

## 2. Observed Persistence Shapes (Harvested Patterns)

### A. In-Place Enrichment (Single Document)

Harvested source:

1. [`reference-patterns/marklogic/triggers/trade-data-settlement/marklogic.trigger.sample.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/trade-data-settlement/marklogic.trigger.sample.sjs)

Observed behavior:

1. read input document
2. execute decision service
3. normalize output shape
4. overwrite same URI with enriched content

Pros:

1. simple operational model
2. one URI per case

Cons:

1. weak raw-input preservation
2. harder input-vs-output comparison unless embedded

### B. Separate Output Document Linked to Input

Harvested sources:

1. [`reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.sjs)
2. [`reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.sjs)

Observed behavior:

1. input remains in watched input collection
2. trigger writes a new output document
3. output document carries `inputPayloadUri`
4. envelope usually includes `payload` + `corticon`

Pros:

1. preserves source input
2. strong case-level explainability drilldown
3. cleaner UI "before/after" patterns

Cons:

1. more documents and URI strategy work

### C. Explicit Input + Output Pair Persistence with Correlation Metadata (Template Resource Pattern)

Template source:

1. [`marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs)

Observed behavior:

1. stores input doc and output doc as separate records
2. adds `_decisionLedger` metadata to both
3. stores correlation ID and linked URIs
4. supports batch processing (one pair per array item)
5. adds trace collection tag only when trace artifacts exist

This is a strong beginner-friendly pattern because it makes lineage explicit without forcing a separate trace document on day one.

### D. Split Trace Into Separate Case-Level Trace Documents (Post-Processing Pattern)

Harvested sources:

1. [`reference-patterns/marklogic/data-prep/split_output.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/split_output.py)
2. [`reference-patterns/marklogic/data-prep/enrich_trace.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/enrich_trace.py)
3. [`reference-patterns/marklogic/tde/eligibility-trace-flags.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-trace-flags.tde)

Observed behavior:

1. output is split to case-level docs
2. trace rows are enriched and split to separate case-level trace docs
3. trace is stored in a distinct collection and queried via dedicated TDEs

This pattern is especially useful for trace analytics dashboards and rule hotspot analysis.

## 3. Envelope Design: Common Field Shapes Observed

Common top-level fields across harvested patterns:

1. `payload`
2. `corticon`
3. `inputPayloadUri`
4. `_decisionLedger`
5. `timestamp`
6. `enrichmentVersion`

Important note:

1. field names vary by project
2. some projects put lineage fields at top level
3. some projects nest them under `corticon`
4. the template favors `_decisionLedger` for operational linkage metadata

## 4. The Template `_decisionLedger` Metadata Pattern

Template modules add a `_decisionLedger` object containing metadata such as:

1. `recordType` (`input` / `output`)
2. `createdBy` (`processAndEnrich` or `corticonTrigger`)
3. `collectionPrefix`
4. `correlationId`
5. linked input/output URIs

See:

1. [`marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs)
2. [`marklogic/src/main/ml-modules/ext/corticonTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/corticonTrigger.sjs)

Why this helps:

1. UI drilldown logic becomes generic
2. analytics services can filter by record type and source
3. multiple ingestion paths can coexist in one project

## 5. When to Break Out Trace into Distinct Files/Docs

The user requirement for this repo explicitly calls out considering separate trace persistence. That is a good design question.

Break trace out into distinct docs when:

1. trace payloads are much larger than business output payloads
2. trace is queried independently (rule analytics, hotspots, change sequences)
3. you want different retention policies for trace vs output
4. UI loads output frequently but trace only on drilldown
5. TDEs for trace need different row modeling than output TDEs

Keep trace in the same doc when:

1. payloads are small
2. case-level drilldown is the primary goal
3. you want fewer documents and simpler writes initially

## 6. When to Break Out Rule Messages into Distinct Files/Docs

This is less common in the harvested patterns, but it is a valid design option.

Consider separate message docs when:

1. message volumes are high
2. you need message retention/audit independent of payload retention
3. multiple message-producing systems contribute to the same case

Keep messages in output docs when:

1. messages are primarily used for case-level explanations
2. you want simpler writes and simpler document retrieval

TDEs can still extract messages from embedded arrays (see `eligibility-output.tde` and `trade-corticon.tde`).

## 7. URI and Correlation Design Considerations

Observed URI strategies:

1. overwrite same URI (in-place)
2. derive output URI from business ID (`applicationId`, `householdId`)
3. derive output URI from input URI hash or timestamp
4. store explicit correlation IDs in metadata

What to decide early:

1. Is URI the business ID, or is URI opaque and business ID a field?
2. How will the UI find linked input/output/trace docs?
3. Will reprocessing create new outputs or replace prior outputs?

The template uses explicit correlation metadata to make linking easier regardless of URI strategy.

## 8. Collection Tagging and Persistence Are Coupled

Persistence shape and collection design must be planned together.

Examples:

1. if trace is embedded, `_trace` collection tagging may be conditional on trace presence
2. if trace is split, trace docs should land in a dedicated trace collection
3. if messages are embedded, output TDE can extract messages directly
4. if messages are split, message TDE may need a separate collection scope

See:

1. [`docs/05-collection-tagging-strategy.md`](05-collection-tagging-strategy.md)
2. [`docs/07-tde-design-by-objective.md`](07-tde-design-by-objective.md)

## 9. TDE and UI Consequences (Important for Novices)

### If you store everything together

Pros:

1. one document fetch can power a case detail page
2. fewer write operations

Cons:

1. larger documents
2. trace-heavy docs may slow UI retrieval
3. TDEs may need more complex nested extraction

### If you split payload and trace

Pros:

1. faster common-case UI reads (output only)
2. cleaner trace analytics TDEs
3. separate lifecycle and permissions are possible

Cons:

1. more URIs/links to manage
2. more joins in UI/services

## 10. Practical Starter Patterns (Recommended Options)

### Option 1: Beginner-friendly Template Default

1. separate input and output docs
2. embed messages + trace in output initially
3. add `_decisionLedger` metadata
4. use `<prefix>_input`, `<prefix>_output`, and conditional `<prefix>_trace`

### Option 2: Analytics-first Explainability Design

1. separate input docs
2. separate output docs
3. separate trace docs (case-linked)
4. optional message extraction or separate message docs
5. dedicated TDEs per artifact type

The Eligibility Pathways split-output + split-trace pattern is a good study reference for Option 2.

## 11. Implementation Checklist

1. Decide document boundaries (input/output/trace/messages)
2. Decide URI strategy and correlation fields
3. Implement persistence in trigger/resource module
4. Tag collections consistently
5. Add TDEs for the chosen shape
6. Test case drilldown and SQL analytics paths
7. Document your envelope shape for UI developers

## Related Articles

1. [`docs/03-data-ingestion-and-decision-trigger-patterns.md`](03-data-ingestion-and-decision-trigger-patterns.md)
2. [`docs/05-collection-tagging-strategy.md`](05-collection-tagging-strategy.md)
3. [`docs/07-tde-design-by-objective.md`](07-tde-design-by-objective.md)
4. [`docs/09-fasttrack-component-patterns.md`](09-fasttrack-component-patterns.md)

