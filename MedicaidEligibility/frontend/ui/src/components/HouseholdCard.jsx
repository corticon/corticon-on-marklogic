import React, { useState } from "react";
import "../App.css";

/**
 * HouseholdCard
 * ----------------------------------------------------
 * Displays one Medicaid household summary with
 * expandable details (eligibility notes, programs, etc.)
 */
export default function HouseholdCard({ row }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="household-card">
      {/* Header */}
      <div className="household-card-header">
        <h3>
          {row.familyName || "Unknown"} Family
          {row.householdId && (
            <span style={{ color: "#888", fontSize: "0.9rem", marginLeft: "0.4rem" }}>
              #{row.householdId}
            </span>
          )}
        </h3>
        <button onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide Details" : "Show Details"}
        </button>
      </div>

      {/* Summary Grid */}
      <div className="household-grid">
        <div>
          <span>State:</span>
          <div className="value">{row.stateOfResidence || "—"}</div>
        </div>
        <div>
          <span>Family Size:</span>
          <div className="value">{row.familySize ?? "—"}</div>
        </div>
        <div>
          <span>Annual Income:</span>
          <div className="value">
            {row.annualIncome != null ? `$${row.annualIncome.toFixed(2)}` : "N/A"}
          </div>
        </div>
        <div>
          <span>% of FPL:</span>
          <div className="value">
            {row.householdPercentFPL != null
              ? `${Number(row.householdPercentFPL).toFixed(2)}%`
              : "N/A"}
          </div>
        </div>
        <div>
          <span>Members:</span>
          <div className="value">{row.members || "—"}</div>
        </div>
        <div>
          <span>Primary Assistance:</span>
          <div className="value">{row.primaryAssistance || "—"}</div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && Array.isArray(row.eligibilityNotes) && row.eligibilityNotes.length > 0 && (
        <div className="eligibility-notes">
          <strong>Eligibility Notes:</strong>
          <ul>
            {row.eligibilityNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
