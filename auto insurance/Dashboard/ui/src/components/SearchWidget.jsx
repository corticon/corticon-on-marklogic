import { useState } from "react";
import PolicyDetails from "./PolicyDetails";
import { searchByApplicationId } from "../api/marklogicService";

export default function SearchWidget() {
  const [applicationId, setApplicationId] = useState("");
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = async () => {
    if (!applicationId.trim()) {
      setError("Please enter an Application ID.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await searchByApplicationId(applicationId);
      if (data?.results?.length > 0) {
        setPolicy(data.results[0]);
      } else {
        setPolicy(null);
        setError("Policy not found.");
      }
    } catch (e) {
      setError(e.message || "Search failed");
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  };

  // Allow search on Enter key press
  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      runSearch();
    }
  };

  return (
    <div className="p-6">
      <div className="space-y-6">
        <h2 className="font-bold mb-2">Policy Search</h2>
        <div className="flex gap-2">
          <input
            type="text"
            className="border rounded px-2 py-1 flex-1"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            onKeyPress={handleKeyPress} // Added for Enter key search
            placeholder="Enter Application ID..."
            disabled={loading} // Disable input while loading
          />
          <button
            onClick={runSearch}
            className="bg-blue-500 text-white px-4 py-1 rounded disabled:bg-gray-400"
            disabled={loading} // Disable button while loading
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      <div className="mt-6">
        {loading && <p className="text-gray-500">Loading…</p>}
        {error && <p className="text-red-600">Error: {error}</p>}
        {policy && <PolicyDetails policyUri={policy.uri} />}
      </div>
    </div>
  );
}