import { useState, useMemo, useEffect } from "react";
import { useMarkLogicContext } from "ml-fasttrack";
import HouseholdCard from "./HouseholdCard";

export default function HouseholdSearch() {
  const context = useMarkLogicContext();
  const { setQtext, searchResponse, loading, error } = context;
  const [query, setQuery] = useState("");

  // Lightweight debug logging to help isolate 500s
  useEffect(() => {
    const count = searchResponse?.results?.length ?? 0;
    if (loading) {
      console.log("[UI] Search loading… qtext:", query);
    } else {
      console.log("[UI] Search finished. results=", count);
    }
    if (count > 0) {
      // Log a tiny preview of the first hit for shape validation
      try {
        const first = searchResponse.results[0];
        console.debug("[UI] First result keys:", Object.keys(first || {}));
      } catch {}
    }
  }, [loading, searchResponse]);

  useEffect(() => {
    if (error) {
      console.error("[UI] Search error:", error);
    }
  }, [error]);

  const handleSearch = () => {
    if (!query.trim()) return;
    console.log("Searching for:", query);
    setQtext(query.trim());
  };

  const items = useMemo(() => {
    const results = searchResponse?.results || [];
    return results
      .map((r) => {
        // Prefer extracted nodes; fall back to full content
        const extracted = r?.extracted?.content?.[0] || null;
        const full = Array.isArray(r?.content) ? r?.content?.[0] : r?.content;
        const doc = extracted || full || {};
        const p = doc?.payload;
        if (!p) return null;

        const members = p.individual
          ?.map((i) => `${i.first} ${i.last}`)
          .filter(Boolean)
          .join(", ");

        const primary = p.individual?.[0]?.classOfAssistance?.[0]?.name || "";
        const notes = p.individual?.[0]?.eligibilityNote?.map((n) => n.text) || [];
        // Extract Corticon execution metadata (support both shapes and fall back to full doc)
        const corticonNode = doc?.corticon || p?.corticon || {};
        const metrics =
          corticonNode?.execution?.Metrics || // some docs
          corticonNode?.Metrics || // others (common in your data)
          null;
        const rawMessages =
          (corticonNode?.execution?.messages?.message || corticonNode?.messages?.message || []);
        const decisionLogMessages = Array.isArray(rawMessages)
          ? rawMessages.map((m) => ({
              severity: m?.severity ?? "Info",
              rule: m?.ruleNumber ?? m?.rule ?? "",
              ruleSheet: m?.rulesheetName ?? m?.ruleSheet ?? "",
              text: m?.text ?? "",
            }))
          : [];

return {
  familyName: p.familyName,
  householdId: p.householdId,
  stateOfResidence: p.stateOfResidence,
  familySize: p.familySize,
  annualIncome: p.annualIncome,
  householdPercentFPL: p.householdPercentFPL,
  members,
  primaryAssistance: primary,
  eligibilityNotes: notes,
  metrics,
  decisionLogMessages,
};

      })
      .filter(Boolean);
  }, [searchResponse]);

  return (
    <div className="search-container p-6">
      <div className="flex gap-2 mb-4">
        <input
          className="border rounded p-2 flex-grow"
          type="text"
          placeholder="Search by family name, state, or ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button
          onClick={handleSearch}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Search
        </button>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: "red" }}>{String(error?.message || error)}</div>}

      {items.length > 0 && (
        <h2 className="text-lg font-semibold mb-3">
          {items.length} Household{items.length !== 1 && "s"} Found
        </h2>
      )}

      <div>
        {searchResponse?.results == null ? (
          <div className="text-gray-600 text-center mt-10">
            <h2 className="text-xl font-semibold mb-2">
              Welcome to the Medicaid Eligibility Dashboard
            </h2>
            <p className="text-gray-500">
              Use the search bar above to find households by family name, state, or ID.
            </p>
          </div>
        ) : items.length === 0 ? (
          <p className="text-gray-500 mt-6 text-center">No matching results found.</p>
        ) : (
          items.map((row, i) => <HouseholdCard key={i} row={row} />)
        )}
      </div>
    </div>
  );
}
