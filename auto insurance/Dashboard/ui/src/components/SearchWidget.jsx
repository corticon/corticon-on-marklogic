import { useState } from "react";
import PolicyDetails from "./PolicyDetails";
// Import the renamed function
import { searchByApplicationId } from "../api/marklogicService";

export default function SearchWidget() {
  // Rename state variable for clarity
  const [applicationId, setApplicationId] = useState("");
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = async () => {
    if (!applicationId) {
      setError("Please enter an Application ID.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      // Call the correct function with the correct variable
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
            placeholder="Enter Application ID..."
          />
          <button onClick={runSearch} className="bg-blue-500 text-white px-4 py-1 rounded">
            Search
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