# MarkLogic Backend for Auto Insurance Demo

This project contains the MarkLogic backend components for the Auto Insurance demonstration. It deploys the necessary databases, servers, security roles, and triggers to MarkLogic, and runs the Corticon.js decision service to process and enrich insurance policy applications.

---

## Prerequisites

Before starting, ensure you have the following installed and configured:

*   **MarkLogic 12+**
*   **Java 11+**
*   **Gradle** (a Gradle wrapper `gradlew` / `gradlew.bat` is included — no separate install required)

---

## Starting and Stopping the Demo

A pair of convenience scripts in `../scripts/` manage the full UI stack (backend middleware + React frontend) with a simple interactive menu:

| Platform | Script |
|---|---|
| Windows (PowerShell) | `scripts\Start-Stop-Demo-AutoInsurance.ps1` |
| Linux / macOS (bash) | `scripts/start-stop-demo-autoinsurance.sh` |

Both scripts:
- Check that ports 4004 (backend) and 5173 (frontend) are free before starting.
- Launch the backend (`npm start`) and the React UI (`npm run dev`) in separate terminal windows.
- Save process IDs so they can be cleanly stopped via the same menu.
- Automatically open the browser at `http://localhost:5173/` after a short initialization delay.

**Windows — run from a PowerShell window:**
```powershell
cd "Auto Insurance\scripts"
.\Start-Stop-Demo-AutoInsurance.ps1
```

**Linux / macOS — make executable once, then run:**
```bash
chmod +x "Auto Insurance/scripts/start-stop-demo-autoinsurance.sh"
"Auto Insurance/scripts/start-stop-demo-autoinsurance.sh"
```

> **Note:** The scripts start the UI layer only. MarkLogic must already be running and the backend must have been deployed with `gradle mlDeploy` (see below) before starting the demo.

---

## Before You Start

- Ensure MarkLogic is running and you have admin credentials.
- Review `gradle.properties` for host, port, and credentials. Default REST port is `8004`.
- Confirm `src/main/ml-modules/ext/decisionServiceBundle.js` exists; this is the compiled Corticon.js decision service bundle.

---

## How to Deploy the Backend

### 1. Configure Your MarkLogic Connection

Open `gradle.properties` and update the credentials to match your local MarkLogic admin account:

```properties
# gradle.properties
mlHost=localhost
mlRestPort=8004
mlUsername=admin
mlPassword=your-admin-password
```

### 2. Deploy the Application

This single command deploys all databases, roles, users, TDE templates, REST extensions, and the Corticon trigger:

```bash
gradle mlDeploy
```

Or use the included wrapper (no Gradle installation needed):

```bash
# Windows
gradlew.bat mlDeploy

# macOS / Linux
./gradlew mlDeploy
```

### 3. Load Test Data

Insert one or more policy JSON documents into the `http://example.com/data/policy-input` collection. The MarkLogic trigger fires on document creation, runs the Corticon.js decision service, and writes an enriched output document under `/data/policy/`.

**Option A — `generate.bat` (Windows, recommended for demos)**

Run `generate.bat` from this directory. It:
1. Fetches a new synthetic auto insurance application from Mockaroo.
2. Imports it into MarkLogic using MarkLogic Flux, placing it in the `http://example.com/data/policy-input` collection at `/data/policy-input/{applicationId}.json`.

The trigger then processes it automatically and produces `/data/policy/{applicationId}.json`.

**Option B — `curl`**

```bash
curl --location --request PUT \
  'http://localhost:8004/v1/documents?uri=/data/policy-input/APP-123.json&perm:corticonml-reader=read&perm:corticonml-writer=update&collection=http://example.com/data/policy-input' \
  --header 'Content-Type: application/json' \
  --digest --user corticonml-admin:corticonml-admin \
  --data-raw '{
    "applicationId": "APP-123",
    "state": "CA",
    "drivers": [ { "first": "Alex", "last": "Rivera", "age": 30, "yearLicensed": 2012, "applicationId": "APP-123", "advancedDriverTraining": false, "fullTimeStudent": false, "gpa": 0, "gradeAverage": "" } ],
    "vehicles": [ { "bodyStyle": "Sedan", "applicationId": "APP-123", "coverages": [ { "part": "Liability", "applicationId": "APP-123" } ] } ]
  }'
```

After the PUT completes, the enriched document appears at `/data/policy/APP-123.json`.

---

## How the Trigger Works

1. A document is inserted into the `http://example.com/data/policy-input` collection.
2. `autoInsuranceTrigger.sjs` fires and reads the document.
3. It calls `decisionService.execute(policy, configuration)` from the Corticon.js bundle.
4. Numeric string values in the decision response are normalized to actual numbers.
5. The enriched payload is unwrapped, cleaned of internal Corticon metadata, and written to `/data/policy/{applicationId}.json` in the `http://example.com/data/policy` collection.

---

## REST API Endpoints (used by the UI / middleware)

All requests use Digest authentication against port `8004`.

| Action | Method | URL |
|---|---|---|
| Fetch single policy | GET | `/v1/resources/corticonml-options?rs:action=getPolicy&rs:applicationId={id}` |
| List all policies | GET | `/v1/resources/corticonml-options?rs:action=searchPolicies` |
| Search by application ID | GET | `/v1/resources/corticonml-options?rs:action=searchPoliciesByQtext&rs:q={id}` |
| Chatbot query | POST | `/v1/resources/chatbot` (body: `{ "query": "..." }`) |

---

## Notable Files

| File | Purpose |
|---|---|
| `gradle.properties` | MarkLogic connection settings (host, port, credentials) |
| `gradlew` / `gradlew.bat` | Gradle wrapper — run without a local Gradle install |
| `generate.bat` | Fetches synthetic test data from Mockaroo and loads it via MarkLogic Flux |
| `src/main/ml-config/triggers/autoInsuranceTrigger.json` | Trigger definition; watches the `policy-input` collection |
| `src/main/ml-modules/ext/autoInsuranceTrigger.sjs` | Trigger logic: runs Corticon.js, normalizes output, writes enriched document |
| `src/main/ml-modules/ext/decisionServiceBundle.js` | Compiled Corticon.js rules bundle |
| `src/main/ml-modules/ext/split-auto-policies.sjs` | REST POST resource to split a bulk Mockaroo JSON array into individual input documents |
| `src/main/ml-modules/services/corticonml-options.sjs` | REST resource: `getPolicy`, `searchPolicies`, `searchPoliciesByQtext` |
| `src/main/ml-modules/services/chatbot.sjs` | REST resource for chatbot word-search queries |
| `src/main/ml-schemas/tde/simple.tde` | Template Driven Extraction — enables SQL/SPARQL analytics over enriched policy documents |
| `src/main/ml-modules/options/corticonml-options.xml` | Registers REST resource and search options |
| `src/main/ml-config/security/*` | Roles (`corticonml-reader`, `corticonml-writer`, `corticonml-admin`) and users |
| `src/main/ml-config/servers/rest-api-server.json` | REST server on port 8004 |
| `src/main/ml-config/servers/odbc-server.json` | Optional ODBC/SQL access (port 5432) |
| `queries.md` | Sample SQL queries for analytics over TDE-extracted policy data |
