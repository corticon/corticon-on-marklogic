# PDP Decision Management

An administration portal for managing Corticon.js decision services deployed to MarkLogic. It provides a browser-based UI for authoring SQL query definitions, configuring decision service deployments, and compiling, deploying, and testing decision services — all without leaving the browser.

## Full documentation

**→ [portal/README.md](portal/README.md)**

The portal README covers everything you need to get started and operate the system: prerequisites, installation, environment configuration, a description of all three portal pages, the MarkLogic data model, Advanced Data Connector (ADC) setup, the end-to-end workflow, and troubleshooting.

## Directory layout

| Path | Contents |
|---|---|
| `portal/` | React/Vite frontend + Express backend. Start here. |
| `scripts/` | PowerShell convenience script to start/stop the portal (`PDP-Portal-Start.ps1`). |

## Quick start

```powershell
# From this directory (PDP-Decision-Management/)
.\scripts\PDP-Portal-Start.ps1
```

See [portal/README.md §4](portal/README.md#4-installation--setup) for full installation and configuration instructions before running for the first time.
