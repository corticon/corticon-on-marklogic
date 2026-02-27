# Explainable Decision Ledger with Corticon.js and MarkLogic

This repository demonstrates a domain-agnostic architecture for **explainable decision automation**:

1. Corticon.js Studio authors business rules.
2. Rules are compiled into JavaScript decision services.
3. MarkLogic executes those decision services on ingested JSON.
4. MarkLogic stores decision artifacts alongside source data.
5. FastTrack-style Node/React apps expose analytics and conversational explanations.

The result is an **Explainable Decision Ledger**: for each evaluated record, you can inspect input, outcome, rule messages, and full execution trace to explain exactly why a decision was made.

## Audience and Goal

This guide is for users who already know Corticon but are new to MarkLogic and FastTrack patterns.

By the end of this guide, you should be able to:

1. Install and initialize MarkLogic.
2. Deploy the MarkLogic stacks in this repo.
3. Load input/output/trace data and validate service-driven or trigger-driven enrichment.
4. Query decision evidence with REST and SQL (TDE).
5. Run or build FastTrack-style dashboards and chat experiences.
6. Implement a grounded LLM assistant that explains decision rationale without hallucinating.

## Repository Overview

Primary projects in this repository:

1. `accenture-demo`  
Purpose: **Authoritative reference implementation** for this repo's preferred Corticon.js + MarkLogic design pattern. It demonstrates a service-based "process-and-enrich" flow, strong ml-gradle project structure, tokenized security/configuration, deterministic data loading, and TDE-ready output modeling.

2. `Auto Insurance`  
Purpose: Full E2E demo where MarkLogic trigger executes Corticon JS bundle and writes enriched policy docs.

3. `MedicaidEligibility`  
Purpose: Full E2E Medicaid rules execution with generated test data, SQL analytics, and dashboard patterns.

4. `Eligibility Pathways`  
Purpose: Output/trace exploration project focused on analytics + conversational explanation over already-produced Corticon output.

5. `Trade Data Settlement`  
Purpose: Foundational trigger example with decisioning at ingestion time.

6. `decision-ledger-accelerator-template`  
Purpose: Starter baseline template for building a new Explainable Decision Ledger implementation with ml-gradle best-practice structure.

7. `DecisionLedger`  
Purpose: Reserved folder (currently empty).

## Decision Ledger Data Contract

Across projects, the explainability contract is consistent. Corticon-related artifacts are:

1. Input payload values.
2. Output payload values.
3. Rule messages (optional, emitted only when corresponding rules fire).
4. Rule trace/metrics (optional, full execution timeline).

Rule trace commonly includes:

1. Sequence of rules fired.
2. Entity and attribute changed.
3. Before/after values.
4. Associated entities/relationships created or changed.
5. Rulesheet and rule reference back to Corticon Studio artifacts.

MarkLogic stores this with the evaluated data, enabling both:

1. Case-level root-cause explanation.
2. Population-level analytics on which rules fire for which cohorts.

## Architecture

This repo follows a practical three-tier FastTrack-style architecture.

1. Data + Decision Tier (MarkLogic)
   - Stores JSON documents.
   - Invokes Corticon decision bundles in server-side JS.
   - Supports both execution modes:
     - Resource-driven execution (`accenture-demo` authoritative baseline).
     - Trigger-driven execution (`Auto Insurance`, `MedicaidEligibility`, `Trade Data Settlement`).
   - Persists enriched output documents.
   - Exposes REST resources and SQL views.

2. Middle Tier (Node.js)
   - Handles credentials and proxying to MarkLogic.
   - Hosts analytics endpoints.
   - Orchestrates LLM calls using grounded MarkLogic context.

3. UI Tier (React or static web app)
   - Search, analytics, trace inspection.
   - Conversational UX for decision explanation.

Runtime flow (two supported patterns):

1. **Resource-based process-and-enrich (authoritative)**  
   - Client POSTs input payload to a MarkLogic resource extension (for example `processAndEnrich.sjs`).
   - Resource executes `decisionServiceBundle.js`.
   - Resource stores enriched output in decision collections and returns URI/status.

2. **Trigger-based process-and-enrich (also supported)**  
   - Input doc lands in watched collection.
   - Trigger fires (`pre-commit` or `post-commit`, project-specific).
   - Trigger module executes `decisionServiceBundle.js`.
   - Enriched output doc is written to output collection/URI space.

3. TDE projects JSON into relational views for SQL analytics.
4. REST resources and UI consume same underlying decision ledger.

## Key MarkLogic Concepts Used Here

1. **App Server / REST API**  
Created by `ml-gradle`; default REST port in most projects is `8004`.

2. **Content, Modules, Schemas, Triggers Databases**  
Provisioned from `src/main/ml-config/databases/*`.

3. **Collections**  
Used as event and query boundaries. Examples:
   - `http://example.com/data/policy-input`
   - `http://example.com/data/policy`
   - `http://example.com/data/medicaid-input`
   - `http://example.com/data/medicaid`
   - `http://example.com/data/eligibility-output`
   - `http://example.com/data/eligibility-trace`

4. **Triggers**  
Defined under `src/main/ml-config/triggers/*.json`, implemented in `src/main/ml-modules/ext/*.sjs`.

5. **REST Resource Extensions**  
Implemented in `src/main/ml-modules/services/*.sjs`, invoked as `/v1/resources/<name>`.

6. **Search Options**  
Configured via `src/main/ml-modules/options/*.xml`.

7. **TDE (Template-Driven Extraction)**  
Defined in `src/main/ml-schemas/tde/*.tde`, enabling SQL over document content without copying data.

8. **`ml-data` with `collections.properties` / `permissions.properties`**  
Used heavily in `accenture-demo` for deterministic, version-controlled loading of split Corticon output docs with consistent metadata.

9. **Flux for reference/master data**  
Used in `accenture-demo/marklogic/flux` for high-volume structured loads with URI templates and explicit collection/permission assignment.

## Prerequisites

Install these before running demos:

1. MarkLogic Server 12+.
2. Java 17+ (recommended baseline, required for ml-gradle 6.x projects like `accenture-demo`).
3. Gradle 8+ recommended for ml-gradle 6.x projects; some projects include Gradle wrapper (`gradlew`), others use system `gradle`.
4. Node.js 18+.
5. `curl`.
6. Optional: MarkLogic Flux CLI (needed by some load scripts).
7. Optional: Python 3 (used by some data prep scripts).
8. Optional: Corticon.js Studio (for authoring/re-bundling rules).

## Important Cross-Project Caveat

Most projects default to the same MarkLogic app identity:

1. `mlAppName=corticonml`
2. `mlRestPort=8004`
3. Shared database naming conventions

If you deploy projects one after another without changing properties, later deployments can overwrite shared app settings.

Recommended for first-time setup:

1. Run one project at a time.
2. Use `gradle mlUndeploy` before switching projects.
3. Or assign unique `mlAppName` and ports per project.

## Authoritative Reference Pattern (`accenture-demo`)

When in doubt on project structure and deployment style, treat `accenture-demo/marklogic` as the reference pattern for this repository.

MarkLogic + Corticon design choices to favor (from `accenture-demo`):

1. **Dedicated MarkLogic ml-gradle project layout**
   - `src/main/ml-config`
   - `src/main/ml-data`
   - `src/main/ml-modules`
   - `src/main/ml-schemas`
   - aligned to `ml-gradle.wiki/Project-layout.md`.

2. **Resource-based decision execution as baseline**
   - `accenture-demo/marklogic/src/main/ml-modules/services/processAndEnrich.sjs`
   - `accenture-demo/marklogic/src/main/ml-modules/services/processAndEnrich.xml`
   - explicit `<transaction-mode>update</transaction-mode>` for POST writes.

3. **Decision output persisted with collections and permissions**
   - Collections: `corticon-results`, `fraud-detection`, `decision-audit`.
   - Security uses tokenized app roles (`%%mlAppName%%-reader`, `%%mlAppName%%-writer`).

4. **Environment-driven configuration**
   - `gradle-template.properties` with environment placeholders.
   - generated `gradle.properties` before deploy.
   - tokenized users/roles in ml-config payload files.

5. **Deterministic split-data loading**
   - Corticon export is split into small docs under `src/main/ml-data/split/...`.
   - each data directory carries `collections.properties` and `permissions.properties`.
   - loaded via `mlLoadData` for reproducible environments.

6. **Flux for large reference datasets**
   - source-specific option files with URI templates, collections, permissions, and batch settings.

7. **TDE modeling by concern**
   - core decision payload views (`corticon-data.tde`),
   - alert/explainability views (`corticon-alerts.tde`),
   - reference-data views (`ref-data-*.tde`).

This guide intentionally focuses on the Corticon.js + MarkLogic portions of `accenture-demo`. Other stack components in that folder (for example, Semaphore-related assets) are outside scope for this repository’s decision-ledger guidance.

### Minimal MarkLogic-Only Run Path (`accenture-demo`)

If you want to validate the authoritative pattern quickly:

1. Configure environment values:
   - copy `accenture-demo/.env-template` to `accenture-demo/.env`
   - set MarkLogic admin/app credentials.

2. Generate derived config files:
   - run `accenture-demo/configure-remaining-templates.sh` (Git Bash on Windows).

3. Deploy MarkLogic app:
   - `cd accenture-demo/marklogic`
   - `./gradlew mlDeploy -i`

4. Load split Corticon export docs:
   - `./gradlew mlLoadData -i`

5. Optional: load reference datasets via Flux:
   - `cd accenture-demo/marklogic/flux`
   - `sh ./load-all-sources.sh <writer-username> <writer-password>`

6. Execute process-and-enrich service directly:
   - POST JSON to `/v1/resources/processAndEnrich`.

## Part 1: Install and Initialize MarkLogic

### 1. Install MarkLogic

1. Install MarkLogic Server.
2. Open `http://localhost:8001`.
3. Complete first-time initialization.
4. Create an admin user/password and store it securely.

### 2. Verify MarkLogic Services

Expected default local ports:

1. `8000` Query Console.
2. `8001` Admin UI.
3. `8002` Manage API.
4. `8004` REST API (after project deployment).

### 3. Verify Tooling in Terminal

```powershell
java -version
gradle -v
node -v
npm -v
curl.exe --version
```

Optional:

```powershell
flux --help
python --version
```

## Part 2: Deploy and Run Auto Insurance (Recommended First)

Auto Insurance is the best initial walkthrough for trigger-based in-database execution of Corticon JS.

### 1. Configure Deployment Credentials

Edit `Auto Insurance/mlCorticonAutoInsurance/gradle.properties`:

```properties
mlHost=localhost
mlUsername=admin
mlPassword=<your-admin-password>
mlRestPort=8004
```

### 2. Deploy

```powershell
cd "Auto Insurance\mlCorticonAutoInsurance"
gradle mlDeploy
```

This deploys:

1. Trigger: `Auto Insurance/mlCorticonAutoInsurance/src/main/ml-config/triggers/autoInsuranceTrigger.json`
2. Trigger module: `Auto Insurance/mlCorticonAutoInsurance/src/main/ml-modules/ext/autoInsuranceTrigger.sjs`
3. Decision service bundle: `Auto Insurance/mlCorticonAutoInsurance/src/main/ml-modules/ext/decisionServiceBundle.js`
4. TDE template: `Auto Insurance/mlCorticonAutoInsurance/src/main/ml-schemas/tde/simple.tde`
5. Resource extension: `Auto Insurance/mlCorticonAutoInsurance/src/main/ml-modules/services/corticonml-options.sjs`

### 3. Load an Input Document

Minimal inline load (fires trigger on `policy-input` collection):

```powershell
curl.exe --location --request PUT "http://localhost:8004/v1/documents?uri=/data/policy-input/APP-123.json&perm:corticonml-reader=read&perm:corticonml-writer=update&collection=http://example.com/data/policy-input" `
  --header "Content-Type: application/json" `
  --digest --user corticonml-admin:corticonml-admin `
  --data-raw "{`"applicationId`":`"APP-123`",`"state`":`"CA`",`"drivers`":[{`"first`":`"Alex`",`"last`":`"Rivera`",`"age`":30,`"yearLicensed`":2012,`"applicationId`":`"APP-123`",`"advancedDriverTraining`":false,`"fullTimeStudent`":false,`"gpa`":0,`"gradeAverage`":`"`"}],`"vehicles`":[{`"bodyStyle`":`"Sedan`",`"applicationId`":`"APP-123`",`"coverages`":[{`"part`":`"Liability`",`"applicationId`":`"APP-123`"}]}]}"
```

### 4. Verify Enriched Output

In Query Console (`http://localhost:8000`, JavaScript):

```javascript
cts.estimate(cts.collectionQuery("http://example.com/data/policy"));
```

Retrieve one output doc:

```javascript
fn.head(cts.search(cts.collectionQuery("http://example.com/data/policy"))).toObject()
```

Expected output shape:

1. `payload`
2. `corticon.messages`
3. `corticon.Metrics`
4. `inputPayloadUri`

### 5. Run Auto Insurance UI and Node Middle Tier

Middle tier:

```powershell
cd "Auto Insurance\insurance-chatbot"
npm install
npm start
```

UI:

```powershell
cd "Auto Insurance\insurance-chatbot\ui"
npm install
npm run dev
```

Optional chatbot + LLM is handled by `Auto Insurance/insurance-chatbot/src/server.js`.

## Part 3: Deploy and Run Medicaid Eligibility

MedicaidEligibility is strongest for analytics endpoint patterns and generated sample population data.

### 1. Configure and Deploy

Edit `MedicaidEligibility/gradle.properties` with your admin password, then:

```powershell
cd "MedicaidEligibility"
gradle mlDeploy
```

Key files:

1. Trigger definition: `MedicaidEligibility/src/main/ml-config/triggers/medicaidTrigger.json`
2. Trigger module: `MedicaidEligibility/src/main/ml-modules/ext/medicaidTrigger.sjs`
3. Bundle: `MedicaidEligibility/src/main/ml-modules/ext/medicaidDecisionServiceBundle.js`
4. TDE: `MedicaidEligibility/src/main/ml-schemas/tde/medicaid-template.tde`

### 2. Generate and Load Test Data

```powershell
cd "MedicaidEligibility"
.\run_test_data_load.bat
```

This script:

1. Calls Mockaroo API.
2. Writes `MedicaidEligibility/data/mockaroo_output.json`.
3. Uses Flux to load docs into `http://example.com/data/medicaid-input`.
4. Trigger creates enriched docs in `http://example.com/data/medicaid`.

### 3. Run Analytics Middle Tier and UI

Middle tier:

```powershell
cd "MedicaidEligibility\frontend"
npm install
node server.js
```

UI:

```powershell
cd "MedicaidEligibility\frontend\ui"
npm install
npm run dev
```

Analytics endpoint example:

```text
http://localhost:4001/api/analytics?type=programEligibilityStats
```

Note: Medicaid UI chatbot components currently use mock responses (`sendMessage` stub in `MedicaidEligibility/frontend/ui/src/api/marklogicService.js`). Use Eligibility Pathways patterns below for production conversational grounding.

## Part 4: Deploy and Run Eligibility Pathways (Conversational Focus)

Eligibility Pathways is the most developed pattern in this repo for grounded MarkLogic + LLM conversational explainability.

### 1. Configure and Deploy

```powershell
cd "Eligibility Pathways"
notepad gradle.properties
gradle mlDeploy
```

### 2. Load Output Documents

If using provided split files:

```powershell
cd "Eligibility Pathways"
.\run_output_load_split.bat
```

If using JSON files in `Eligibility Pathways/data/*.json`:

```powershell
cd "Eligibility Pathways"
.\run_output_load.bat
```

### 3. Load Trace Documents

Recommended path in current repo:

```powershell
cd "Eligibility Pathways"
.\run_trace_load_split.bat
```

Important: `run_trace_load.bat` references `scripts/convert_trace_csv.py`, but that file is not currently present. Use split trace docs or add a converter script before using the CSV path.

### 4. Start Chatbot UI Server

```powershell
cd "Eligibility Pathways\chatbot-ui"
copy /Y .env.example .env
npm install
npm start
```

Set in `.env`:

1. `ML_HOST`, `ML_PORT`, `ML_USER`, `ML_PASS`
2. `CHATBOT_PORT` (default `4010`)
3. `OPENAI_API_KEY`
4. Optional: `OPENAI_MODEL`, `OPENAI_DEBUG`

Then open:

```text
http://localhost:4010
```

### 5. Core MarkLogic Resources Used by Eligibility Pathways

1. `/v1/resources/chatbot` from `Eligibility Pathways/src/main/ml-modules/services/chatbot.sjs`
2. `/v1/resources/analytics` from `Eligibility Pathways/src/main/ml-modules/services/analytics.sjs`
3. `/v1/resources/eligibility-options` from `Eligibility Pathways/src/main/ml-modules/services/eligibility-options.sjs`

## Part 5: SQL / Analytics Views (TDE)

View names by project:

1. `accenture-demo` (`corticon` + `ref_data` schemas)
   - `claims`, `explanation_of_benefit`, `practitioners`, `organizations`, `patients`
   - `alerts`, `related_claims`, `related_eobs`, `related_orgs`, `related_patients`, `related_practitioners`
   - `ref_data.cpt_codes`, `ref_data.organizations`, `ref_data.practitioners`, `ref_data.practitioner_qualifications`

2. Auto Insurance (`policy` schema pattern)
   - `Details`, `Drivers`, `Incidents`, `Vehicles`, `AntiTheftDevice`, `Coverages`, `Discounts`, `Surcharges`, `Messages`, `AttributeChanges`

3. MedicaidEligibility (`household` schema)
   - `household`, `individual`, `classOfAssistance`, `eligibilityNote`, `qualifyingActivity`, `attributeChanges`

4. Eligibility Pathways (`eligibility` schema)
   - `household`, `individual`, `population`, `messages`, `attributeChanges`, `trace_flags`, `coa`

5. Trade Data Settlement
   - `Messages`, `AttributeChanges`

Use Query Console SQL mode or ODBC server for BI tools.

## Part 6: FastTrack Patterns You Can Reuse for Any Domain

Reference FastTrack docs:

`https://docs.progress.com/bundle/marklogic-fasttrack-develop-with-fasttrack-1/page/topics/set-up-a-three-tiered-application.html`

Reusable pattern from this repo:

1. MarkLogic backend
   - Resource-based process-and-enrich execution (`accenture-demo`) as the baseline.
   - Optional trigger-based execution where ingestion-time automation is preferred.
   - Curated output and trace collections.
   - `ml-data` split-document loading with `collections.properties` / `permissions.properties`.
   - Optional Flux-based reference data ingestion for large upstream datasets.
   - TDE views for BI and API analytics.

2. Node middle tier
   - Credential isolation.
   - Domain-specific API endpoints.
   - Optional LLM orchestration.

3. UI tier
   - Search and drilldown on households/policies/trades.
   - Trace-level evidence display.
   - Chat UX that cites record-level evidence.

To create a new domain:

1. Model Corticon vocabulary and rules.
2. Generate decision bundle and place in `src/main/ml-modules/ext/`.
3. Create input trigger collection and output collection.
4. Implement trigger module to normalize output envelope.
5. Add TDE views for required analytics dimensions.
6. Add resource extensions for retrieval and explainability.
7. Add Node proxy + UI for search, analytics, and chat.

## Part 7: Grounded LLM Integration Blueprint

Best implemented pattern in this repo is a two-stage approach:

1. MarkLogic stage (grounding + retrieval)
   - Resolve target entity (for example, infer household from person name).
   - Return compact, relevant evidence JSON.
   - Include citations and trace context.

2. Node stage (LLM orchestration)
   - Build strong system prompt with grounding constraints.
   - Send only bounded context size.
   - Return fallback if no context found.
   - Preserve citations from MarkLogic response.

Implementation references:

1. `Eligibility Pathways/chatbot-ui/server.js`
2. `Eligibility Pathways/src/main/ml-modules/services/chatbot.sjs`
3. `Auto Insurance/insurance-chatbot/src/server.js`

Guardrails to keep:

1. Never let LLM answer without MarkLogic evidence.
2. In prompt, explicitly forbid speculation.
3. Clamp payload sizes.
4. Return deterministic fallback when no match found.
5. Attach citations in final response for auditability.

## Part 8: Troubleshooting

1. `gradle mlDeploy` fails with auth errors  
Action: verify `mlUsername` and `mlPassword` in the project `gradle.properties`.

2. `processAndEnrich` POST fails to write output  
Action: ensure the resource descriptor includes `<transaction-mode>update</transaction-mode>` (see `accenture-demo/marklogic/src/main/ml-modules/services/processAndEnrich.xml`).

3. Trigger does not fire  
Action: confirm input document collection matches trigger `collection-scope` URI.

4. No enriched output docs  
Action: check trigger module logs in MarkLogic ErrorLog and confirm decision bundle exists in modules DB.

5. `run_test_data_load.bat` fails  
Action: install/configure Flux CLI, or manually load data via REST.

6. Eligibility trace CSV path fails  
Action: `run_trace_load.bat` expects missing `scripts/convert_trace_csv.py`; use split trace loader or add converter.

7. Chat endpoint returns empty or generic output  
Action: verify `OPENAI_API_KEY`, inspect Node logs, and confirm MarkLogic resource returns grounded payload.

8. Project deployments overwrite each other  
Action: use one-at-a-time deployment or assign unique `mlAppName` and port values per project.

## Part 9: Security and Production Hardening

Before production use:

1. Change default demo user passwords (`corticonml-admin`, `corticonml-reader`, `corticonml-writer`).
2. Restrict admin privileges and separate deploy/runtime accounts.
3. Lock down CORS and proxy settings in Node.
4. Apply least-privilege permissions on collections and URIs.
5. Add monitoring for trigger failures and dead-letter strategy.
6. Add regression tests for Corticon rule changes.
7. Version bundles and trace schema alongside ruleset releases.

## Appendix: Useful Endpoints

`accenture-demo`:

1. `POST /v1/resources/processAndEnrich` (execute Corticon bundle and persist result).
2. `GET /v1/resources/chunkSearch?rs:criteria=...&rs:collection=...` (resource-backed search for middle-tier chunk retrieval).

Auto Insurance:

1. `GET /v1/resources/corticonml-options?rs:action=getPolicy&rs:applicationId=<id>`
2. `GET /v1/resources/corticonml-options?rs:action=searchPolicies`
3. `POST /api/chat` on Node middle tier (`Auto Insurance/insurance-chatbot`)

Eligibility Pathways:

1. `POST /v1/resources/chatbot`
2. `GET /v1/resources/analytics?rs:action=selected-coa`
3. `GET /v1/resources/eligibility-options?rs:action=getHousehold&rs:householdId=<id>`

Medicaid:

1. `GET /api/analytics?type=<queryType>` from `MedicaidEligibility/frontend/server.js`

## Suggested Learning Sequence

1. Review `accenture-demo/marklogic` first as the authoritative structural template.
2. Run Auto Insurance next for trigger-based Corticon execution basics.
3. Run Medicaid for analytics and TDE depth.
4. Run Eligibility Pathways for conversational explainability and LLM grounding.
5. Start new work from `decision-ledger-accelerator-template` and adapt to your domain.
