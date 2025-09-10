// ui/src/App.jsx
import { useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import PolicySearch from "./components/PolicySearch";
import PolicyDetails from "./components/PolicyDetails";
import { getPolicy } from "./api/marklogicService";
import "./App.css";

export default function App() {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchPolicy(id) {
    setLoading(true);
    setError("");
    try {
      const payload = await getPolicy(id);
      console.log("getDocument payload", payload);
      setPolicy(payload);
    } catch (e) {
      setPolicy(null);
      setError(e.message || "Failed to fetch policy");
    } finally {
      setLoading(false);
    }
  }
  return (
    <ErrorBoundary>
      <div className="container">
        <div className="search-controls">
          <h2 className="font-bold mb-2">Policy Search</h2>
          <PolicySearch onSearch={fetchPolicy} />
        </div>
        <div className="results">
          {loading && <div className="text-gray-500">Loading…</div>}
          {error && <div className="text-red-600">{error}</div>}
          {policy ? (
            <PolicyDetails policy={policy} />
          ) : (
            <div className="placeholder">Search for a policy to see the details.</div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
