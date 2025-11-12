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

Once the application is running, it will automatically query the MarkLogic backend and display the analytics dashboard. You can then interact with the various components to explore the data.
