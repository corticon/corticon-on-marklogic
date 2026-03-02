# TDE Design by Objective (SQL and Optic over Decision Ledger Data)

This article explains how to design MarkLogic TDEs for different goals using patterns harvested from the reference projects.

The key idea: start from the question you need to answer, then choose the TDE shape.

## 1. What TDE Is Doing in This Repo Pattern

TDE (Template-Driven Extraction) lets MarkLogic project JSON documents into relational views without duplicating data into a separate warehouse.

In this repo pattern, TDE supports:

1. case-level explainability drilldown via SQL/Optic-backed services
2. rule message and trace analytics
3. cohort/population analytics
4. UI dashboards and charts

## 2. Core TDE Building Blocks (What You Will See in Files)

Most TDEs in the harvested patterns use:

1. `collections`
   - limits extraction to relevant docs
2. `context`
   - root path where extraction starts
3. `rows`
   - direct row projections
4. nested `templates`
   - row extraction from arrays/nested structures
5. `vars`
   - reusable values carried from parent context

Examples with all of these patterns appear in:

1. [`reference-patterns/marklogic/tde/eligibility-output.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-output.tde)
2. [`reference-patterns/marklogic/tde/eligibility-coa.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-coa.tde)
3. [`reference-patterns/marklogic/tde/accenture-corticon-alerts.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/accenture-corticon-alerts.tde)

## 3. Objective-Driven TDE Pattern Catalog

### Objective A: Simple Rule Message / Trace Audit Tables

Harvested example:

1. [`reference-patterns/marklogic/tde/trade-corticon.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/trade-corticon.tde)

Observed pattern:

1. small number of views
2. direct extraction from `/corticon/messages/message`
3. direct extraction from trace metric arrays

Use this when:

1. you need a quick SQL foothold for messages and attribute changes
2. the demo is focused on explaining rule events rather than complex domain joins

### Objective B: Case Drilldown + Nested Domain + Messages + Trace in One TDE

Harvested example:

1. [`reference-patterns/marklogic/tde/eligibility-output.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-output.tde)

Observed pattern:

1. root household row from `/payload`
2. nested individual rows
3. nested population rows
4. message rows from `corticon/messages/message`
5. trace attribute change rows from `corticon/Metrics/attributeChanges`

Use this when:

1. output docs already contain both business data and decision evidence
2. you want one TDE file to drive multiple SQL views for a case detail experience

Tradeoff:

1. one TDE can become large and harder to maintain as the domain grows

### Objective C: Split-Doc Analytics by Concern (Output vs Trace)

Harvested examples:

1. [`reference-patterns/marklogic/tde/eligibility-coa.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-coa.tde)
2. [`reference-patterns/marklogic/tde/eligibility-trace-flags.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-trace-flags.tde)

Observed pattern:

1. output docs and trace docs are split and stored in different collections
2. separate TDEs target each collection
3. trace TDE focuses on rule/trace analytics rows
4. output TDE focuses on program selection and eligibility outcomes

Use this when:

1. trace analytics are a first-class use case
2. output and trace have different document shapes or lifecycles
3. you want smaller, more focused TDEs

### Objective D: Broad Domain Analytics + Alert Relationships

Harvested examples:

1. [`reference-patterns/marklogic/tde/accenture-corticon-data.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/accenture-corticon-data.tde)
2. [`reference-patterns/marklogic/tde/accenture-corticon-alerts.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/accenture-corticon-alerts.tde)

Observed pattern:

1. one TDE extracts multiple entity-like views (`claims`, `patients`, etc.)
2. a separate TDE extracts alert rows plus relationship arrays (`related_*`)
3. collection scoping uses multiple overlapping collection tags

Use this when:

1. the demo includes a richer domain model beyond a single decision payload
2. you need alert-to-entity relationship analytics
3. you want reusable views for multiple UI screens

### Objective E: Wide Domain-Specific Case Model

Harvested example:

1. [`reference-patterns/marklogic/tde/medicaid-template.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/medicaid-template.tde)

Observed pattern:

1. large set of domain columns
2. nested templates for individuals and classes of assistance
3. preserves many domain flags for policy/program analysis

Use this when:

1. domain analysts need many columns directly available in SQL
2. you are modeling complex eligibility/determination data

Tradeoff:

1. wider schemas require more maintenance as payloads evolve

## 4. Template Starter TDE (How to Use It)

Template source:

1. [`marklogic/src/main/ml-schemas/tde/corticon-output.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-schemas/tde/corticon-output.tde)

What it provides:

1. a small, generic starting point
2. example extraction of payload fields and alert entities
3. tokenized collection scoping (`%%collectionPrefix%%_output`)

How to customize:

1. replace paths and column names with your domain payload paths
2. add separate TDEs for trace and message analytics if needed
3. keep TDEs grouped by objective rather than making one giant file early

## 5. How to Choose TDE Shape Based on Questions You Need to Answer

### If your main question is "Why did this one decision happen?"

Prioritize views for:

1. case header / summary
2. messages
3. trace changes (attribute/entity/association)
4. linked input/output URIs or correlation IDs

Good references:

1. [`reference-patterns/marklogic/tde/trade-corticon.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/trade-corticon.tde)
2. [`reference-patterns/marklogic/tde/eligibility-output.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-output.tde)

### If your main question is "Which rules fire most often, and for which cohorts?"

Prioritize views for:

1. trace rows (rule/rulesheet/sequence/action)
2. cohort/program attributes
3. correlation IDs / case IDs for drillback

Good references:

1. [`reference-patterns/marklogic/tde/eligibility-coa.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-coa.tde)
2. [`reference-patterns/marklogic/tde/eligibility-trace-flags.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-trace-flags.tde)
3. [`reference-patterns/marklogic/services/analytics-and-ui/analytics.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/analytics-and-ui/analytics.sjs) (Optic usage over TDE views)

### If your main question is "How do domain entities relate to alerts?"

Prioritize:

1. alert view
2. join/relationship views extracted from alert-related arrays

Good reference:

1. [`reference-patterns/marklogic/tde/accenture-corticon-alerts.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/accenture-corticon-alerts.tde)

## 6. TDE Design Considerations (Non-Prescriptive)

### Collection Scoping

Always confirm the TDE `collections` array matches where your documents actually land.

If you split output and trace docs, strongly consider separate TDEs per collection.

### Scalar Types

Choose scalar types based on query use:

1. `string` for IDs and codes (especially if formatting matters)
2. `integer`/`decimal` for aggregations and numeric comparisons
3. `boolean` for filterable flags
4. `date` when your source is consistently date-formatted

If numeric values arrive as strings, normalize them before relying on numeric TDE types (see harvested trigger patterns for numeric normalization examples).

### Nullability and Invalid Values

Use nullable columns generously during initial schema evolution.

The Trade TDE example also shows use of `invalidValues` handling for robustness:

1. [`reference-patterns/marklogic/tde/trade-corticon.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/trade-corticon.tde)

### Variables (`vars`) for Parent Keys

Nested templates often need parent values (for example household ID or alert ID). Use `vars` rather than repeating fragile relative paths.

Good examples:

1. [`reference-patterns/marklogic/tde/eligibility-output.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-output.tde)
2. [`reference-patterns/marklogic/tde/eligibility-coa.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-coa.tde)
3. [`reference-patterns/marklogic/tde/accenture-corticon-alerts.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/accenture-corticon-alerts.tde)

## 7. SQL and Optic Usage Patterns in the Harvested Projects

SQL examples (harvested):

1. [`reference-patterns/marklogic/sql-examples/eligibility-pathways-queries.md`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/sql-examples/eligibility-pathways-queries.md)
2. [`reference-patterns/marklogic/sql-examples/auto-insurance-queries.md`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/sql-examples/auto-insurance-queries.md)

Optic example service (harvested):

1. [`reference-patterns/marklogic/services/analytics-and-ui/analytics.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/analytics-and-ui/analytics.sjs)

This demonstrates a common repo pattern:

1. TDE defines views
2. SQL/Optic queries those views
3. MarkLogic resource service returns API-friendly JSON for the UI

## 8. Beginner Iteration Workflow for TDE Design

1. Start with one small TDE and one view
2. Load a few documents
3. Verify rows via SQL/Optic
4. Add one new nested view at a time
5. Add trace/message views after payload views are stable
6. Split TDE files by concern when they get hard to reason about

## 9. Common Mistakes

1. TDE collection scope does not match inserted document collections
2. column paths assume a payload shape that your trigger/resource did not persist
3. numeric columns defined for string values that were never normalized
4. giant monolithic TDE before the envelope shape is stable
5. no correlation/case key in trace views, making drillback difficult

## Related Articles

1. [`docs/05-collection-tagging-strategy.md`](05-collection-tagging-strategy.md)
2. [`docs/06-persisting-output-messages-and-trace.md`](06-persisting-output-messages-and-trace.md)
3. [`docs/09-fasttrack-component-patterns.md`](09-fasttrack-component-patterns.md)

