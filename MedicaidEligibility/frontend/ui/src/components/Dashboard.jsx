import React, { useState } from "react";
import App from "../App"; // household search view
import HouseholdsByState from "./HouseholdsByState";
import ChatbotPanel from "./ChatbotPanel";
import "../App.css";

/**
 * Dashboard
 * ----------------------------------------------------
 * Main container for the Medicaid Eligibility demo UI.
 * Provides tabbed navigation between:
 *  - Search & Results
 *  - Map View
 *  - Chatbot Assistant
 */
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("search");

  const tabs = [
    { id: "search", label: "🔎 Search" },
    { id: "chat", label: "💬 Chatbot" },
  ];

  const renderContent = () => {
    switch (activeTab) {

      case "chat":
        return <ChatbotPanel />;
      default:
        return <App />;
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <h1>Georgia Medicaid Eligibility Portal</h1>
        <nav className="dashboard-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? "active" : ""}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main content area */}
      <main className="dashboard-main">{renderContent()}</main>
    </div>
  );
}
