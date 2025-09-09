import { useState } from 'react';
import { getPolicy, searchPolicies } from '../api/marklogicService';
export default function PolicySearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  const handleSearch = async () => {
    const data = await searchPolicies(query);
    setResults(data.results);
  };

  const handleSelect = async (applicationId) => {
    const policy = await getPolicy(applicationId);
    setSelectedPolicy(policy);
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

      <ul>
        {results.map((r) => (
          <li key={r.payload.applicationId}>
            {r.payload.familyName} — {r.payload.applicationId}
            <button onClick={() => handleSelect(r.payload.applicationId)}>
              View
            </button>
          </li>
        ))}
      </ul>
      {selectedPolicy && (
        <pre style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(selectedPolicy, null, 2)}
        </pre>
      )}
    </div>
  );
}
