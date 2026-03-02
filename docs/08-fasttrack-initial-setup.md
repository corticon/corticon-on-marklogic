# Initial FastTrack Setup (Template Workflow)

This article documents a beginner-friendly setup path for the FastTrack-facing parts of the template.

The template intentionally does not ship a full UI app. It ships the pieces you need to start one cleanly:

1. package templates
2. proxy scaffold
3. reusable UI snippets
4. documented endpoint patterns

## 1. What the Template Includes for FastTrack

In [`ui-fasttrack/`](https://github.com/corticon/explainable-decision-ledger/tree/main/ui-fasttrack):

1. `package.template.json`
2. `proxy/package.template.json`
3. `proxy/config-template.js`
4. `proxy/server.js`
5. `proxy/handlers.js`
6. `reusable/MarkdownMessage.jsx`
7. `reusable/markdown-message.css`

These are template assets, not final app files.

## 2. What You Need to Add Locally

1. FastTrack archive (local `.tgz`)
2. local/generated `package.json` files (from template files)
3. `proxy/config.js` with your local MarkLogic host/port/user
4. your project UI pages/components

The template-local `.gitignore` files intentionally ignore these generated/local files.

## 3. Step-by-Step Setup

### Step 1: Add the FastTrack Archive

Place your FastTrack archive in:

1. [`ui-fasttrack/`](https://github.com/corticon/explainable-decision-ledger/tree/main/ui-fasttrack)

Example filename pattern:

1. `ml-fasttrack-2.x.y-<build>.tgz`

Update:

1. [`ui-fasttrack/package.template.json`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/package.template.json)

So the dependency points to your exact archive filename.

## Step 2: Create Local `package.json` Files from Templates

Create local (ignored) package files:

1. `ui-fasttrack/package.template.json` -> `ui-fasttrack/package.json`
2. `ui-fasttrack/proxy/package.template.json` -> `ui-fasttrack/proxy/package.json`

Why this pattern is used:

1. the repo stays template-only and version-agnostic
2. local teams can use different FastTrack builds without changing tracked files

## Step 3: Configure the Proxy

Copy:

1. [`ui-fasttrack/proxy/config-template.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/config-template.js)
2. to [`ui-fasttrack/proxy/config.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/config.js)

Edit:

1. proxy host/port
2. MarkLogic host/REST port
3. app-reader credentials

Template config source:

1. [`ui-fasttrack/proxy/config-template.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/config-template.js)

## Step 4: Install and Run the Proxy

```powershell
cd ui-fasttrack\proxy
npm install
npm start
```

Verify:

1. `http://localhost:14001/health`
2. `http://localhost:14001/api/endpoints`

The `/api/endpoints` response is a template endpoint-contract stub for UI development.

## 4. Why the Proxy Route Behavior Is Important for Decision-Ledger Demos

The template proxy deliberately:

1. transforms `/v1/search` responses
2. streams `/v1/documents` responses directly
3. streams other `/v1/*` routes directly

Why this matters:

1. explainability payloads (input/output/trace) can be large
2. full buffering in proxy middleware can cause slow responses or failures
3. UI drilldown pages often need raw linked documents

Template implementation:

1. [`ui-fasttrack/proxy/server.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/server.js)
2. [`ui-fasttrack/proxy/handlers.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/handlers.js)

## 5. Initial UI Integration Order (Recommended for Novices)

Build UI features in this order:

1. health check + proxy connectivity
2. search/list screen
3. case detail screen
4. linked input/output document drilldown
5. messages panel
6. trace panel
7. analytics dashboard panels
8. assistant/chat panel (optional)

Why this order works:

1. each step validates the previous layer
2. you avoid building UI complexity before document shape and endpoints are stable

## 6. Endpoint Categories to Plan for Early

The template does not force names, but most decision-ledger UIs end up needing:

1. explorer/search endpoint
2. case detail endpoint
3. analytics endpoint (summary counts, distributions, hotspots)
4. assistant/chat endpoint (optional)
5. linked document retrieval via `/v1/documents`

Template proxy stub shows these categories in:

1. [`ui-fasttrack/proxy/server.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/server.js)

## 7. FastTrack vs Custom React Components

This repo pattern supports both:

1. FastTrack components (for quick data-driven UI assembly)
2. custom React components (for domain-specific explainability UX)

Harvested examples use both FastTrack components and custom wrappers/panels:

1. [`reference-patterns/ui/auto-insurance/ExecutionTrace.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/ExecutionTrace.jsx) (`DataGrid`)
2. [`reference-patterns/ui/auto-insurance/PoliciesByState.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/PoliciesByState.jsx) (`GeoMap`)
3. [`reference-patterns/ui/auto-insurance/PolicyNetworkGraph.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/PolicyNetworkGraph.jsx) (`NetworkGraph`)

## 8. Rendering Assistant/LLM Responses (Template Snippet)

If you add a chat/assistant feature and the backend returns markdown:

1. render markdown as formatted content
2. do not show raw markdown syntax to end users

Template reusable component:

1. [`ui-fasttrack/reusable/MarkdownMessage.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/reusable/MarkdownMessage.jsx)

Harvested chat UI reference:

1. [`reference-patterns/ui/auto-insurance/Chatbot.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/Chatbot.jsx)

## 9. Important Security and Dev Notes

1. The proxy is a scaffold, not a production auth solution
2. Use app-reader credentials for read paths where possible
3. Add authentication/session logic before multi-user deployment
4. Remove hard-coded secrets (for example map keys) from components and move to config/env

The harvested `PoliciesByState.jsx` explicitly demonstrates a map-key placeholder concern.

## 10. Next Article

Continue with:

1. [`docs/09-fasttrack-component-patterns.md`](09-fasttrack-component-patterns.md)

That article maps component types to explainability, traceability, analytics, and visualization goals.


