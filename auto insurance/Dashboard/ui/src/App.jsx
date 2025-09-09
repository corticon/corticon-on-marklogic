// ui/src/App.jsx
import { useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import PolicySearch from "./components/PolicySearch";
import PolicyDetails from "./components/PolicyDetails";
import { getPolicy } from "./api/marklogicService";

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
      <div className="p-6 space-y-6">
        <h2 className="font-bold mb-2">Policy Search</h2>
        <PolicySearch
          initialId="01K4AY3ZXF0YGJFFJ840DXNRB9"
          onSearch={fetchPolicy}
        />

        {loading && <div className="text-gray-500">Loading…</div>}
        {error && <div className="text-red-600">{error}</div>}

        {policy && <PolicyDetails policy={policy} />}
      </div>
    </ErrorBoundary>
  );
}
