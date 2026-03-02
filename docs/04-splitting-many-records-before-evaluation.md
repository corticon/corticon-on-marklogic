# Splitting Many Records Before Evaluation (and Related Split Patterns)

This article covers a common demo-design challenge: handling documents that contain many records.

The harvested projects show multiple split strategies, depending on when and why you split:

1. before decision evaluation (ingestion prep)
2. after decision evaluation (analytics/query prep)
3. trace-only split/enrichment for explainability analytics
4. batch resource processing without pre-splitting (array POST)

## 1. Why Splitting Matters

Large aggregated documents are often hard to use for:

1. trigger event processing (one event vs many logical records)
2. URI design and idempotent writes
3. explainability drilldown in a UI
4. TDE extraction and SQL joins
5. performance when reading many cases

Splitting can make each logical case a document.

## 2. Pattern A: Split Input Before Evaluation (Auto Insurance)

Harvested source:

1. [`reference-patterns/marklogic/data-prep/split-auto-policies.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/split-auto-policies.sjs)

Observed behavior:

1. reads one aggregated input JSON array document from MarkLogic
2. loops through records
3. inserts one document per record into an input collection
4. uses `applicationId` (or random fallback) for URI naming

Why this pattern is useful:

1. lets a trigger fire once per logical record
2. simplifies downstream output URI naming
3. improves case-level debugging and replay

When to use it:

1. your source data lands as one large array file
2. your trigger logic expects single-record documents

## 3. Pattern B: Keep Aggregated Input, Use Resource Batch POST (Template)

Template source:

1. [`marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs)

Observed behavior:

1. accepts a JSON array request body
2. processes each array element
3. writes one input/output pair per element
4. returns batch summary with item-level URIs

Why this is useful:

1. no pre-splitting step is required
2. still produces per-record persisted documents
3. easier for demo APIs and batch test harnesses

Tradeoff:

1. batch handling is now the responsibility of the resource module

## 4. Pattern C: Split Output for Queryability (Eligibility Pathways)

Harvested source:

1. [`reference-patterns/marklogic/data-prep/split_output.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/split_output.py)

Observed behavior:

1. reads an aggregated output document with many objects (`Objects[]`)
2. extracts one logical household/application per output doc
3. creates URI-friendly filenames (`household-001.json`, etc.)
4. optionally carries shared top-level message metadata into each split doc

Why this pattern is useful:

1. each household becomes directly queryable and viewable
2. easier TDE context paths for household-level SQL views
3. easier front-end drilldown by case id

Important observed detail:

1. the script normalizes household IDs carefully (preserving strings while supporting zero-padded output filenames)

## 5. Pattern D: Split and Enrich Trace Rows into Case-Level Trace Docs (Eligibility Pathways)

Harvested source:

1. [`reference-patterns/marklogic/data-prep/enrich_trace.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/enrich_trace.py)

Observed behavior:

1. builds an index from split output docs (maps entity IDs to household/person/program context)
2. reads aggregated trace data (`trace[]`)
3. links trace rows to cases using entity IDs (for example COA entity IDs)
4. writes one trace document per household
5. sorts trace rows by sequence

Why this pattern is especially important for explainability demos:

1. trace data often arrives in a format optimized for rules execution, not UI analytics
2. linking trace rows to case/person/program context makes trace dashboards much easier to build
3. enables separate trace collection + TDE design focused on rule firing analytics

## 6. Pattern E: Split Reference Data for Deterministic MarkLogic Loads

Template and harvested patterns also use split-doc organization for reference data loaded via `mlLoadData`.

Template examples:

1. [`marklogic/src/main/ml-data/split/claim/`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-data/split/claim)
2. [`marklogic/src/main/ml-data/split/explanationOfBenefit/`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-data/split/explanationOfBenefit)
3. [`marklogic/src/main/ml-data/split/corticon/entities/alert/`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-data/split/corticon/entities/alert)

Each leaf folder contains:

1. `collections.properties`
2. `permissions.properties`

This is not only about size; it is also about deterministic metadata assignment.

## 7. Choosing a Split Strategy (Decision Guide)

Choose pre-evaluation splitting when:

1. triggers should process one logical case per document
2. source arrives as arrays
3. case-level replay/reprocessing matters

Choose post-evaluation output splitting when:

1. decision outputs are aggregated but UI/SQL needs case-level docs
2. TDE paths are easier from split docs
3. you want faster targeted document retrieval in the UI

Choose separate trace splitting when:

1. trace rows are large and cross-case
2. explainability analytics are a primary goal
3. you want independent trace lifecycle and TDEs

Choose batch resource POST without pre-splitting when:

1. API simplicity is more important than ingest-trigger semantics
2. you still want per-record persistence

## 8. Practical Design Considerations (Non-Prescriptive)

1. URI naming
   - Prefer stable business IDs when available (`applicationId`, `householdId`)
   - Add safe fallback logic when IDs are missing

2. ID normalization
   - Preserve identifiers as strings when formatting is significant (leading zeros, SSNs)
   - Normalize numeric fields only when analytics/logic requires numeric types

3. Lineage fields
   - Add links such as `inputPayloadUri`, `outputPayloadUri`, and correlation IDs

4. File size and performance
   - Split when single docs become hard to query, render, or debug

5. TDE scope
   - Split docs often allow simpler TDE contexts and fewer path edge cases

## 9. Suggested Beginner Workflow

1. Start with resource-based batch POST in the template
2. Persist one input/output pair per record
3. Add TDEs and verify SQL
4. If data is too aggregated for your goals, add a split step
5. If you need event-driven behavior, add trigger-based pre-split or trigger-on-split-input design

## Related Articles

1. [`docs/03-data-ingestion-and-decision-trigger-patterns.md`](03-data-ingestion-and-decision-trigger-patterns.md)
2. [`docs/06-persisting-output-messages-and-trace.md`](06-persisting-output-messages-and-trace.md)
3. [`docs/07-tde-design-by-objective.md`](07-tde-design-by-objective.md)

