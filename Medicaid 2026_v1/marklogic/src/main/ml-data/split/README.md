# Split Data Loading Pattern

This folder supports deterministic `mlLoadData` runs for Medicaid decision-ledger documents.

Recommended folders:

1. `input/`  -> collection `Medicaid 2026_v1_input`
2. `output/` -> collection `Medicaid 2026_v1_output`
3. `trace/`  -> collection `Medicaid 2026_v1_trace`

If you change `collectionPrefix` in `gradle.properties`, update these collection property files to match.

Load command:

```powershell
cd marklogic
gradle mlLoadData -i
```
