# Corticon Output Explorer: Eligibility Pathways

This project is a MarkLogic + FastTrack scaffold for querying Corticon decision service output JSON. The decision service is not executed inside MarkLogic. You provide the already-produced output documents, and this project lets you load and query them with SQL, REST search, and a chatbot frontend powered by the MarkLogic REST resource.

---

## Prerequisites

- MarkLogic 12+
- Java 11+ and Gradle
- curl (for the data load script)

---

## Configure and Deploy (Windows CMD)

The chatbot UI is the end goal. Follow each step in order.

### 1) Update MarkLogic credentials

Open `gradle.properties` and confirm it matches the Auto Insurance defaults (or any custom values you already use there).

```cmd
cd /d "%USERPROFILE%\github\corticon-on-marklogic\Eligibility Pathways"
notepad gradle.properties
```

Keep these settings in sync with Auto Insurance unless you intentionally want a different MarkLogic app/port:

```properties
mlAppName=corticonml
mlHost=localhost
mlRestPort=8004
mlRestAuthentication=digest
ODBC_PORT=5432
```

Update `mlUsername`/`mlPassword` if your admin credentials differ.

### 2) Deploy the MarkLogic app

Open **Command Prompt** in this folder and run:

```cmd
cd /d "%USERPROFILE%\github\corticon-on-marklogic\Eligibility Pathways"
gradle mlDeploy
```

This creates the databases, REST server, roles/users, and TDE views.

---

## Load Corticon Output JSON (Windows CMD)

1) Place your output JSON files in `data/` (one file per document).
2) Run the loader script:

```cmd
cd /d "%USERPROFILE%\github\corticon-on-marklogic\Eligibility Pathways"
run_output_load.bat
```

The script reads `payload.householdId` to form a URI like:
`/data/eligibility-output/{householdId}.json`

If `payload.householdId` is missing, the file name (without extension) is used.

---

## Load Corticon Trace CSV (Windows CMD)

1) Place the trace CSV in `data/trace data.csv`.
2) Run the trace loader:

```cmd
cd /d "%USERPROFILE%\github\corticon-on-marklogic\Eligibility Pathways"
run_trace_load.bat
```

This converts the CSV into JSON (with parsed entity ids and rule locations) and loads it into
the `http://example.com/data/eligibility-trace` collection.

---

## Verify the Chatbot Resource (Windows CMD)

This mirrors the lightweight chatbot resource from the Auto Insurance example. It does a word search across the eligibility output collection and returns citations.

```cmd
curl --location --request POST "http://localhost:8004/v1/resources/chatbot" ^
  --header "Content-Type: application/json" ^
  --digest --user corticonml-admin:corticonml-admin ^
  --data-raw "{\"query\":\"Nursing Home\"}"
```

To ask trace-aware questions, include household/person/program fields in the payload:

```cmd
curl --location --request POST "http://localhost:8004/v1/resources/chatbot" ^
  --header "Content-Type: application/json" ^
  --digest --user corticonml-admin:corticonml-admin ^
  --data-raw "{\"householdId\":\"6\",\"personName\":\"Rahal Guidi\",\"programName\":\"Nursing Home\"}"
```

---

## Run the Chatbot Frontend (Windows CMD)

The chatbot UI is the primary way to explore eligibility output.

### 1) Install dependencies

```cmd
cd /d "%USERPROFILE%\github\corticon-on-marklogic\Eligibility Pathways\chatbot-ui"
npm install
```

### 2) Configure the UI proxy and (optional) OpenAI

Copy `.env.example` to `.env`:

```cmd
cd /d "%USERPROFILE%\github\corticon-on-marklogic\Eligibility Pathways\chatbot-ui"
copy /Y .env.example .env
```

Then edit `.env` with your settings:

```ini
ML_HOST=localhost
ML_PORT=8004
ML_USER=corticonml-admin
ML_PASS=corticonml-admin
CHATBOT_PORT=4010
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_SYSTEM_PROMPT=You are an eligibility assistant. Use only the MarkLogic response provided. Keep answers concise and factual. If the response indicates no records, say so.
OPENAI_DEBUG=true
```

### 3) Start the UI server

```cmd
cd /d "%USERPROFILE%\github\corticon-on-marklogic\Eligibility Pathways\chatbot-ui"
npm start
```

### 4) Open the UI

Open `http://localhost:4010` and submit a query.

---

## REST Resource for Documents (Windows CMD)

```cmd
# Get one household by ID
curl --location "http://localhost:8004/v1/resources/eligibility-options?rs:action=getHousehold&rs:householdId=161625" ^
  --digest --user corticonml-admin:corticonml-admin

# Search by qtext
curl --location "http://localhost:8004/v1/resources/eligibility-options?rs:action=searchHouseholdsByQtext&rs:q=Georgia" ^
  --digest --user corticonml-admin:corticonml-admin
```

---

## SQL / FastTrack

An ODBC server is provisioned on port 5432. Connect via SQL and query the TDE views under schema `eligibility`.

See `queries.md` for examples.

---

## Notable Files

- `src/main/ml-modules/services/chatbot.sjs` - Chatbot resource extension.
- `src/main/ml-modules/services/eligibility-options.sjs` - REST resource for document retrieval.
- `src/main/ml-schemas/tde/eligibility-output.tde` - TDE views for SQL/FastTrack.
- `src/main/ml-modules/options/eligibility-options.xml` - Search options.
- `run_output_load.bat` - Loader for Corticon output JSON.
- `run_trace_load.bat` - Loader for trace CSV (converts to JSON).
- `scripts/convert_trace_csv.py` - CSV-to-JSON converter used by the trace loader.
