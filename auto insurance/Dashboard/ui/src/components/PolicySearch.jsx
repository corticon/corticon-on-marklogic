// ui/src/components/PolicySearch.jsx
import { useState } from 'react';
import PolicyCard from './PolicyCard';
import { searchPolicies } from '../api/marklogicService';

export default function PolicySearch({ onSearch }) {
  const [query, setQuery] = useState('01K4AYBA809PTDRW505S07R1HW');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    try {
      setError(null);
      const data = await searchPolicies(query);
      // The API returns an object with a 'results' key
      setResults(data.results || []);
    } catch (err) { // <-- The opening curly brace was missing here
      console.error("Search failed:", err);
      setError(err.message || "Search failed");
      setResults([]);
    }
  };

  return (
    <div>
      <div className="search-box">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or ID"
        />
        <button onClick={handleSearch} className="btn-primary">Search</button>
      </div>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <div className="results-list" style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
        {results.map((r, index) => {
          // 'r' is a result object which contains a 'payload' array.
          // The actual policy data is the first item in that array.
          const policyData = r.payload[0];
          return (
            <PolicyCard
              key={policyData.applicationId || index}
              result={policyData}
              onSelect={() => onSearch(policyData.applicationId)}
            />
          );
        })}
      </div>
    </div>
  );
}