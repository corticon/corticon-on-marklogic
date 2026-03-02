# Initial Environment Setup (Novice Guide)

This article helps you prepare a local machine to use the template and run MarkLogic + Corticon.js decision demos.

The steps below are intentionally practical and focus on verifying each tool before you start editing template code.

## What You Need (Baseline)

Required for the template:

1. MarkLogic Server 12+
2. Java (recommended 17+) for `ml-gradle`
3. Gradle (if you are not using a wrapper)
4. Node.js (recommended 18+)
5. `curl`

Optional but commonly used in the harvested patterns:

1. Python 3 (data splitting / enrichment scripts)
2. MarkLogic Flux CLI (large structured reference-data loads)
3. Corticon.js Studio (authoring/rebuilding decision services)

## 1. MarkLogic Server Setup

### Install and Start MarkLogic

Install MarkLogic Server and ensure the service is running.

### Verify MarkLogic Is Reachable

Open a browser and confirm you can reach:

1. Admin UI (commonly `http://localhost:8001`)
2. Query Console (commonly `http://localhost:8000/qconsole`)

If your ports differ, use the ports from your local installation.

### Why This Matters for the Template

The template deploys a dedicated REST app server and databases via ml-gradle. MarkLogic must be running before you run:

1. `gradle mlDeploy`
2. `gradle mlLoadData`

## 2. Java and Gradle Setup

### Verify Java

```powershell
java -version
```

If this fails:

1. install a JDK
2. restart your terminal
3. confirm `JAVA_HOME` is set (if your environment requires it)

### Verify Gradle

```powershell
gradle -v
```

If `gradle` is not found:

1. install Gradle
2. add it to `PATH`

## 3. Node.js Setup (for FastTrack UI / Proxy)

### Verify Node and npm

```powershell
node -v
npm -v
```

The template UI area and proxy scaffolds assume Node is available before you create local `package.json` files from the template files.

## 4. Python Setup (Optional but Recommended)

Python is used in harvested data-prep patterns such as:

1. splitting multi-record output docs
2. enriching/splitting trace rows into household-linked trace docs

Examples are preserved in:

1. [`reference-patterns/marklogic/data-prep/split_output.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/split_output.py)
2. [`reference-patterns/marklogic/data-prep/enrich_trace.py`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/enrich_trace.py)

Verify:

```powershell
python --version
```

## 5. MarkLogic Flux CLI Setup (Optional)

Flux is useful when loading larger reference datasets with explicit URI templates, collections, and permissions.

Harvested examples:

1. [`reference-patterns/marklogic/data-prep/flux/flux-options-practitioners.txt`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/flux/flux-options-practitioners.txt)
2. [`reference-patterns/marklogic/data-prep/flux/flux-options-organizations.txt`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/flux/flux-options-organizations.txt)
3. [`reference-patterns/marklogic/data-prep/flux/flux-options-cptcodes.txt`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/data-prep/flux/flux-options-cptcodes.txt)

If you do not need large reference-data loads, you can skip Flux initially and still use the template.

## 6. Corticon.js Bundle Preparation (Important)

The template includes a placeholder file at:

1. [`marklogic/src/main/ml-modules/ext/decisionServiceBundle.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/src/main/ml-modules/ext/decisionServiceBundle.js)

You must replace it with your compiled Corticon JS decision service bundle before decision execution will work.

If you are only learning the repo structure, you can still read and configure everything else first.

## 7. Configure the Root Template

From the repo root:

1. clone/copy this repository as your project starter
2. work from the repo root template assets (`marklogic/`, `ui-fasttrack/`, `scripts/`, `.env.template`)
3. keep local generated config files out of source control (`.env`, `marklogic/gradle.properties`, `ui-fasttrack/proxy/config.js`)

Create local config:

```powershell
Copy-Item .env.template .env
notepad .env
```

Then generate local Gradle properties:

```powershell
.\scripts\init-from-env.ps1
```

This generates:

1. [`marklogic/gradle.properties`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/gradle.properties) (ignored)

From:

1. [`.env.template`](https://github.com/corticon/explainable-decision-ledger/blob/main/.env.template)
2. [`marklogic/gradle-template.properties`](https://github.com/corticon/explainable-decision-ledger/blob/main/marklogic/gradle-template.properties)
3. [`scripts/init-from-env.ps1`](https://github.com/corticon/explainable-decision-ledger/blob/main/scripts/init-from-env.ps1)

## 8. Verify the MarkLogic Template Deploy Path

After replacing the Corticon bundle (or even before, if you only want infra deploy):

```powershell
cd marklogic
gradle mlDeploy -i
```

If deployment fails, check:

1. MarkLogic is running
2. admin username/password in `.env`
3. host/port values in `.env`
4. Java/Gradle installation

### Security Guardrail (Critical)

Do not reuse the cluster admin account for app-scoped users.

Specifically:

1. `MARKLOGIC_APP_ADMIN_USERNAME` must not equal `MARKLOGIC_ADMIN_USERNAME`
2. `MARKLOGIC_APP_ADMIN_USERNAME` must not be `admin`
3. app admin/writer/reader usernames should be distinct app-scoped accounts

Why:

1. the template deploys users/roles from `marklogic/src/main/ml-config/security/users/*.json`
2. if `%%usernameAdmin%%` resolves to `admin`, deployment can overwrite cluster-admin role assignments
3. that can block Admin UI (`SEC-NOADMIN`) and block Manage API writes (`/manage/v3` 403)

### Recovery if You Hit `SEC-NOADMIN`

Symptoms:

1. `gradle mlTestConnections` shows:
   - Manage App Server connects
   - Admin App Server fails with `SEC-NOADMIN`
2. `gradle mlDeploy` fails on `/manage/v3` with `403 Forbidden`
3. MarkLogic Admin UI (`http://localhost:8001`) returns forbidden for `admin`

Recovery path (requires elevated PowerShell):

1. Verify you have a filesystem backup containing `Forests\Security` (for example `C:\Progress\mlBackup\20250922-1242396282749`).
2. Run the recovery script as Administrator:

```powershell
cd C:\Users\smeldon\github\explainable-decision-ledger
powershell -ExecutionPolicy Bypass -File .\scripts\restore-security-forest.ps1 -BackupRoot "C:\Progress\mlBackup\20250922-1242396282749"
```

3. Re-test connectivity:

```powershell
cd marklogic
gradle mlTestConnections --no-daemon
```

4. Confirm `Admin App Server` succeeds before running `gradle mlDeploy`.

## 9. Verify Local UI Proxy Template Path (Optional Early Check)

Create local files from templates:

1. [`ui-fasttrack/package.template.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/package.template.json) -> local `package.json`
2. [`ui-fasttrack/proxy/package.template.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/package.template.json) -> local `package.json`
3. [`ui-fasttrack/proxy/config-template.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/config-template.js) -> local `config.js`

Then run the proxy:

```powershell
cd ui-fasttrack\proxy
npm install
npm start
```

Check:

1. `http://localhost:14001/health`

## 10. Common Setup Mistakes (Observed)

1. Editing `gradle-template.properties` instead of `.env`
   - Use `.env` for local values; keep template files generic.

2. Forgetting to replace `decisionServiceBundle.js`
   - Deploy can succeed, but runtime decision execution fails.

3. Reusing the same MarkLogic app name/port across multiple experiments
   - Can overwrite settings or make debugging confusing.

4. Committing generated local files
   - `.env`, `gradle.properties`, and `config.js` are intentionally ignored.

## Next Article

Continue with:

1. [`docs/02-common-foundation-across-projects.md`](02-common-foundation-across-projects.md)

That article explains the common concepts and repository conventions used throughout the template and harvested patterns.

