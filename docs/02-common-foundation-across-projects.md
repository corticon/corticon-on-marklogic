# Common Foundation Across Projects

This article explains the shared building blocks found across the harvested reference projects and the template.

The goal is to give you a stable mental model before you choose a specific trigger, persistence, TDE, or UI pattern.

## 1. Shared Architecture Pattern

Across the harvested implementations, the common pattern is:

1. MarkLogic stores source and decision-related documents
2. MarkLogic server-side JavaScript executes a Corticon bundle
3. decision artifacts are persisted in documents
4. MarkLogic APIs/TDE/Optic expose data to applications and analytics
5. a middle tier and/or FastTrack UI consumes those endpoints

This is visible in multiple harvested files, including:

1. [`reference-patterns/marklogic/triggers/trade-data-settlement/marklogic.trigger.sample.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/trade-data-settlement/marklogic.trigger.sample.sjs)
2. [`reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/triggers/auto-insurance/autoInsuranceTrigger.sjs)
3. [`reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/resource-process-and-enrich/processAndEnrich.sjs)
4. [`marklogic/src/main/ml-modules/services/processAndEnrich.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/services/processAndEnrich.sjs)

## 2. ml-gradle Project Layout (MarkLogic Side)

The template follows the standard ml-gradle layout:

1. `src/main/ml-config`
2. `src/main/ml-modules`
3. `src/main/ml-schemas`
4. `src/main/ml-data`

In the template, this is already prepared under:

1. [`marklogic/src/main/`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main)

What each area does:

1. `ml-config`
   - databases, servers, roles, users, triggers, REST app settings
2. `ml-modules`
   - SJS modules, resource extensions, search options, Corticon bundle
3. `ml-schemas`
   - TDE definitions and related schema assets
4. `ml-data`
   - loadable seed/reference/split documents plus metadata files

## 3. Configuration Template Pattern (Tracked vs Generated)

The template intentionally separates tracked config templates from generated local config.

Tracked:

1. [`.env.template`](https://github.com/corticon/explainable-decision-ledger/blob/main/.env.template)
2. [`marklogic/gradle-template.properties`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/gradle-template.properties)
3. [`ui-fasttrack/proxy/config-template.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/config-template.js)

Generated/local:

1. `.env`
2. `marklogic/gradle.properties`
3. `ui-fasttrack/proxy/config.js`

Why this matters:

1. keeps credentials out of git
2. keeps the template reusable
3. makes the setup steps explicit for novice users

## 4. Tokenized Configuration in MarkLogic Assets

The template and several harvested patterns use token placeholders in JSON/SJS config files, such as:

1. `%%mlAppName%%`
2. `%%MODULES_DATABASE%%`
3. `%%collectionPrefix%%`

You can see this in:

1. [`marklogic/src/main/ml-config/triggers/corticonTrigger.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-config/triggers/corticonTrigger.json)
2. [`marklogic/src/main/ml-modules/ext/corticonTrigger.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/corticonTrigger.sjs)
3. [`marklogic/src/main/ml-data/split/**/collections.properties`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-data/split/**/collections.properties)

This pattern keeps template files generic while allowing per-project names and ports.

## 5. Collection Prefix Pattern (Project-Scoped Names)

The template uses a project-scoped `collectionPrefix` pattern instead of hard-coding use-case names.

Common template collection tags:

1. `<prefix>`
2. `<prefix>_input`
3. `<prefix>_output`
4. `<prefix>_trace`

This behavior is tied to:

1. [`scripts/init-from-env.ps1`](https://github.com/corticon/explainable-decision-ledger/blob/main/scripts/init-from-env.ps1)
2. [`marklogic/gradle-template.properties`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/gradle-template.properties)
3. [`marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/processAndEnrichUpdate.sjs)

The script derives `COLLECTION_PREFIX` from the folder name if you leave it blank.

## 6. Security Role/User Provisioning Pattern

The template includes tokenized MarkLogic roles and users in:

1. [`marklogic/src/main/ml-config/security/roles/`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-config/security/roles)
2. [`marklogic/src/main/ml-config/security/users/`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-config/security/users)

This means novice users can deploy a working app-scoped reader/writer/admin set without manually creating everything in the MarkLogic Admin UI.

Critical guardrail:

1. keep the app admin user token (`%%usernameAdmin%%` / `MARKLOGIC_APP_ADMIN_USERNAME`) separate from cluster admin credentials
2. never set app admin username to `admin`

If app user tokens are mapped to cluster admin accounts, a deployment can overwrite admin role assignments and block both Admin UI access (`SEC-NOADMIN`) and Manage API writes.

## 7. Resource vs Trigger Is a Design Choice (Not a Repo Constraint)

The template includes both because harvested projects demonstrate both:

1. resource-driven execution
2. trigger-driven execution

The template does not assume one is always better.

Read the comparison in:

1. [`docs/03-data-ingestion-and-decision-trigger-patterns.md`](03-data-ingestion-and-decision-trigger-patterns.md)

## 8. Split Data + Metadata Files Pattern

A recurring design pattern is version-controlling split JSON docs and assigning metadata with leaf-folder property files:

1. `collections.properties`
2. `permissions.properties`

Template examples:

1. [`marklogic/src/main/ml-data/split/claim/collections.properties`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-data/split/claim/collections.properties)
2. [`marklogic/src/main/ml-data/split/corticon/entities/alert/collections.properties`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-data/split/corticon/entities/alert/collections.properties)

## 9. SQL/TDE Is an Access Pattern, Not a Separate Data Warehouse

A major theme across the harvested projects is using TDE to project JSON into SQL views without copying the data to a separate analytic store.

Examples:

1. [`reference-patterns/marklogic/tde/trade-corticon.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/trade-corticon.tde)
2. [`reference-patterns/marklogic/tde/eligibility-output.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-output.tde)
3. [`reference-patterns/marklogic/tde/eligibility-trace-flags.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/eligibility-trace-flags.tde)
4. [`reference-patterns/marklogic/tde/medicaid-template.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/medicaid-template.tde)
5. [`reference-patterns/marklogic/tde/accenture-corticon-alerts.tde`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/tde/accenture-corticon-alerts.tde)

See [`docs/07-tde-design-by-objective.md`](07-tde-design-by-objective.md) for how to choose TDE shapes based on your UI/analytics goals.

## 10. Build/Generated Boundaries (Important for This Template Repo)

The repository intent is to include source/template files and exclude machine-generated/local files.

Common examples of generated/local files to keep out of template commits:

1. `marklogic/gradle.properties`
2. `ui-fasttrack/proxy/config.js`
3. `node_modules/`
4. `build/`, `dist/`
5. local FastTrack `.tgz` archives

This is enforced by:

1. root `.gitignore`
2. template-local `.gitignore` files

## 11. What To Edit First in a New Project (Practical Order)

1. `.env` (generated from `.env.template`)
2. `marklogic/src/main/ml-modules/ext/decisionServiceBundle.js`
3. `marklogic/src/main/ml-config/*` names/ports/security if needed
4. `marklogic/src/main/ml-modules/services/*` or `ext/*Trigger.sjs`
5. `marklogic/src/main/ml-schemas/tde/*.tde`
6. UI proxy config + project UI components

## Next Article

Continue with:

1. [`docs/03-data-ingestion-and-decision-trigger-patterns.md`](03-data-ingestion-and-decision-trigger-patterns.md)

