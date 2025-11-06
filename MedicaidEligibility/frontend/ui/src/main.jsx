import React from "react";
import ReactDOM from "react-dom/client";
import Dashboard from "./components/Dashboard";
import "./App.css";

/**
 * Entry point for the Medicaid Eligibility demo app
 * -------------------------------------------------
 * Renders the full Dashboard with search, map, and chatbot.
 */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>
);
