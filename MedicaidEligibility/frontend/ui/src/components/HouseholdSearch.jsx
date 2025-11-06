import { useState } from "react";
import { useMarkLogicContext } from "ml-fasttrack";
import HouseholdCard from "./HouseholdCard";

export default function HouseholdSearch() {
  const { doSearch, setQtext, searchResponse, loading, error } = useMarkLogicContext();
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    if (!query.trim()) return;
    setQtext(query);
    doSearch();  // 👈 this is the actual trigger
  };

  return (
    <div className="search-container">
      <div className="search-controls">
        <input
          type="text"
          placeholder="Search by family name, state, or ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: "red" }}>{error.message}</div>}

      <div className="results-grid">
        {searchResponse?.results?.length ? (
          searchResponse.results.map((r, idx) => (
            <HouseholdCard key={idx} row={r.extracted?.content?.[0]?.payload} />
          ))
        ) : (
          <p>No results</p>
        )}
      </div>
    </div>
  );
}
