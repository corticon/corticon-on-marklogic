# Auto Insurance Explainability Dashboard

This project is a React-based frontend that provides an interactive dashboard for exploring the results of the automated insurance underwriting process. It is designed to provide a clear, transparent, and user-friendly view into the decisions made by the Corticon.js rules engine.

---

## Business Value: The Importance of Explainability

Automating decisions is only half the battle. For a business to trust and adopt an automated system, it must be able to understand *why* a decision was made. This is especially critical in regulated industries like insurance, where companies must be able to justify their pricing and eligibility decisions to customers and regulators.

This dashboard provides that explainability by giving users different lenses through which to view the decision output:

*   **For the Business User:** A clean, high-level summary of the policy and a human-readable log of the decision steps.
*   **For the Customer Service Rep:** A clear, step-by-step explanation of how a premium was calculated, enabling them to answer customer questions quickly and accurately.
*   **For the Auditor or Developer:** A granular, low-level trace of the entire rule execution, providing a complete and unbreakable audit trail.

---

## Prerequisites

*   **Node.js** (LTS version recommended)
*   The **MarkLogic backend** for the Auto Insurance demo must be deployed and running.

---

## How to Run the Frontend

### 1. Install Dependencies

Navigate to this directory in your terminal and run the following command to install the necessary packages:

```bash
npm install
```

The UI now expects the FastTrack 2.x archive `ml-fasttrack-2.0.0-20250701b.tgz` to exist in this folder.

### 2. Configure Connection to the Middle Tier

This UI talks to the Node middle‑tier (not directly to MarkLogic) using environment variables.

1. Ensure the middle‑tier is running (see `Auto Insurance/insurance-chatbot/README.md`). Default port is `4004`.
2. Copy `.env.example` to `.env` and adjust as needed:

```ini
VITE_PROXY_BASE_URL=http://localhost:4004
VITE_FT_OPTIONS=corticonml-options
VITE_FT_DEBUG=false
```

### 3. Start the Development Server

Run the following command to start the Vite development server:

```bash
npm run dev
```

This will launch the application in your web browser, typically at `http://localhost:5173`.

### 4. Explore the Dashboard

Once the application is running, you can use the search bar to find and explore the policies that have been processed by the MarkLogic backend. The geography tab now uses the dedicated MarkLogic analytics resource instead of pulling every policy document into the browser.

---

## Before You Start

- Backend is deployed and has at least one enriched policy under `/data/policy/`.
- Middle‑tier server is running on `http://localhost:4004` (or set `VITE_ML_PORT`).
- Node.js (LTS) is installed and `npm install` completes without errors.

---

## Notable Files

- `src/api/marklogicService.js` — Uses `VITE_ML_HOST`/`VITE_ML_PORT` to call the middle‑tier (`/v1` proxy, custom resources, chat).
- `src/components/DecisionLog.jsx` — Human-readable decision messages from Corticon output.
- `src/components/ExecutionTrace.jsx` — Detailed rule execution trace visualization.
- `src/components/PolicyDetails.jsx` — Summarized, enriched policy view.
- `src/App.jsx` — Top-level layout and routing.

---

## Template Reference

For a generic UI/bootstrap baseline, see:

1. <https://github.com/corticon/explainable-decision-ledger/blob/main/docs/README.md>
2. <https://github.com/corticon/explainable-decision-ledger/blob/main/ui-fasttrack/README.md>


