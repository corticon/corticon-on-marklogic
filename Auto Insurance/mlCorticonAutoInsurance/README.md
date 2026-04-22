# MarkLogic Backend for Auto Insurance Demo

This project contains the MarkLogic backend components for the Auto Insurance demonstration. It is responsible for deploying the necessary databases, servers, and triggers to MarkLogic, and for running the Corticon.js decision service to process insurance applications.

## What Gets Deployed

1. REST app server on `mlRestPort` (default `8004`) with digest authentication.
2. Trigger-driven enrichment for documents inserted into `http://example.com/data/policy-input`.
3. Resource services for synchronous decision execution and analytics:
  - `processAndEnrich`
  - `analytics`
  - `corticonml-options`
4. TDE-backed relational views from `src/main/ml-schemas/tde/simple.tde`.

## Important Runtime Collections

1. `auto-insurance`
2. `auto-insurance_input`
3. `auto-insurance_output`
4. `auto-insurance_trace`
5. `http://example.com/data/policy-input`
6. `http://example.com/data/policy`

---

## Prerequisites

Before starting, ensure you have the following software installed and configured:

*   **MarkLogic 12+**
*   **Java 17+** and **Gradle 8+**

---

## Before You Start

- Ensure MarkLogic 12 is running and you have admin credentials.
- Confirm Gradle works: `gradle -v`.
- Review `gradle.properties` for host/port/credentials. Default REST port is `8004`.
- Confirm `src/main/ml-modules/ext/decisionServiceBundle.js` exists; this is the compiled Corticon decision service.

---

## 🚀 How to Deploy the Backend

### 1. Configure Your MarkLogic Connection

Before deploying, you need to set your MarkLogic connection details.

1.  Open the `gradle.properties` file in this directory.
2.  Update the `mlUsername` and `mlPassword` properties to match the credentials for your local MarkLogic admin account.

```properties
# gradle.properties
mlUsername=admin
mlPassword=your-admin-password
```

### 2. Deploy the Application

This single command will deploy the databases, roles, users, TDE templates, and the Corticon trigger to your MarkLogic instance.

Open a terminal in this directory and run:

```bash
gradle mlDeploy
```

### 3. Load Test Data to Trigger Processing

Insert one or more policy JSON documents into the `http://example.com/data/policy-input` collection. The trigger will call the Corticon.js decision service and persist the enriched output under `/data/policy/`.

- Use your own sample that matches the input schema (see `../insurance-chatbot/schema.json`), or start with a minimal payload including an `applicationId`.

Example using `curl` (adjust values as needed):

```bash
curl --location --request PUT 'http://localhost:8004/v1/documents?uri=/data/policy-input/APP-123.json&perm:corticonml-reader=read&perm:corticonml-writer=update&collection=http://example.com/data/policy-input' \
  --header 'Content-Type: application/json' \
  --digest --user corticonml-admin:corticonml-admin \
  --data-raw '{
    "applicationId": "APP-123",
    "state": "CA",
    "drivers": [ { "first": "Alex", "last": "Rivera", "age": 30, "yearLicensed": 2012, "applicationId": "APP-123", "advancedDriverTraining": false, "fullTimeStudent": false, "gpa": 0, "gradeAverage": "" } ],
    "vehicles": [ { "bodyStyle": "Sedan", "applicationId": "APP-123", "coverages": [ { "part": "Liability", "applicationId": "APP-123" } ] } ]
  }'
```

After the PUT completes, look for an enriched document at a URI like `/data/policy/APP-123.json`.

### 4. Invoke the Decision Service Synchronously

If you want middleware-style orchestration instead of trigger-based enrichment, call:

```bash
curl --location --request POST 'http://localhost:8004/v1/resources/processAndEnrich' \
  --header 'Content-Type: application/json' \
  --digest --user admin:password \
  --data-binary '@policy.json'
```

### 5. Query Aggregated Analytics

```bash
curl --location --request GET 'http://localhost:8004/v1/resources/analytics?rs:state=Virginia' \
  --digest --user admin:password
```

---

## Notable Files

- `src/main/ml-config/triggers/autoInsuranceTrigger.json` — Trigger definition; watches the `http://example.com/data/policy-input` collection and calls the SJS module after document creation.
- `src/main/ml-modules/ext/autoInsuranceLib.sjs` — Shared execution, persistence, collection tagging, and TDE helper library.
- `src/main/ml-modules/ext/autoInsuranceTrigger.sjs` — Trigger module that executes the Corticon decision service and writes an enriched envelope to `/data/policy/`.
- `src/main/ml-modules/ext/processAndEnrichUpdate.sjs` — Update transaction used by the synchronous REST resource.
- `src/main/ml-modules/ext/examples/reprocessPolicy.sjs` — Example replay module for scheduled or batch recalculation.
- `src/main/ml-modules/ext/decisionServiceBundle.js` — Compiled Corticon.js rules bundle invoked by the trigger (`decisionService.execute`).
- `src/main/ml-schemas/tde/simple.tde` — Template Driven Extraction for analytics over enriched documents.
- `src/main/ml-modules/services/processAndEnrich.sjs` — Synchronous decisioning REST resource.
- `src/main/ml-modules/services/analytics.sjs` — TDE-backed dashboard and explainability analytics resource.
- `src/main/ml-modules/services/corticonml-options.sjs` — REST resource for fetching policies used by the UI.
- `src/main/ml-modules/options/corticonml-options.xml` — Registers the resource and search options.
- `src/main/ml-modules/rest-properties.json` — REST API properties.
- `src/main/ml-config/security/*` — Roles and users (`corticonml-reader`, `corticonml-writer`, `corticonml-admin`).
- `src/main/ml-config/servers/rest-api-server.json` — REST server configuration.
- `src/main/ml-config/servers/odbc-server.json` — Optional ODBC/SQL access.
- `../integration-patterns/README.md` — Pattern catalog covering trigger, API, replay, TDE, and SCO integration styles.

---

## Template Reference

For a generic baseline project structure and deployment approach, see:

1. <https://github.com/corticon/explainable-decision-ledger/blob/main/docs/README.md>
2. <https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/README.md>



