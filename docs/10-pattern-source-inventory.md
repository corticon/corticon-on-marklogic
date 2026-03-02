# Pattern Source Inventory (Harvest Map)

This article records the provenance of the curated [`reference-patterns/`](https://github.com/corticon/explainable-decision-ledger/tree/main/reference-patterns) files.

Purpose:

1. make the template/docs references stable
2. preserve traceability back to the original reference implementations
3. clarify which files were harvested for design-pattern reuse

## Current Repository State (Important)

The original full [`reference projects/`](https://github.com/corticon/explainable-decision-ledger/tree/main/reference%20projects) demo tree is no longer kept in the active repo layout for this workspace.

It has been replaced with a stub folder and preserved locally (ignored by git) in:

1. [`legacy-archives-local/reference-projects-full-20260225`](https://github.com/corticon/explainable-decision-ledger/tree/main/legacy-archives-local/reference-projects-full-20260225)

The source paths listed below still refer to the original tree layout for provenance.

## Scope and Selection Criteria

The harvested set focuses on files that best preserve reusable design patterns:

1. MarkLogic trigger configs and trigger modules
2. resource-based decision execution modules
3. TDE templates
4. data splitting and Flux loading scripts/options
5. analytics/search/chat backend resource services
6. UI API and component patterns
7. SQL example query docs

Large data files and full app scaffolds were not copied into [`reference-patterns/`](https://github.com/corticon/explainable-decision-ledger/tree/main/reference-patterns); the template and docs instead preserve the reusable patterns.

## MarkLogic Trigger Patterns

1. [`reference-patterns/marklogic/triggers/trade-data-settlement/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/trade-data-settlement/corticonTrigger.json)
   <- [`reference projects/Trade Data Settlement/src/main/ml-config/triggers/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Trade Data Settlement/src/main/ml-config/triggers/corticonTrigger.json)

2. [`reference-patterns/marklogic/triggers/trade-data-settlement/marklogic.trigger.sample.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/trade-data-settlement/marklogic.trigger.sample.sjs)
   <- [`reference projects/Trade Data Settlement/src/main/ml-modules/ext/marklogic.trigger.sample.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Trade Data Settlement/src/main/ml-modules/ext/marklogic.trigger.sample.sjs)

3. [`reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.json)
   <- [`reference projects/Auto Insurance/mlCorticonAutoInsurance/src/main/ml-config/triggers/autoInsuranceTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/mlCorticonAutoInsurance/src/main/ml-config/triggers/autoInsuranceTrigger.json)

4. [`reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.sjs)
   <- [`reference projects/Auto Insurance/mlCorticonAutoInsurance/src/main/ml-modules/ext/autoInsuranceTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/mlCorticonAutoInsurance/src/main/ml-modules/ext/autoInsuranceTrigger.sjs)

5. [`reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.json)
   <- [`reference projects/MedicaidEligibility/src/main/ml-config/triggers/medicaidTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/MedicaidEligibility/src/main/ml-config/triggers/medicaidTrigger.json)

6. [`reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-eligibility/medicaidTrigger.sjs)
   <- [`reference projects/MedicaidEligibility/src/main/ml-modules/ext/medicaidTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/MedicaidEligibility/src/main/ml-modules/ext/medicaidTrigger.sjs)

7. [`reference-patterns/marklogic/triggers/medicaid-2026-template/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-2026-template/corticonTrigger.json)
   <- [`reference projects/Medicaid 2026_v1/marklogic/src/main/ml-config/triggers/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Medicaid 2026_v1/marklogic/src/main/ml-config/triggers/corticonTrigger.json)

8. [`reference-patterns/marklogic/triggers/medicaid-2026-template/corticonTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/medicaid-2026-template/corticonTrigger.sjs)
   <- [`reference projects/Medicaid 2026_v1/marklogic/src/main/ml-modules/ext/corticonTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Medicaid 2026_v1/marklogic/src/main/ml-modules/ext/corticonTrigger.sjs)

## MarkLogic Resource / Analytics Service Patterns

1. [`reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.sjs)
   <- [`reference projects/accenture-demo/marklogic/src/main/ml-modules/services/processAndEnrich.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/accenture-demo/marklogic/src/main/ml-modules/services/processAndEnrich.sjs)

2. [`reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.xml`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.xml)
   <- [`reference projects/accenture-demo/marklogic/src/main/ml-modules/services/processAndEnrich.xml`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/accenture-demo/marklogic/src/main/ml-modules/services/processAndEnrich.xml)

3. [`reference-patterns/marklogic/services/analytics-and-ui/eligibility-options.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/analytics-and-ui/eligibility-options.sjs)
   <- [`reference projects/Eligibility Pathways/src/main/ml-modules/services/eligibility-options.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Eligibility Pathways/src/main/ml-modules/services/eligibility-options.sjs)

4. [`reference-patterns/marklogic/services/analytics-and-ui/analytics.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/analytics-and-ui/analytics.sjs)
   <- [`reference projects/Eligibility Pathways/src/main/ml-modules/services/analytics.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Eligibility Pathways/src/main/ml-modules/services/analytics.sjs)

5. [`reference-patterns/marklogic/services/analytics-and-ui/chatbot.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/analytics-and-ui/chatbot.sjs)
   <- [`reference projects/Eligibility Pathways/src/main/ml-modules/services/chatbot.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Eligibility Pathways/src/main/ml-modules/services/chatbot.sjs)

## TDE Patterns

1. [`reference-patterns/marklogic/tde/trade-corticon.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/trade-corticon.tde)
   <- [`reference projects/Trade Data Settlement/src/main/ml-schemas/tde/corticon.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Trade Data Settlement/src/main/ml-schemas/tde/corticon.tde)

2. [`reference-patterns/marklogic/tde/eligibility-output.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-output.tde)
   <- [`reference projects/Eligibility Pathways/src/main/ml-schemas/tde/eligibility-output.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Eligibility Pathways/src/main/ml-schemas/tde/eligibility-output.tde)

3. [`reference-patterns/marklogic/tde/eligibility-coa.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-coa.tde)
   <- [`reference projects/Eligibility Pathways/src/main/ml-schemas/tde/eligibility-coa.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Eligibility Pathways/src/main/ml-schemas/tde/eligibility-coa.tde)

4. [`reference-patterns/marklogic/tde/eligibility-trace-flags.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-trace-flags.tde)
   <- [`reference projects/Eligibility Pathways/src/main/ml-schemas/tde/eligibility-trace-flags.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Eligibility Pathways/src/main/ml-schemas/tde/eligibility-trace-flags.tde)

5. [`reference-patterns/marklogic/tde/medicaid-template.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/medicaid-template.tde)
   <- [`reference projects/MedicaidEligibility/src/main/ml-schemas/tde/medicaid-template.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/MedicaidEligibility/src/main/ml-schemas/tde/medicaid-template.tde)

6. [`reference-patterns/marklogic/tde/accenture-corticon-data.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/accenture-corticon-data.tde)
   <- [`reference projects/accenture-demo/marklogic/src/main/ml-schemas/tde/corticon-data.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/accenture-demo/marklogic/src/main/ml-schemas/tde/corticon-data.tde)

7. [`reference-patterns/marklogic/tde/accenture-corticon-alerts.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/accenture-corticon-alerts.tde)
   <- [`reference projects/accenture-demo/marklogic/src/main/ml-schemas/tde/corticon-alerts.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/accenture-demo/marklogic/src/main/ml-schemas/tde/corticon-alerts.tde)

## Data Preparation and Splitting Patterns

1. [`reference-patterns/marklogic/data-prep/split_output.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/split_output.py)
   <- [`reference projects/Eligibility Pathways/scripts/split_output.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Eligibility Pathways/scripts/split_output.py)

2. [`reference-patterns/marklogic/data-prep/enrich_trace.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/enrich_trace.py)
   <- [`reference projects/Eligibility Pathways/scripts/enrich_trace.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Eligibility Pathways/scripts/enrich_trace.py)

3. [`reference-patterns/marklogic/data-prep/split-auto-policies.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/split-auto-policies.sjs)
   <- [`reference projects/Auto Insurance/mlCorticonAutoInsurance/src/main/ml-modules/ext/split-auto-policies.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/mlCorticonAutoInsurance/src/main/ml-modules/ext/split-auto-policies.sjs)

## Flux Loading Patterns

1. [`reference-patterns/marklogic/data-prep/flux/README.md`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/flux/README.md)
   <- [`reference projects/accenture-demo/marklogic/flux/README.md`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/accenture-demo/marklogic/flux/README.md)

2. [`reference-patterns/marklogic/data-prep/flux/json-to-jsonl.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/flux/json-to-jsonl.py)
   <- [`reference projects/accenture-demo/marklogic/flux/json-to-jsonl.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/accenture-demo/marklogic/flux/json-to-jsonl.py)

3. [`reference-patterns/marklogic/data-prep/flux/flux-options-practitioners.txt`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/flux/flux-options-practitioners.txt)
   <- [`reference projects/accenture-demo/marklogic/flux/flux-options-practitioners.txt`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/accenture-demo/marklogic/flux/flux-options-practitioners.txt)

4. [`reference-patterns/marklogic/data-prep/flux/flux-options-organizations.txt`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/flux/flux-options-organizations.txt)
   <- [`reference projects/accenture-demo/marklogic/flux/flux-options-organizations.txt`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/accenture-demo/marklogic/flux/flux-options-organizations.txt)

5. [`reference-patterns/marklogic/data-prep/flux/flux-options-cptcodes.txt`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/flux/flux-options-cptcodes.txt)
   <- [`reference projects/accenture-demo/marklogic/flux/flux-options-cptcodes.txt`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/accenture-demo/marklogic/flux/flux-options-cptcodes.txt)

## SQL Example Query Docs

1. [`reference-patterns/marklogic/sql-examples/eligibility-pathways-queries.md`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/sql-examples/eligibility-pathways-queries.md)
   <- [`reference projects/Eligibility Pathways/queries.md`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Eligibility Pathways/queries.md)

2. [`reference-patterns/marklogic/sql-examples/auto-insurance-queries.md`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/sql-examples/auto-insurance-queries.md)
   <- [`reference projects/Auto Insurance/mlCorticonAutoInsurance/queries.md`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/mlCorticonAutoInsurance/queries.md)

## UI Integration and Component Patterns

1. [`reference-patterns/ui/auto-insurance/marklogicService.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/marklogicService.js)
   <- [`reference projects/Auto Insurance/insurance-chatbot/ui/src/api/marklogicService.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/insurance-chatbot/ui/src/api/marklogicService.js)

2. [`reference-patterns/ui/auto-insurance/PolicySearch.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/PolicySearch.jsx)
   <- [`reference projects/Auto Insurance/insurance-chatbot/ui/src/components/PolicySearch.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/insurance-chatbot/ui/src/components/PolicySearch.jsx)

3. [`reference-patterns/ui/auto-insurance/DecisionLog.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/DecisionLog.jsx)
   <- [`reference projects/Auto Insurance/insurance-chatbot/ui/src/components/DecisionLog.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/insurance-chatbot/ui/src/components/DecisionLog.jsx)

4. [`reference-patterns/ui/auto-insurance/ExecutionTrace.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/ExecutionTrace.jsx)
   <- [`reference projects/Auto Insurance/insurance-chatbot/ui/src/components/ExecutionTrace.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/insurance-chatbot/ui/src/components/ExecutionTrace.jsx)

5. [`reference-patterns/ui/auto-insurance/PolicyNetworkGraph.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/PolicyNetworkGraph.jsx)
   <- [`reference projects/Auto Insurance/insurance-chatbot/ui/src/components/PolicyNetworkGraph.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/insurance-chatbot/ui/src/components/PolicyNetworkGraph.jsx)

6. [`reference-patterns/ui/auto-insurance/PoliciesByState.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/PoliciesByState.jsx)
   <- [`reference projects/Auto Insurance/insurance-chatbot/ui/src/components/PoliciesByState.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/insurance-chatbot/ui/src/components/PoliciesByState.jsx)

7. [`reference-patterns/ui/auto-insurance/Chatbot.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/Chatbot.jsx)
   <- [`reference projects/Auto Insurance/insurance-chatbot/ui/src/components/Chatbot.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/insurance-chatbot/ui/src/components/Chatbot.jsx)

8. [`reference-patterns/ui/auto-insurance/ErrorBoundary.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/ErrorBoundary.jsx)
   <- [`reference projects/Auto Insurance/insurance-chatbot/ui/src/components/ErrorBoundary.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference%20projects/Auto Insurance/insurance-chatbot/ui/src/components/ErrorBoundary.jsx)

## Template Counterparts (Where Patterns Were Brought Forward)

Some harvested patterns already have generalized counterparts in the template:

1. resource execution and input/output persistence
   - [`marklogic/src/main/ml-modules/services/processAndEnrich.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/services/processAndEnrich.sjs)
   - [`marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs)

2. optional trigger execution
   - [`marklogic/src/main/ml-config/triggers/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-config/triggers/corticonTrigger.json)
   - [`marklogic/src/main/ml-modules/ext/corticonTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/corticonTrigger.sjs)

3. TDE starter
   - [`marklogic/src/main/ml-schemas/tde/corticon-output.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-schemas/tde/corticon-output.tde)

4. FastTrack proxy scaffold and markdown rendering
   - [`ui-fasttrack/proxy/server.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/server.js)
   - [`ui-fasttrack/proxy/handlers.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/handlers.js)
   - [`ui-fasttrack/reusable/MarkdownMessage.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/reusable/MarkdownMessage.jsx)

## How to Use This Inventory

1. Start with the template implementation.
2. Use this inventory to find a harvested variant when you need a different behavior.
3. Document which pattern you chose and why in your new project.

This keeps the repo usable as a template and as a design-pattern reference without requiring the legacy full demos.


