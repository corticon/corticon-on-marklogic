# Medicaid Eligibility Analytics Dashboard

This project is a React-based frontend that provides an interactive dashboard for visualizing and analyzing the results of the automated Medicaid eligibility decisions.

---

## Business Value: From Raw Data to Actionable Insights

While the backend system provides the automation, the true business value is realized when you can analyze the results of those decisions. This dashboard demonstrates how to build a simple but powerful analytics interface on top of the data stored in MarkLogic.

It allows users to:

*   **Visualize Key Metrics:** See a high-level overview of the applicant population, including eligibility rates and demographic breakdowns.
*   **Explore Individual Decisions:** Drill down into specific households to understand the factors that led to their eligibility determination.
*   **Identify Trends and Anomalies:** Use the data to spot trends, identify potential data quality issues, and gain a deeper understanding of the applicant pool.

---

## Prerequisites

*   **Node.js** (LTS version recommended)
*   The **MarkLogic backend** for the Medicaid Eligibility demo must be deployed and running.

---

## How to Run the Frontend

### 1. Install Dependencies

Navigate to this directory in your terminal and run the following command to install the necessary packages:

```bash
npm install
```

### 2. Configure Connection to the Middle Tier

This UI talks to a Node server in `MedicaidEligibility/frontend/server.js`, which provides `/api` analytics and can proxy `/v1` to MarkLogic.

1. Start the Node server from `MedicaidEligibility/frontend`:

```bash
node server.js
```

2. The Vite dev server already proxies `/api` and `/v1` to `http://localhost:4001` (see `vite.config.js`). If you change the Node server port, update the targets there.

### 3. Start the Development Server

Run the following command to start the Vite development server:

```bash
npm run dev
```

This will launch the application in your web browser, typically at `http://localhost:5173`.

### 4. Explore the Dashboard

Once the application is running, it will automatically query the MarkLogic backend and display the analytics dashboard. You can then interact with the various components to explore the data.

---

## Before You Start

- Backend is deployed and enriched documents exist under `/data/medicaid/`.
- Node analytics server is running at `http://localhost:4001`.
- Node.js (LTS) is installed and `npm install` completes.

---

## Notable Files

- `vite.config.js` — Dev proxy to the Node analytics server (`/api`, `/v1` → `http://localhost:4001`).
- `src/index.css`, `src/index.html`, `src/main.jsx` — App bootstrap files.
- `src/components/*` — Visualizations and analytics components.
