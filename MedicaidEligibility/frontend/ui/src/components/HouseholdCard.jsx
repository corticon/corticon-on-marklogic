import { useState } from "react";
import ExecutionTrace from "./ExecutionTrace";
import DecisionLog from "./DecisionLog";

export default function HouseholdCard({ row }) {
  if (!row || typeof row !== "object") return null;
  const [expanded, setExpanded] = useState(false);
  const [targetSequence, setTargetSequence] = useState(null);

  // Helper: friendly rulesheet name
  const getRulesheetNameFromPath = (fullPath) => {
    if (typeof fullPath !== 'string') return '';
    const parts = fullPath.split('/');
    const filenameWithExt = parts[parts.length - 1] || '';
    return filenameWithExt.split('.')[0] || filenameWithExt;
  };

  // Helper: find the latest sequence where an attribute was set
  const findTraceRef = (attrNames = []) => {
    try {
      const changes = row?.metrics?.attributeChanges || [];
      const matches = changes.filter((c) => attrNames.map(a => String(a).toLowerCase()).includes(String(c?.attributeName || '').toLowerCase()));
      if (!matches.length) return null;
      const last = matches.sort((a,b) => (a?.sequence || 0) - (b?.sequence || 0)).pop();
      return last ? {
        sequence: last.sequence,
        rulesheet: getRulesheetNameFromPath(last.rulesheetName),
        ruleNumber: last.ruleNumber
      } : null;
    } catch {
      return null;
    }
  };

  const familyName = row.familyName ?? "Unknown Family";
  const state = row.stateOfResidence ?? "—";
  const size = row.familySize ?? "—";
  const income =
    typeof row.annualIncome === "number"
      ? `$${row.annualIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      : "N/A";
  const percentFPL =
    row.householdPercentFPL != null && !Number.isNaN(Number(row.householdPercentFPL))
      ? Number(row.householdPercentFPL)
      : null;
  const fplLabel = percentFPL ? `${percentFPL.toFixed(1)}%` : "N/A";
  const members = row.members || "—";
  const primary = row.primaryAssistance || "—";
  const notes = Array.isArray(row.eligibilityNotes) ? row.eligibilityNotes : [];
  const hasMessages = Array.isArray(row.decisionLogMessages) && row.decisionLogMessages.length > 0;
  const hasTraceOrMessages = !!row.metrics || hasMessages;

  const refState = findTraceRef(["stateOfResidence"]);
  const refSize = findTraceRef(["familySize"]);
  const refIncome = findTraceRef(["annualIncome"]);
  const refFpl = findTraceRef(["householdPercentFPL"]);

  // When clicking a trace link, expand the section and scroll to the sequence
  const jumpToTrace = (sequence) => {
    if (!sequence) return;
    setExpanded(true);
    setTargetSequence(sequence);
  };

  // Badge logic
  let badgeColor = "bg-gray-400";
  let badgeLabel = "Unknown";

  if (percentFPL != null) {
    if (percentFPL <= 100) {
      badgeColor = "bg-green-500";
      badgeLabel = "Eligible";
    } else if (percentFPL <= 200) {
      badgeColor = "bg-yellow-400";
      badgeLabel = "Borderline";
    } else {
      badgeColor = "bg-red-500";
      badgeLabel = "Over Income";
    }
  }

  return (
    <div className="rounded-2xl shadow-md bg-white border border-gray-200 overflow-hidden mb-8 transition-all duration-200 hover:shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-500 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            🏠 {familyName} Family
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
              #{row.householdId}
            </span>
          </h3>
          <p className="text-sm opacity-90 mt-1">
            Primary Assistance:{" "}
            <span className="font-medium">{primary}</span>
          </p>
        </div>
        <button
          className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide Details" : "View Details"}
        </button>
      </div>

      {/* Summary Grid (spaced and annotated) */}
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-7 text-gray-700 text-sm">
        <div>
          <span className="block text-gray-500">State <span className="text-gray-400 cursor-help" title="Declared state of residence for this household.">ⓘ</span></span>
          <div className="font-semibold">{state}</div>
          <p className="text-xs text-gray-500 mt-1">Declared state of residence for this household.
            {refState && (
              <>
                {" "}Set by {refState.rulesheet} R{refState.ruleNumber} (seq {refState.sequence}).
                {" "}<a className="text-blue-600 hover:underline" href={`#trace-seq-${refState.sequence}`} onClick={(e)=>{e.preventDefault(); jumpToTrace(refState.sequence);}}>View in trace</a>
              </>
            )}
          </p>
        </div>
        <div>
          <span className="block text-gray-500">Family Size <span className="text-gray-400 cursor-help" title="Number of people used to compute eligibility and FPL.">ⓘ</span></span>
          <div className="font-semibold">{size}</div>
          <p className="text-xs text-gray-500 mt-1">Number of people in this household used for eligibility and FPL determination.
            {refSize && (
              <>
                {" "}Set by {refSize.rulesheet} R{refSize.ruleNumber} (seq {refSize.sequence}).
                {" "}<a className="text-blue-600 hover:underline" href={`#trace-seq-${refSize.sequence}`} onClick={(e)=>{e.preventDefault(); jumpToTrace(refSize.sequence);}}>View in trace</a>
              </>
            )}
          </p>
        </div>
        <div>
          <span className="block text-gray-500">Annual Income <span className="text-gray-400 cursor-help" title="Net household income considered by financial eligibility rules.">ⓘ</span></span>
          <div className="font-semibold text-green-600">{income}</div>
          <p className="text-xs text-gray-500 mt-1">Net household income considered by financial eligibility rules.
            {refIncome && (
              <>
                {" "}Set by {refIncome.rulesheet} R{refIncome.ruleNumber} (seq {refIncome.sequence}).
                {" "}<a className="text-blue-600 hover:underline" href={`#trace-seq-${refIncome.sequence}`} onClick={(e)=>{e.preventDefault(); jumpToTrace(refIncome.sequence);}}>View in trace</a>
              </>
            )}
          </p>
        </div>
        <div>
          <span className="block text-gray-500">% of FPL <span className="text-gray-400 cursor-help" title="Derived ratio of household income to the Federal Poverty Level.">ⓘ</span></span>
          <div className="font-semibold flex items-center gap-2">
            {fplLabel}
            <span className={`text-xs text-white px-2 py-0.5 rounded-full ${badgeColor}`}>
              {badgeLabel}
            </span>
          </div>

          {/* FPL Progress Bar */}
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${badgeColor}`}
              style={{ width: `${Math.min(percentFPL || 0, 300)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Derived ratio of household income to the Federal Poverty Level.
            {refFpl && (
              <>
                {" "}Set by {refFpl.rulesheet} R{refFpl.ruleNumber} (seq {refFpl.sequence}).
                {" "}<a className="text-blue-600 hover:underline" href={`#trace-seq-${refFpl.sequence}`} onClick={(e)=>{e.preventDefault(); jumpToTrace(refFpl.sequence);}}>View in trace</a>
              </>
            )}
          </p>
        </div>

        <div className="col-span-2 md:col-span-4">
          <span className="block text-gray-500">Members <span className="text-gray-400 cursor-help" title="Individuals included in the household.">ⓘ</span></span>
          <div className="font-semibold text-gray-800 bg-gray-50 rounded-md p-3 mt-1">
            {members}
          </div>
          <p className="text-xs text-gray-500 mt-1">Individuals included in the household.</p>
        </div>
      </div>

      {/* Eligibility Section */}
      {expanded && (
        <div className="bg-gray-50 border-t border-gray-200 p-6 transition-all duration-300 ease-in-out">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            🧾 Eligibility Notes
          </h4>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 max-h-48 overflow-y-auto bg-white rounded-lg shadow-inner p-3">
            {notes.map((note, i) => (
              <li key={i} className="hover:bg-blue-50 rounded px-1 transition-colors">
                {note}
              </li>
            ))}
          </ul>
        </div>

        
      )}{/* Rule Execution Section */}{expanded && hasTraceOrMessages && (
        <div className="mt-6 bg-gray-50 border-t pt-4 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            ⚙️ Rule Execution Trace
          </h4>
          <div className="bg-white rounded-lg shadow-inner p-4 space-y-4">
            <ExecutionTrace metrics={row.metrics} targetSequence={targetSequence} />
            {hasMessages && (
              <DecisionLog messages={row.decisionLogMessages} />
            )}
          </div>
          </div>
      )}
    </div>
  );
}
