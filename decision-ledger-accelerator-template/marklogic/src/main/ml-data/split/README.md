# Split Data Loading Pattern

Use this folder for deterministic, version-controlled data loads via `mlLoadData`.

Recommended split layout:

1. `input/` for raw request payloads.
2. `output/` for enriched decision documents.
3. `trace/` for optional rule trace/evidence documents.

Each leaf folder should include:

1. `collections.properties`
2. `permissions.properties`

Example run:

```powershell
cd marklogic
gradle mlLoadData -i
```
