# FastTrack UI Starter Notes

This folder holds template assets for bootstrapping a FastTrack-based UI against the template MarkLogic backend.

## Required Input

1. Place your FastTrack archive (`ml-fasttrack-2.x.y-<build>.tgz`) in this folder.
2. Update `package.template.json` so `ml-fasttrack` points at that exact file.

Example:

```json
"ml-fasttrack": "file:./ml-fasttrack-2.0.0-20250701b.tgz"
```

## Suggested Workflow

1. Copy `package.template.json` to `package.json`.
2. Add your app scripts/components.
3. Configure API base URL to a proxy or directly to MarkLogic REST.
4. Connect UI views to:
   - `/v1/resources/processAndEnrich`
   - `/v1/resources/chunkSearch`
   - `/v1/search?options=search-options`

## Recommendation

Keep credentials in a local proxy/middle tier and avoid direct browser auth to MarkLogic in production environments.
