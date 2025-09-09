// ui/src/components/PolicySearch.jsx
import { useState } from 'react';
import { getPolicy, searchPolicies } from '../api/marklogicService';

export default function PolicySearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    try {
      setError(null);
      const data = await searchPolicies(query); // pass query string
      setResults(data.results || []); // ensure fallback
    } catch (err) {
      console.error("Search failed:", err);
      setError(err.message || "Search failed");
      setResults([]);
    }
  };

  const handleSelect = async (applicationId) => {
    try {
      setError(null);
      const policy = await getPolicy(applicationId);
      setSelectedPolicy(policy);
    } catch (err) {
      console.error("Failed to fetch policy:", err);
      setError(err.message || "Failed to fetch policy");
      setSelectedPolicy(null);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or ID"
      />
      <button onClick={handleSearch}>Search</button>

      {error && <div style={{ color: 'red' }}>{error}</div>}

<ul>
  {results.map((r, docIndex) => 
    r.payload.map((p, payloadIndex) => {
      const applicationId = p.applicationId;
      const familyName = p.familyName || "Unknown";
      const key = `${r.inputPayloadUri}-${payloadIndex}`; // unique key for React
      return (
        <li key={key}>
          {familyName} — {applicationId}
          <button onClick={() => handleSelect(applicationId)}>View</button>
        </li>
      );
    })
  )}
</ul>


      {selectedPolicy && (
        <pre style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(selectedPolicy, null, 2)}
        </pre>
      )}
    </div>
  );
}
