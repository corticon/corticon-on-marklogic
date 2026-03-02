# FastTrack Component Patterns (Visualization, Explainability, Traceability, Analytics)

This article catalogs front-end component patterns harvested from the reference projects and explains what each component type is useful for in a decision-ledger UI.

The emphasis is on assembling a FastTrack-style portal that helps users:

1. see what happened
2. understand why it happened
3. inspect trace evidence
4. compare cases and cohorts

## 1. Component Strategy: Build by User Task, Not by Library

A decision-ledger UI usually needs several different component types because users perform different tasks:

1. find a case
2. inspect a case
3. explain a decision
4. inspect trace steps
5. compare many cases
6. ask questions

The harvested patterns demonstrate this separation well.

## 2. Component Pattern Catalog (What Each Type Is Good For)

### A. Search Entry + Result Selection Components

Harvested example:

1. [`reference-patterns/ui/auto-insurance/PolicySearch.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/PolicySearch.jsx)

What it does:

1. captures user query text
2. calls a MarkLogic-backed search endpoint
3. renders a selectable result list
4. passes selected IDs back to parent state

Best for:

1. case lookup
2. operator workflow entry points
3. narrowing from population -> case detail

FastTrack portal placement:

1. left panel
2. top search bar
3. landing tab

### B. API Integration / Service Layer Modules

Harvested example:

1. [`reference-patterns/ui/auto-insurance/marklogicService.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/marklogicService.js)

What it does:

1. centralizes fetch calls
2. encapsulates proxy routes
3. normalizes endpoint URLs and options names
4. exposes functions for search, document fetch, and chat

Best for:

1. keeping UI components simpler
2. changing endpoint paths without touching every component
3. mixing search/resource/chat requests consistently

FastTrack portal placement:

1. shared `api/` or `services/` folder used by all pages/components

### C. Decision Message / Reason Log Table

Harvested example:

1. [`reference-patterns/ui/auto-insurance/DecisionLog.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/DecisionLog.jsx)

What it does:

1. displays rule messages with severity
2. shows rule and rulesheet context
3. visually highlights warnings/violations

Best for:

1. explainability (human-readable reasons)
2. audit review
3. business user validation of rule outcomes

FastTrack portal placement:

1. case detail tab ("Decision Messages")
2. right-side explanation panel

### D. Execution Trace Grid / Change Inspection Panels

Harvested example:

1. [`reference-patterns/ui/auto-insurance/ExecutionTrace.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/ExecutionTrace.jsx)

What it does:

1. renders trace metrics (attribute, association, entity changes)
2. uses `ml-fasttrack` `DataGrid` for tabular trace inspection
3. extracts rulesheet names for readability
4. displays before/after values

Best for:

1. traceability (what changed, in what order)
2. rule debugging
3. analyst validation of decision flow

FastTrack portal placement:

1. case detail tab ("Trace")
2. expandable pane under decision messages

Backend dependencies:

1. persisted trace metrics in output docs or separate trace docs
2. TDE trace views for population analytics (optional)

### E. Geospatial Visualization Components

Harvested example:

1. [`reference-patterns/ui/auto-insurance/PoliciesByState.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/PoliciesByState.jsx)

What it does:

1. aggregates records by state
2. maps results to geographic markers
3. uses `ml-fasttrack` `GeoMap`

Best for:

1. geographic analytics
2. identifying regional concentrations
3. management dashboards

FastTrack portal placement:

1. analytics dashboard tab
2. executive summary page

Important implementation note:

1. move map API keys to local config/env, not hard-coded component code

### F. Network / Relationship Graph Components

Harvested example:

1. [`reference-patterns/ui/auto-insurance/PolicyNetworkGraph.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/PolicyNetworkGraph.jsx)

What it does:

1. maps case entities (policy, drivers, vehicles) to nodes/edges
2. renders with `ml-fasttrack` `NetworkGraph`

Best for:

1. relationship explainability
2. entity-centric case understanding
3. demonstrating how decision context is distributed across related entities

FastTrack portal placement:

1. case detail "Relationships" tab
2. side-by-side with tabular detail view

### G. Chat / Assistant Components

Harvested example:

1. [`reference-patterns/ui/auto-insurance/Chatbot.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/Chatbot.jsx)

Template reusable rendering helper:

1. [`ui-fasttrack/reusable/MarkdownMessage.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/reusable/MarkdownMessage.jsx)

What they do:

1. capture natural-language questions
2. call backend chat/assistant endpoint
3. render assistant responses (often markdown)

Best for:

1. explainability narratives
2. guided investigation for novice users
3. natural-language access to decision evidence

FastTrack portal placement:

1. dedicated assistant tab
2. slide-out panel on case detail page

Backend dependencies (harvested examples):

1. [`reference-patterns/marklogic/services/analytics-and-ui/chatbot.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/analytics-and-ui/chatbot.sjs)
2. [`reference-patterns/marklogic/services/analytics-and-ui/eligibility-options.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/analytics-and-ui/eligibility-options.sjs)

### H. Error Boundary / Resilience Components

Harvested example:

1. [`reference-patterns/ui/auto-insurance/ErrorBoundary.jsx`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/ui/auto-insurance/ErrorBoundary.jsx)

What it does:

1. prevents one component crash from breaking the whole page
2. provides fallback UX for failures

Best for:

1. demo stability
2. incremental UI development while endpoints are still changing

FastTrack portal placement:

1. around high-risk widgets (maps, graphs, complex trace panels)
2. around the entire analytics dashboard route

## 3. Backend Component Support Patterns (MarkLogic + Proxy)

UI components become much easier to build when the backend is organized into clear endpoint types.

Template proxy support:

1. [`ui-fasttrack/proxy/server.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/server.js)
2. [`ui-fasttrack/proxy/handlers.js`](https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/proxy/handlers.js)

Harvested backend service patterns:

1. [`reference-patterns/marklogic/services/analytics-and-ui/eligibility-options.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/analytics-and-ui/eligibility-options.sjs)
   - search/detail helper endpoint style
2. [`reference-patterns/marklogic/services/analytics-and-ui/analytics.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/analytics-and-ui/analytics.sjs)
   - TDE/Optic analytics aggregation endpoint style
3. [`reference-patterns/marklogic/services/analytics-and-ui/chatbot.sjs`](https://github.com/corticon/explainable-decision-ledger/blob/main/reference-patterns/marklogic/services/analytics-and-ui/chatbot.sjs)
   - retrieval + explanation-oriented chat endpoint style

## 4. Component-to-Objective Mapping (Practical Guide)

### Explainability (Why did this decision happen?)

Use:

1. decision message table
2. case summary/detail panel
3. assistant/chat component

Data sources:

1. output payload
2. rule messages
3. linked input/output docs

### Traceability (What rules changed what?)

Use:

1. execution trace grid
2. sequence timeline or sortable table
3. linked trace document drilldown

Data sources:

1. trace metrics embedded in output docs or separate trace docs
2. trace TDE views (for cohort hotspot summaries)

### Analytics (What patterns exist across cases?)

Use:

1. charts
2. maps
3. aggregated tables
4. toplists / hotspots

Data sources:

1. TDE views queried through SQL or Optic
2. analytics resource endpoints

### Entity Relationship Understanding

Use:

1. network graph
2. linked tables/panels

Data sources:

1. payload entities and relationships
2. alert relationship TDE views (if modeled)

## 5. Suggested FastTrack Portal Layout for a Decision-Ledger Demo

One practical arrangement:

1. Tab 1: Search / Explorer
2. Tab 2: Case Detail (summary + messages + linked docs)
3. Tab 3: Trace (grid / timeline / filters)
4. Tab 4: Analytics (charts/maps/hotspots)
5. Tab 5: Assistant (optional)

This layout aligns well with the harvested component types and keeps novice users from mixing case-level and population-level tasks in one screen.

## 6. Beginner Implementation Sequence (UI)

1. Build API service module (`marklogicService.js` pattern)
2. Add search component
3. Add case detail panel
4. Add decision message panel
5. Add trace grid
6. Add one analytics widget (table or map)
7. Add chat/assistant panel (optional)
8. Wrap high-risk areas with an error boundary

## 7. Related Articles

1. [`docs/06-persisting-output-messages-and-trace.md`](06-persisting-output-messages-and-trace.md)
2. [`docs/07-tde-design-by-objective.md`](07-tde-design-by-objective.md)
3. [`docs/08-fasttrack-initial-setup.md`](08-fasttrack-initial-setup.md)

