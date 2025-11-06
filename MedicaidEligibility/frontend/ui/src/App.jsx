import { useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import HouseholdSearch from "./components/HouseholdSearch";
import HouseholdsByState from "./components/HouseholdsByState";
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
        initSearch={true}
        disableSearchOnChange={false}
      >
        <div className="container">
          {/* View Switcher */}
          <div className="view-switcher">
            <button
              onClick={() => setView("search")}
              className={view === "search" ? "active" : ""}
            >
              Household Search
            </button>
            <button
              onClick={() => setView("map")}
              className={view === "map" ? "active" : ""}
            >
              Eligibility by State
            </button>
            <button
              onClick={() => setView("chat")}
              className={view === "chat" ? "active" : ""}
            >
              Chatbot
            </button>
          </div>

          {/* Main content area */}
          {view === "search" && <HouseholdSearch />}
          {view === "map" && <HouseholdsByState />}
          {view === "chat" && <Chatbot />}
        </div>
      </MarkLogicProvider>
    </ErrorBoundary>
  );
}
