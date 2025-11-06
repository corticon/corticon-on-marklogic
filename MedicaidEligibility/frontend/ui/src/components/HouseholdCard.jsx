import { useState } from "react";

export default function HouseholdCard({ row }) {
  // Guard: if row is missing, don’t render (prevents “row is undefined”)
  if (!row || typeof row !== "object") return null;

  const [expanded, setExpanded] = useState(false);

  const familyName = row.familyName ?? "Unknown Family";
  const householdId = row.householdId;
  const state = row.stateOfResidence ?? "—";
  const size = row.familySize ?? "—";
  const income =
    typeof row.annualIncome === "number"
      ? `$${row.annualIncome.toFixed(2)}`
      : "N/A";
  const fpl =
    row.householdPercentFPL != null && !Number.isNaN(Number(row.householdPercentFPL))
      ? `${Number(row.householdPercentFPL).toFixed(2)}%`
      : "N/A";
  const members = row.members || "—";
  const primary = row.primaryAssistance || "—";
  const notes = Array.isArray(row.eligibilityNotes) ? row.eligibilityNotes : [];

  return (
    <div className="border rounded-xl shadow p-5 mb-5 bg-white hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          {familyName} Family
          {householdId != null && (
            <span className="ml-2 text-sm text-gray-500">#{householdId}</span>
          )}
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          {expanded ? "Hide Details" : "Show Details"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm text-gray-700">
        <div>
          <span className="text-gray-500">State:</span>
          <div className="font-medium">{state}</div>
        </div>
        <div>
          <span className="text-gray-500">Family Size:</span>
          <div className="font-medium">{size}</div>
        </div>
        <div>
          <span className="text-gray-500">Annual Income:</span>
          <div className="font-medium">{income}</div>
        </div>
        <div>
          <span className="text-gray-500">% of FPL:</span>
          <div className="font-medium">{fpl}</div>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">Members:</span>
          <div className="font-medium">{members}</div>
        </div>
        <div className="col-span-2 md:col-span-1">
          <span className="text-gray-500">Primary Assistance:</span>
          <div className="font-medium">{primary}</div>
        </div>
      </div>

      {expanded && notes.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <strong className="block mb-2 text-gray-800">Eligibility Notes:</strong>
          <ul className="list-disc list-inside text-sm text-gray-600 max-h-36 overflow-y-auto bg-gray-50 rounded-lg p-3 space-y-1">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
