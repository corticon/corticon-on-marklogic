# Explainable Decision Ledger with Corticon.js and MarkLogic

This repository contains reference implementations and domain demos for building explainable decision systems with Corticon.js running inside MarkLogic.

## Current Project Map

1. `docs`
   - Consolidated documentation hub for this repository.
   - Canonical reusable template code lives in <https://github.com/corticon/explainable-decision-ledger>.
2. `Medicaid 2026_v1`
   - Full Medicaid decision-ledger demo (MarkLogic services, analytics, chatbot, FastTrack UI, and mockup app).
   - This replaces the previous `MedicaidEligibility` and `Eligibility Pathways` demos.
3. `Auto Insurance`
   - Trigger-based underwriting demo with explainability UI.
4. `Trade Data Settlement`
   - Minimal trigger-based settlement enrichment example.
5. `ml-gradle.wiki`
   - Local copy of ml-gradle documentation.

## Common Architecture

All projects follow the same core pattern:

1. Corticon rules are compiled to a JavaScript decision bundle.
2. MarkLogic executes the bundle (resource endpoint and/or trigger).
3. Output is stored with explainability evidence (`messages`, `metrics`, and ledger metadata).
4. REST resources and optional UI/proxy tiers expose search, analytics, and decision explanations.

## Baseline Versions

Repository baseline (aligned to latest Medicaid 2026 project components):

1. MarkLogic 12+
2. Java 17+
3. Gradle 8+
4. Node.js 18+
5. `ml-gradle` 6.1.0 for active backend projects
6. FastTrack 2.x assets where FastTrack is used

## Important Deployment Note

Many projects default to similar app names and ports. Deploy one project at a time, or change per-project `mlAppName` / `mlRestPort` to avoid collisions.

## Where to Start

1. Documentation hub:
   - `docs/README.md`
2. Canonical template repository:
   - <https://github.com/corticon/explainable-decision-ledger>
   - <https://github.com/corticon/explainable-decision-ledger/tree/main/marklogic>
   - <https://github.com/corticon/explainable-decision-ledger/tree/main/ui-fasttrack>
3. Primary walkthrough demo:
   - `Medicaid 2026_v1/README.md`
4. Additional domain demos:
   - `Auto Insurance/README.md`
   - `Trade Data Settlement/README.md`

## Documentation Index

- Repo documentation hub: `docs/README.md`
- Medicaid backend details: `Medicaid 2026_v1/marklogic/README.md`
- Medicaid FastTrack UI: `Medicaid 2026_v1/ui-fasttrack/README.md`
- Medicaid UI proxy: `Medicaid 2026_v1/ui-fasttrack/proxy/README.md`
- Auto Insurance backend: `Auto Insurance/mlCorticonAutoInsurance/README.md`
- Auto Insurance middle tier: `Auto Insurance/insurance-chatbot/README.md`
- Auto Insurance UI: `Auto Insurance/insurance-chatbot/ui/README.md`


