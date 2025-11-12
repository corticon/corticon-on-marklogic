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

### 2. Configure the Backend Proxy

This React application communicates with the MarkLogic backend via a lightweight Node.js proxy to avoid CORS issues during development.

1.  Open the `vite.config.js` file in this directory.
2.  Locate the `proxy` configuration section.
3.  Update the `target` property to point to the host and port of your MarkLogic REST API server (by default, this is `http://localhost:8004`).

```javascript
// vite.config.js
export default defineConfig({
  // ...
  server: {
    proxy: {
      '/v1': {
        target: 'http://localhost:8004', // <-- Make sure this matches your MarkLogic REST port
        changeOrigin: true,
      },
    },
  },
});
```

### 3. Start the Development Server

Run the following command to start the Vite development server:

```bash
npm run dev
```

This will launch the application in your web browser, typically at `http://localhost:5173`.

### 4. Explore the Dashboard

Once the application is running, you can use the search bar to find and explore the policies that have been processed by the MarkLogic backend. You can then navigate through the different tabs to see the policy details, the decision log, and the execution trace.
