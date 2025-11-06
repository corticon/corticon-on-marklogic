import { useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import HouseholdSearch from "./components/HouseholdSearch";
import AnalyticsPanel from "./components/AnalyticsPanel";
import Chatbot from "./components/ChatbotPanel";
import { MarkLogicProvider } from "ml-fasttrack";
import "./App.css";

export default function App() {
  const [view, setView] = useState("search");

  return (
    <ErrorBoundary>
      <MarkLogicProvider
        host="localhost"
        port="4001"
        scheme="http"
        basePath=""
        options="corticonml-options"
        debug={true}
        initSearch={false}
        disableSearchOnChange={false}
      >
        <div className="container mx-auto p-4">
          {/* View Switcher */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setView("search")}
              className={`px-4 py-2 rounded ${
                view === "search" ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
            >
              Household Search
            </button>
            <button
              onClick={() => setView("analytics")}
              className={`px-4 py-2 rounded ${
                view === "analytics" ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
            >
              Analytics Dashboard
            </button>
            <button
              onClick={() => setView("chat")}
              className={`px-4 py-2 rounded ${
                view === "chat" ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
            >
              Chatbot
            </button>
          </div>

          {/* Main content area */}
          {view === "search" && <HouseholdSearch />}
          {view === "analytics" && <AnalyticsPanel />}
          {view === "chat" && <Chatbot />}
        </div>
      </MarkLogicProvider>
    </ErrorBoundary>
  );
}
