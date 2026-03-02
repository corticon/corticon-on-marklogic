# Medicaid FastTrack UI

FastTrack-based React UI for Medicaid 2026 determinations, analytics, and support workflows.

## Views

1. Determinations explorer (`/v1/resources/eligibilityDeterminations`)
2. Analytics dashboard (`/v1/resources/analytics`)
3. Assistant chat panel (`/v1/resources/chatbot`, or proxy `/api/chatbot`)

## Dependencies

1. MarkLogic backend from `../marklogic` deployed and reachable.
2. Local proxy from `./proxy` running (recommended).

## Run Proxy First

```powershell
cd proxy
npm install
npm start
```

Default proxy URL: `http://localhost:14001`

Configure via environment variables if needed:

1. `ML_PROXY_USERNAME`
2. `ML_PROXY_PASSWORD`
3. `ML_REST_HOST`
4. `ML_REST_PORT`
5. `UI_PROXY_PORT`
6. `OPENAI_API_KEY`
7. `OPENAI_MODEL`

## Run UI

```powershell
cd ..
npm install
npm run dev
```

Default URL: `http://localhost:5173`

## Build

```powershell
npm run build
```

## Notes

1. `ml-fasttrack-2.0.0-20250701b.tgz` is included as the current FastTrack archive dependency.
2. `.env.example` controls UI-local options (including debug flags).
3. The visual design patterns were derived from `../mockup`, while API behavior is implemented in FastTrack + custom React components.
4. For reusable generic scaffolding, see <https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/README.md>.


