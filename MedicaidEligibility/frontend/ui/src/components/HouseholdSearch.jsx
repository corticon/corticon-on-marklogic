import { useState, useMemo } from "react";
import { useMarkLogicContext } from "ml-fasttrack";
import HouseholdCard from "./HouseholdCard";

export default function HouseholdSearch() {
  const context = useMarkLogicContext();
  const { setQtext, searchResponse, loading, error } = context;
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    if (!query.trim()) return;
    console.log("Searching for:", query);
    setQtext(query.trim());
  };

  const items = useMemo(() => {
    const results = searchResponse?.results || [];
    return results
      .map((r) => {
        const p = r?.extracted?.content?.[0]?.payload;
        if (!p) return null;

        const members = p.individual
          ?.map((i) => `${i.first} ${i.last}`)
          .filter(Boolean)
          .join(", ");

        const primary = p.individual?.[0]?.classOfAssistance?.[0]?.name || "";
        const notes = p.individual?.[0]?.eligibilityNote?.map((n) => n.text) || [];

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

      {/* 👇 Updated display logic for welcome, empty, and results */}
      <div>
        {searchResponse?.results == null ? (
          // 👇 Show this before any search has happened
          <div className="text-gray-600 text-center mt-10">
            <h2 className="text-xl font-semibold mb-2">
              Welcome to the Medicaid Eligibility Dashboard
            </h2>
            <p className="text-gray-500">
              Use the search bar above to find households by family name, state, or ID.
            </p>
          </div>
        ) : items.length === 0 ? (
          // 👇 Show when a search returned nothing
          <p className="text-gray-500 mt-6 text-center">
            No matching results found.
          </p>
        ) : (
          // 👇 Show when there are results
          items.map((row, i) => <HouseholdCard key={i} row={row} />)
        )}
      </div>
    </div>
  );
}
