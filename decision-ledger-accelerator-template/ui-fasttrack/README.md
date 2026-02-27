# FastTrack UI Starter Notes

This folder is where you place your FastTrack 2.x archive and scaffold your UI project.

## Required Input

1. Copy your FastTrack archive (`ml-fasttrack-2.x.y-<build>.tgz`) into this folder.
2. Update `package.template.json` so the `ml-fasttrack` dependency points to your exact filename.

## Example

If your archive is:

```text
ml-fasttrack-2.0.1-20250815a.tgz
```

Set dependency to:

```json
"ml-fasttrack": "file:./ml-fasttrack-2.0.1-20250815a.tgz"
```

## Suggested Next Step

Use this package template as a base for your app-specific `package.json`, then wire it to the MarkLogic endpoints in `../marklogic`.
