# PDP Decision Management Portal

> **Who should read this?**
> **Developers and administrators** setting up, running, or maintaining the portal — you need this document. It covers installation, environment configuration, the three portal pages, and the end-to-end compile/deploy/test workflow.
> If you are a **rule author** who only needs to understand how to write query definition documents or configure decision service deployments from within the portal, jump to [§5 Portal Pages](#5-portal-pages) and [§6 MarkLogic Data Written by the Portal](#6-marklogic-data-written-by-the-portal).

An administration portal for managing Corticon.js decision services deployed to MarkLogic. The portal provides three pages for authoring query definitions, configuring deployment settings, and testing live decision services — all without leaving the browser.

For rule authors using the **Advanced Data Connector (ADC)** in Corticon.js Studio, the portal is required to define and manage the SQL query definition documents that the ADC resolves at runtime from MarkLogic. Note that Corticon.js Studio can run and test ADC-based decision services locally — retrieving data from and writing data to MarkLogic — without this portal; the portal simply provides a browser-based UI for authoring and maintaining those query definitions.

The portal's **Decision Service Test page** also gives rule authors a straightforward way to compile their rule project and push the resulting decision service bundle to MarkLogic with a single click — no Gradle, Java, or command-line knowledge required.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Installation & Setup](#4-installation--setup)
   - 4.1 [Clone / download](#41-clone--download)
   - 4.2 [Install dependencies](#42-install-dependencies)
   - 4.3 [Configure environment variables](#43-configure-environment-variables)
   - 4.4 [Telerik / KendoReact license](#44-telerik--kendoreact-license)
   - 4.5 [Start the portal](#45-start-the-portal)
5. [Portal Pages](#5-portal-pages)
   - 5.1 [Query Maintenance](#51-query-maintenance)
   - 5.2 [Deployment Config](#52-deployment-config)
   - 5.3 [Decision Service Test](#53-decision-service-test)
6. [MarkLogic Data Written by the Portal](#6-marklogic-data-written-by-the-portal)
7. [The Advanced Data Connector (ADC)](#7-the-advanced-data-connector-adc)
8. [End-to-End Workflow](#8-end-to-end-workflow)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

The PDP Decision Management Portal is a React/Vite single-page application. It talks to a MarkLogic content database via a thin Express proxy layer that handles Digest authentication. The portal lets administrators:

- **Author and manage SQL query definitions** that the Corticon.js Advanced Data Connector (ADC) resolves at decision-service runtime.
- **Configure how each Corticon rule project should be compiled and deployed** to MarkLogic (Java paths, Gradle settings, target ML app server, etc.).
- **Compile, deploy, and test decision services** directly from the browser, with live streaming build output, rule-message analysis, and execution tracing.

---

## 2. Architecture

```
Browser (React / Vite)
       │
       │ http://localhost:5174
       ▼
Express middle-tier  (portal/server/server.js, port 4005)
       │  Digest auth  │  proxies /v1/* calls        │  custom endpoints
       │               │  (MarkLogic REST API)       │  /compile-decision-service
       ▼               ▼                             ▼  /test-decision-service
MarkLogic REST App Server (port 8004 / http port 8000)
       │
       ├─ Content DB:  DeploymentConfigs, query definitions, ruleflow docs
       └─ Modules DB:  Corticon.js decision service bundles (/ext/...)
```

The Express server forwards all `/v1/*` traffic straight to MarkLogic with Digest auth added. Two additional custom endpoints handle long-running operations (compile via SSE stream, execute decision service).

---

## 3. Prerequisites

| Requirement | Version / Notes |
|---|---|
| Node.js | v18 or later |
| npm | v9 or later |
| Java JDK | 21 recommended (path set in `.env` as `VITE_DEFAULT_JAVA_HOME`) |
| Corticon.js Studio | For compiling rule projects. Only required on the machine running the Express backend when using the Compile & Deploy feature. Ships for Windows and macOS. |
| MarkLogic Server | 10.x or 11+ |
| MarkLogic App Server | REST App Server listening on port 8004 (configurable) |
| Telerik license | Required for KendoReact UI components (see §4.4) |

---

## 4. Installation & Setup

### 4.1 Clone / download

Place the `portal/` folder anywhere you like. All paths inside the folder are relative.

### 4.2 Install dependencies

The portal has two independent Node.js packages — the React frontend and the Express backend. Install both:

```bash
# Frontend (from portal/)
cd portal
npm install

# Backend (from portal/server/)
cd server
npm install
```

> **ml-fasttrack**: The frontend depends on `ml-fasttrack-2.0.0.tar`, a local package archive that must be present in `portal/`. It is referenced as `"ml-fasttrack": "file:ml-fasttrack-2.0.0.tar"` in `package.json`.

### 4.3 Configure environment variables

Two separate `.env` files are required — one for the frontend (Vite), one for the backend (Express). Template files are provided for both.

#### `portal/.env`  ←  Vite / frontend

Copy the template and fill in your values:

```bash
cp .env.template .env
```

| Variable | Description | Example |
|---|---|---|
| `VITE_ML_PORT` | Vite dev server port | `5174` |
| `VITE_BACKEND_HOST` | Host where Express is running | `localhost` |
| `VITE_BACKEND_PORT` | Express port | `4005` |
| `VITE_ML_SCHEME` | HTTP scheme for proxied calls | `http` |
| `VITE_ML_HOST` | MarkLogic hostname | `localhost` |
| `VITE_ML_BASE_PATH` | Base path prefix for proxied API calls | `/api` |
| `VITE_ML_REST_PORT` | MarkLogic REST App Server port (for Gradle deploy) | `8004` |
| `VITE_ML_USERNAME` | MarkLogic user (used by frontend for Basic auth header) | `your-ml-username` |
| `VITE_ML_PASSWORD` | MarkLogic password | `your-ml-password` |
| `VITE_DEFAULT_JAVA_HOME` | Default JDK path pre-filled in new deployment configs | `C:\Program Files\...` |

#### `portal/server/.env`  ←  Express / backend

Copy the template and fill in your values:

```bash
cp server/.env.template server/.env
```

| Variable | Description | Example |
|---|---|---|
| `ML_HOST` | MarkLogic hostname | `localhost` |
| `ML_PORT` | MarkLogic HTTP port (used by Express proxy) | `8004` |
| `ML_USER` | MarkLogic Digest auth username | `your-ml-username` |
| `ML_PASS` | MarkLogic Digest auth password | `your-ml-password` |
| `ML_MODULES_DATABASE` | MarkLogic modules database name | `corticonml-modules` |
| `ML_MIDDLE_TIER_PORT` | Port Express listens on | `4005` |
| `UI_ORIGIN` | Allowed CORS origin (frontend URL) | `http://localhost:5174` |
| `VITE_ML_OPTIONS` | MarkLogic search options resource name | `corticonml-options` |
| `OPENAI_API_KEY` | Optional — enable AI-assisted chat explanations | *(blank to disable)* |
| `OPENAI_MODEL` | OpenAI model to use if key is set | `gpt-4o-mini` |

> **Why two files?**
> Vite reads `portal/.env` at build/dev time and makes `VITE_*` variables available in the browser as `import.meta.env.*`. Express reads `portal/server/.env` at runtime from its own working directory. They serve different processes and must be configured independently.

### 4.4 Telerik / KendoReact license

KendoReact components require a license file. See [telerik-license.README](telerik-license.README) for instructions on where to get and place the file:

1. Download your license from [https://www.telerik.com/account/your-products](https://www.telerik.com/account/your-products)
2. Save it as `portal/telerik-license.txt`

This file is excluded from version control via `.gitignore`.

### 4.5 Start the portal

#### Using the PowerShell manager script (recommended)

A convenience script is included in the `scripts/` folder (one level above `portal/`):

```powershell
# Run from the PDP-Decision-Management/ directory
.\scripts\PDP-Portal-Start.ps1
```

This opens an interactive menu to start/stop the backend (Express) and frontend (Vite) in separate terminal windows.

#### Manual start

```bash
# Terminal 1 — backend
cd portal/server
npm start

# Terminal 2 — frontend
cd portal
npm run dev
```

Open [http://localhost:5174](http://localhost:5174) in your browser.

---

## 5. Portal Pages

### 5.1 Query Maintenance

**Purpose:** Create and manage SQL query definition documents that the Corticon.js Advanced Data Connector (ADC) uses to retrieve data from MarkLogic TDE views at decision-service runtime.

#### Layout

The page is split into two panels separated by a resizable divider:

- **Left panel** — Tree navigator: rule projects at the top level, individual query definitions underneath.
- **Right panel** — Editor area with tabs: *Query Definition*, *Test*, and *Project Settings*.

#### What you can do

| Action | How |
|---|---|
| Create a rule project | **New Project** button | with same name as you defined your rule project name in Corticon.js Studio
| Create a query definition | **New Query** button (select a project first) |
| Rename a project | Click the pencil icon next to the project name |
| Delete a query | **Delete** button (confirmation required) |
| Save changes | **Save** button (or Ctrl+S) |

#### Query Definition tab

Each query definition contains one or more **steps**. Each step is a SQL `SELECT` statement that runs against a MarkLogic TDE (Template Driven Extraction) view. Steps execute in ascending `sequenceNo` order, and later steps can reference results written to working memory by earlier steps.

**Step fields:**

| Field | Description |
|---|---|
| `sequenceNo` | Execution order |
| `statement` | SQL SELECT with `{Entity.attribute}` placeholders for runtime values |
| `addAsTopLevelEntity` | Corticon vocabulary entity type to create for each result row |
| `addToExistingEntity` | Attach results as a child of this existing entity in working memory |
| `roleName` | The Corticon role name linking parent to child results |
| `maxRows` | Row cap (default: 100,000) |
| `enable` | Set to `false` to skip this step at runtime |
| `statementType` | `select` (default), `insert`, `update`, or `upsert` for write steps |

Write steps (`insert`/`update`/`upsert`) additionally require:
- `documentUriTemplate` — URI pattern for the document to write, e.g. `/data/{plant}/{matnr}.json`
- `collections` — MarkLogic collections to assign to the written document

**SQL editor features:**
- Full-screen editor dialog with live syntax validation (bracket matching, open quotes, trailing AND/OR, etc.)
- Autocomplete for `{Entity.attribute}` placeholders — triggered by typing `{`. Suggestions are derived from the project's Corticon vocabulary (`.ecore` file, configured in Project Settings).
- SQL warnings shown inline; errors block saving.

#### Test tab

Enter values for the `{placeholder}` parameters extracted from your SQL and click **Run Test**. The portal executes each enabled step against your live MarkLogic instance and shows the result rows. Useful for verifying your SQL and TDE views are correct before deploying a decision service.

#### Project Settings tab

Configure the path to the Corticon.js workspace and the vocabulary (`.ecore`) file for this rule project. The portal uses the vocabulary to validate `{placeholder}` parameter names in your SQL against real entity/attribute names, and to power autocomplete in the SQL editor.

---

### 5.2 Deployment Config

**Purpose:** Manage the compilation and deployment settings for each Corticon.js rule project / bundle. These configs are used by the Decision Service Test page to compile and deploy decision services directly from the browser.

#### Layout

Same two-panel layout as Query Maintenance. The right panel has two tabs: *Compilation* and *Deployment*.

#### What you can do

| Action | How |
|---|---|
| Create a project | **New Project** button |
| Create a config | **New Config** button (select a project first) |
| Copy a project | **Copy Project** button — duplicates all configs to a new project name |
| Rename a project | Click the pencil icon next to the project name |
| Delete a config | **Delete** button |
| Save changes | **Save** button |

#### Compilation tab

Settings that control how the Corticon compiler and Gradle compile and deploy the rule project:

| Field | Description |
|---|---|
| Java Home | Path to the JDK used by the Corticon compiler |
| Platform | Target platform — always `MarkLogic` |
| Input ERF | Path to the Corticon `.erf` (ruleflow) file to compile |
| Output Directory | Where the compiled decision service bundle is written locally before upload |
| Corticon Home | Installation directory of Corticon.js Studio |
| Dependent JS files | Additional JavaScript files to bundle with the decision service (e.g. ADC callout files) |

#### Deployment tab

Settings that control where the compiled bundle is uploaded in MarkLogic:

| Field | Description |
|---|---|
| Bundle URI Base | MarkLogic modules path prefix (default: `/ext`) |
| ML App Name | MarkLogic application name used in the modules URI |
| ML Host | MarkLogic hostname |
| ML REST Port | MarkLogic REST App Server port |
| ML REST Auth | Authentication method: `digest`, `basic`, or `certificate` |
| ML Username / Password | Credentials for the deployment Gradle task |
| Modules Database | Target modules database |
| Gradle Project Dir | Directory containing the Gradle build scripts |
| Additional Gradle Args | Any extra Gradle command-line arguments |

#### Deployed versions

The bottom section of the Deployment tab shows a history of all deployed versions for this bundle, including:
- Version number
- Bundle URI in MarkLogic modules database
- Timestamp of when that version was deployed

This information is stored back in the config document itself and is used by the Decision Service Test page to confirm that a bundle exists before enabling the Execute button.

---

### 5.3 Decision Service Test

**Purpose:** Select a deployed decision service, enter a JSON payload, execute it, and inspect the results — including rule messages, rule trace, and server-side logs.

#### Layout

- **Left panel** — Tree navigator showing all deployment configs, grouped by project. Each bundle shows its latest deployed version number.
- **Right panel** — Input/output area with a top information bar, three main tabs (*Test*, *Rule Messages*, *Rule Trace*), and a Compile & Deploy section at the bottom.

#### Selecting a decision service

Click any bundle in the left tree. The information bar shows:
- **Bundle URI** — the MarkLogic modules path of the decision service
- **Date/Time Deployed** — when the current version was last deployed (read from the config document)
- **Last Execution** — client-side timestamp of the most recent test run

#### Test tab

1. **Enter a JSON payload** in the *Raw JSON* textarea — must be a JSON array of objects.
   - The portal auto-normalises pasted JSON (wraps bare objects in an array, sorts keys).
   - Switch to the *Explorer* tab for a collapsible tree view of the same JSON.
2. **Configure options:**
   - *Debug Engine* — enables Corticon engine verbose logging (log level 1)
   - *Rule Tracing* — includes execution metrics in the response
3. Click **Execute** (disabled until a bundle is confirmed deployed).
4. The response appears in the output section as both raw JSON and an Explorer tree.
5. Use **Recall** (the history dropdown) to replay a previous payload.

#### Rule Messages tab

Displays the rule messages emitted by the decision service in a sortable/filterable grid. Expand any row to see the full rule detail panel, which shows the rule statement, conditions, and actions sourced from the ruleflow documentation document stored in MarkLogic.

#### Rule Trace tab

Shows the execution trace — which rulesheets fired, in what order, with what timing. Also expandable with rule detail panel.

#### Compile & Deploy section

At the bottom of the right panel, a collapsible section lets you compile and deploy without leaving the test page:

1. Set the **bundle version** number (auto-incremented from the last deployed version).
2. Click **Compile & Deploy** — a streaming log shows the Corticon compiler and Gradle output in real time.
3. On success, the config document is updated with the new deployed version entry, and the Deploy Date in the info bar refreshes automatically.

#### Logs button

Fetches the last N lines of the MarkLogic server log for correlation with a test run. The log window is anchored to the time of the last execution.

---

## 6. MarkLogic Data Written by the Portal

The portal creates and manages the following documents in MarkLogic:

### Deployment Config documents

**Collection:** `DeploymentConfigs`
**URI pattern:** `/DeploymentConfigs/{projectName}/{bundleName}.json`

```json
{
  "projectName": "MyProject",
  "bundleName": "ProductDecisions",
  "compilation": {
    "javaHome": "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.8.9-hotspot",
    "platform": "MarkLogic",
    "dependentJS": ["MarkLogicServiceCallout.js", "MarkLogicQueryConnector.js", "MarkLogicQueryLibrary.js"],
    "inputErf": "C:\\rules\\MyProject\\ProductDecisions.erf",
    "outputDir": "C:\\rules\\output",
    "corticonHome": "C:\\CorticonJS\\Studio"
  },
  "deployment": {
    "bundleUriBase": "/ext",
    "mlAppName": "corticonml",
    "mlHost": "localhost",
    "mlRestPort": 8004,
    "mlRestAuthentication": "digest",
    "mlUsername": "your-ml-username",
    "mlPassword": "your-ml-password",
    "modulesDatabase": "corticonml-modules",
    "gradleProjectDir": "C:\\rules\\gradle",
    "additionalGradleArgs": ""
  },
  "deployedVersions": [
    {
      "version": 1,
      "bundleUri": "/ext/MyProject/ProductDecisions/1/decisionServiceBundle.js",
      "ruleflowUri": "/rules/MyProject/ProductDecisions.json",
      "deployedAt": "2026/04/21 14:30:00"
    }
  ]
}
```

### Query Definition documents

**Collection:** *(no collection — retrieved by URI pattern)*
**URI pattern:** `/queries/{ruleProjectName}/{queryName}.json`

```json
{
  "queryName": "product-lookup",
  "steps": [
    {
      "sequenceNo": 1,
      "statement": "SELECT * FROM Products WHERE ID IN ({Product.Id})",
      "addAsTopLevelEntity": null,
      "addToExistingEntity": "Root",
      "roleName": "products",
      "maxRows": 5000,
      "enable": true
    }
  ]
}
```

### Ruleflow documentation documents

**URI pattern:** `/rules/{projectName}/{ruleflowName}.json`

Created automatically during compilation. Contains metadata about rulesheets and rules — used by the portal to render the rule detail panel in the Rule Messages and Rule Trace tabs.

---

## 7. The Advanced Data Connector (ADC)

The query definitions created in the [Query Maintenance](#51-query-maintenance) page are consumed at runtime by the **AdvancedDataConnectorML** Corticon.js Service Callout. This is the bridge between your rule project and the query definitions stored in MarkLogic.

### What the ADC does

When a Corticon.js decision service that includes the ADC runs, it:

1. Reads `queryName` and `ruleProject` from the `QueryConfig` entity (or from Service Callout Runtime Properties).
2. Fetches the query definition document from MarkLogic at `/queries/{ruleProject}/{queryName}.json`.
3. Resolves `{Entity.attribute}` placeholders against the current Corticon working memory.
4. Rewrites the SQL to use `@param` bindings (no string concatenation — no SQL injection risk).
5. Executes each step against MarkLogic TDE views using the Optic API (`op.fromSQL`).
6. Writes the result rows back into Corticon working memory as entity associations.

### Setting up the ADC in your rule project

1. Add the three ADC JavaScript files to your Corticon.js project's Extensions:
   - `MarkLogicServiceCallout.js`
   - `MarkLogicQueryConnector.js`
   - `MarkLogicQueryLibrary.js`

   (Source: [AdvancedDataConnectorML](../../../../Development/corticon.js-samples/ServiceCallOut/AdvancedDataConnectorML/))

2. Add a **Service Callout** block to your ruleflow and select `MarkLogicServiceCallout.js.AdvancedDataConnectorML` as the service.

3. Configure which query to run — either via **Runtime Properties** on the SCO block (static), or via a `QueryConfig` entity set by a rulesheet before the SCO (dynamic).

4. The query definitions you author in this portal's Query Maintenance page are what the ADC loads at runtime. The URI must match: `/queries/{ruleProject}/{queryName}.json`.

For complete ADC documentation including step field reference, multi-step chaining, write steps, debug mode, and Studio proxy testing, see the [AdvancedDataConnectorML README](../../../../Development/corticon.js-samples/ServiceCallOut/AdvancedDataConnectorML/README.md).

---

## 8. End-to-End Workflow

The typical workflow for setting up a new decision service with data access:

```
1. Query Maintenance page
   └─ Create a rule project
   └─ Create one or more query definitions
   └─ Test each query against your live MarkLogic TDE views

2. Corticon.js Studio (outside this portal)
   └─ Add ADC files to Corticon Extensions
   └─ Add a Service Callout block to the ruleflow
   └─ Set queryName / ruleProject (Runtime Properties or QueryConfig rulesheet)
   └─ Build and test the rule project in Studio

3. Deployment Config page
   └─ Create a project and config
   └─ Fill in Compilation and Deployment settings
   └─ Save

4. Decision Service Test page
   └─ Select the config
   └─ Set a bundle version number
   └─ Click Compile & Deploy (streaming log shows progress)
   └─ When complete, click Execute with a sample payload
   └─ Inspect results, rule messages, and rule trace
   └─ Iterate: adjust rules in Studio → bump version → redeploy → retest
```

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Failed to load configurations" on startup | Express not running, wrong port, or MarkLogic unreachable | Start Express (`cd server && npm start`); verify `ML_HOST`/`ML_PORT` in `server/.env` |
| Execute button disabled | No bundle deployed yet for the selected config | Compile & Deploy first (bottom of Decision Service Test page) |
| Compile log shows "JAVA_HOME not set" | `compilation.javaHome` in config is blank or wrong | Edit the config in Deployment Config page; set Java Home to your JDK directory |
| "Cannot read properties of null (reading 'useState')" | Multiple React instances (duplicate react in node_modules) | `vite.config.js` has `resolve.dedupe: ['react','react-dom']` — ensure it is present |
| Kendo components not rendering | Missing or invalid Telerik license | Ensure `telerik-license.txt` is in `portal/` (see §4.4) |
| `SQL-TABLENOTFOUND` in query test | TDE view does not exist in MarkLogic | Deploy the TDE template and verify view name matches the `FROM` clause |
| `SEC-PRIV` error during query execution | MarkLogic user lacks required execute privileges | Grant `xdmp-sql`/`xdmp-eval` privileges to the user's role (see ADC README §Deployment Step 5) |
| Deploy fails with Gradle error | Gradle not configured, wrong `corticonHome`, or missing JDK | Review the streaming compile log; verify all paths in the Deployment Config |
| Bundle exists but Deploy Date shows blank | Old doc format without `deployedVersions` | Re-deploy once — the new format is written automatically |
