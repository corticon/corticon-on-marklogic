# Decision Ledger Accelerator Template

This directory is a baseline starter for building a new Corticon.js + MarkLogic Explainable Decision Ledger implementation.

It aligns with ml-gradle best-practice layout from `ml-gradle.wiki/Project-layout.md` and incorporates the authoritative MarkLogic+Corticon patterns from `accenture-demo/marklogic`.

## What This Template Assumes

1. Windows desktop environment.
2. MarkLogic 12 available.
3. A compiled Corticon JavaScript decision bundle ready to deploy (`decisionServiceBundle.js`).
4. Access to a FastTrack archive in the `2.x` line, named similar to `ml-fasttrack-2.0.0-20250701b.tgz`.

## Layout

```text
decision-ledger-accelerator-template/
  .env.template
  scripts/
    init-from-env.ps1
  marklogic/
    build.gradle
    gradle-template.properties
    src/main/
      ml-config/
      ml-data/
      ml-modules/
      ml-schemas/
  ui-fasttrack/
    README.md
    package.template.json
```

## User-Configured Files and Where They Go

1. Corticon decision service bundle
   - Place at `marklogic/src/main/ml-modules/ext/decisionServiceBundle.js`.
   - Replace the placeholder file in this template.

2. Split Corticon output data (optional but recommended for repeatable demos)
   - Place JSON docs under `marklogic/src/main/ml-data/split/...` by data type.
   - Keep `collections.properties` and `permissions.properties` in each leaf folder.

3. MarkLogic credentials and app naming
   - Copy `.env.template` to `.env` and edit values.
   - Run `scripts/init-from-env.ps1` to generate `marklogic/gradle.properties` from `marklogic/gradle-template.properties`.

4. FastTrack archive
   - Place `ml-fasttrack-2.x.y-<build>.tgz` into `ui-fasttrack/`.
   - Update `ui-fasttrack/package.template.json` to point to the exact archive filename.

## Start Here (Windows)

1. Copy and edit environment file:

```powershell
cd decision-ledger-accelerator-template
Copy-Item .env.template .env
notepad .env
```

2. Generate `gradle.properties`:

```powershell
.\scripts\init-from-env.ps1
```

3. Add your Corticon bundle:

```text
marklogic/src/main/ml-modules/ext/decisionServiceBundle.js
```

4. Optional: place split Corticon export docs under `marklogic/src/main/ml-data/split`.

5. Deploy MarkLogic app:

```powershell
cd marklogic
gradle mlDeploy -i
```

6. Load split data:

```powershell
gradle mlLoadData -i
```

7. Execute the decision service via REST resource:

```powershell
curl.exe --location --request POST "http://localhost:8003/v1/resources/processAndEnrich" `
  --header "Content-Type: application/json" `
  --digest --user <writer-user>:<writer-password> `
  --data-binary "@<path-to-input-json>"
```

8. Verify output collection:

```javascript
cts.estimate(cts.collectionQuery("corticon-results"))
```

## If You Need to Recreate the Gradle Project from Scratch

This template already includes a ready ml-gradle layout. If you need to rebuild it manually:

1. Create a new folder and add `build.gradle` with `com.marklogic.ml-gradle`.
2. Run `gradle mlNewProject` (optional wizard scaffold).
3. Ensure these directories exist (per `ml-gradle.wiki/Project-layout.md`):
   - `src/main/ml-config`
   - `src/main/ml-data`
   - `src/main/ml-modules`
   - `src/main/ml-schemas`
4. Copy this template's `marklogic/src/main` contents into your new project and adjust tokens/properties.

## Notes

1. This template uses the service-based process-and-enrich pattern (authoritative baseline).
2. Optional trigger skeletons are included:
   - `marklogic/src/main/ml-config/triggers/corticonTrigger.json` (disabled by default)
   - `marklogic/src/main/ml-modules/ext/corticonTrigger.sjs`
3. Trigger-based execution can be enabled if your ingestion flow requires event-driven processing.
4. Keep tokens in `ml-config` payload files (`%%mlAppName%%`, etc.) and resolve environment values in `gradle.properties`.
