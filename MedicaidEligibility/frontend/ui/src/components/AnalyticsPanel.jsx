import React, { useState } from "react";

export default function AnalyticsPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runAnalytics = async (type) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch(`http://localhost:4001/api/analytics?type=${type}`);
      const data = await resp.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white border rounded-xl shadow mb-6">
      <h2 className="text-lg font-semibold mb-3 text-gray-800">Analytics Dashboard</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => runAnalytics("totalHouseholds")}
        >
          Total Households
        </button>

        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => runAnalytics("avgIncomeByState")}
        >
          Avg Income by State
        </button>

        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => runAnalytics("fplOver200")}
        >
          Households &gt; 200% FPL
        </button>

        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => runAnalytics("top10Income")}
        >
          Top 10 by Income
        </button>
      </div>

      {loading && <div className="text-gray-500 animate-pulse">Running analytics...</div>}

      {error && <div className="text-red-600">Error: {error}</div>}

      {result && (
        <div className="overflow-x-auto mt-3">
          <pre className="bg-gray-50 p-3 text-sm rounded max-h-96 overflow-y-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
