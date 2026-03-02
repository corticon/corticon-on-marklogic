# Template Scope and Migration Notes

This local copy is sourced from the canonical template repository:

- <https://github.com/corticon/explainable-decision-ledger/blob/main/decision-ledger-accelerator-template/README.md>

---
This folder is now documentation-only.

The runnable template implementation was moved to repository root so new projects use one canonical layout:

1. [`.env.template`](../.env.template)
2. [`scripts/`](../scripts)
3. [`marklogic/`](../marklogic)
4. [`ui-fasttrack/`](../ui-fasttrack)

## Why This Changed

The repository now treats root as the standalone accelerator template and keeps this folder only for template scope/migration documentation.

## Use These Docs With The Root Template

1. [`Initial Environment Setup`](../docs/01-initial-environment-setup.md)
2. [`Common Foundation Across Projects`](../docs/02-common-foundation-across-projects.md)
3. [`Data Ingestion and Decision Trigger Patterns`](../docs/03-data-ingestion-and-decision-trigger-patterns.md)
4. [`Collection Tagging Strategy`](../docs/05-collection-tagging-strategy.md)
5. [`Persisting Output, Messages, and Trace`](../docs/06-persisting-output-messages-and-trace.md)
6. [`TDE Design by Objective`](../docs/07-tde-design-by-objective.md)
7. [`Initial FastTrack Setup`](../docs/08-fasttrack-initial-setup.md)
8. [`FastTrack Component Patterns`](../docs/09-fasttrack-component-patterns.md)

