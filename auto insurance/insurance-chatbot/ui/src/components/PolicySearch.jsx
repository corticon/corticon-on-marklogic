// src/components/PolicySearch.jsx
import { useState } from 'react';
import PolicyCard from './PolicyCard';
import { searchPoliciesByQtext } from '../api/marklogicService';

export default function PolicySearch({ onSearch }) {
  const [query, setQuery] = useState('01K4AYBA809PTDRW505S07R1HW');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    try {
      setError(null);
      const data = await searchPoliciesByQtext(query);
      setResults(data.results || []);
    } catch (err) {
      console.error("Search failed:", err);
      setError(err.message || "Search failed");
      setResults([]);
    }
  };

  // When a policy is selected, call the main search function
  // and clear the local list of results.
  const handleSelectPolicy = (id) => {
    onSearch(id);
    setResults([]);
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

      <div className="results-list">
        {results.map((r, index) => {
          const policyData = r.payload[0];
          return (
            <PolicyCard
              key={policyData.applicationId || index}
              policyData={policyData}
              onSelect={() => handleSelectPolicy(policyData.applicationId)}
            />
          );
        })}
      </div>
    </div>
  );
}