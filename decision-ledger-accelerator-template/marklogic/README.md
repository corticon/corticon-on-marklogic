# MarkLogic Subproject Notes

This is the ml-gradle project to deploy databases, security, modules, schemas, and seed data.

## Place Your Files Here

1. `src/main/ml-modules/ext/decisionServiceBundle.js`  
Your compiled Corticon JavaScript decision service bundle.

2. `src/main/ml-modules/services/*.sjs` and `*.xml`  
REST resource extensions and descriptors (`processAndEnrich` baseline included).

3. `src/main/ml-schemas/tde/*.tde`  
TDE templates for SQL and analytics.

4. `src/main/ml-config/triggers/*.json` and `src/main/ml-modules/ext/corticonTrigger.sjs`  
Optional trigger-based execution path (disabled by default in this template).

5. `src/main/ml-data/split/**`  
Split Corticon output docs and optional reference docs for `mlLoadData`.

6. `src/main/ml-config/**`  
Databases, users, roles, and app server definitions.

## Deploy Commands

```powershell
gradle mlDeploy -i
gradle mlLoadData -i
```
