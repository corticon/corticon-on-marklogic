# Split Data Loading Pattern

This folder is for split, version-controlled JSON documents that can be loaded via `gradle mlLoadData`.

Recommended approach:

1. Split exported Corticon output into small docs by type/entity.
2. Store those docs in leaf folders (for example `claim`, `explanationOfBenefit`, `corticon/entities/alert`).
3. Keep `collections.properties` and `permissions.properties` in each leaf folder so metadata is deterministic.

Example command:

```powershell
cd marklogic
gradle mlLoadData -i
```

