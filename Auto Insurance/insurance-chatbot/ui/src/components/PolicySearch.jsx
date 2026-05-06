// src/components/PolicySearch.jsx
import { useState, useEffect, useRef } from 'react';
import PolicyCard from './PolicyCard';
import { searchPoliciesByQtext, searchPolicies, searchDocuments } from '../api/marklogicService';

export default function PolicySearch({ onSelect, query, onQueryChange }) {
  // Use internal state if props are not provided (backwards compatibility)
  const [internalQuery, setInternalQuery] = useState('');
  const activeQuery = query !== undefined ? query : internalQuery;
  const setActiveQuery = onQueryChange || setInternalQuery;

  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const wrapperRef = useRef(null);

  // Close results when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleSearch = async () => {
    if (!activeQuery.trim()) {
        setResults([]);
        setShowResults(false);
        return;
    }
    
    // Prevent duplicate searches
    if (isSearching) {
      return;
    }
    
    try {
      setIsSearching(true);
      setError(null);
      
      let searchResults = [];
      
      // Determine search type and use appropriate method
      if (activeQuery.includes('*') || activeQuery.includes('?')) {
        // Wildcard search - try searchPoliciesByQtext first, fallback to searchPolicies
        const data = await searchPoliciesByQtext(activeQuery);
        searchResults = data.results || data.result || [];
        
        // If no results from wildcard search, try getting all policies as fallback
        if (searchResults.length === 0) {
          try {
            const allData = await searchPolicies('');
            searchResults = allData.results || [];
            
            // If this is a specific wildcard pattern (not just "*"), filter the results
            if (activeQuery !== '*') {
              const pattern = activeQuery.replace(/\*/g, '.*').replace(/\?/g, '.');
              const regex = new RegExp(pattern, 'i');
              searchResults = searchResults.filter(policy => {
                const policyData = policy.payload && policy.payload[0] ? policy.payload[0] : {};
                const searchText = `${policyData.applicationId || ''} ${policyData.familyName || ''} ${policyData.state || ''}`.toLowerCase();
                return regex.test(searchText);
              });
            }
            
            // Sort wildcard search results by family name
            searchResults.sort((a, b) => {
              const familyA = (a.payload && a.payload[0] && a.payload[0].familyName) || '';
              const familyB = (b.payload && b.payload[0] && b.payload[0].familyName) || '';
              return familyA.localeCompare(familyB, undefined, { ignoreCase: true });
            });
            
          } catch (fallbackErr) {
            searchResults = [];
          }
        }
        
        setShowResults(true); // Always show dropdown for wildcard searches
      } else if (activeQuery.includes(':')) {
        // Field-specific search (e.g., "state:Virginia" or "family:Smith")
        const [field, value] = activeQuery.split(':', 2).map(s => s.trim());
        const query = {
          query: {
            queries: [{
              "value-query": {
                "json-property": field,
                "text": [value]
              }
            }]
          }
        };
        const data = await searchDocuments(query, { pageLength: 50 });
        searchResults = data.results || data.result || [];
        setShowResults(true); // Show dropdown for field searches
      } else if (activeQuery.length >= 3) {
        // Regular text search - use searchPoliciesByQtext
        const data = await searchPoliciesByQtext(activeQuery);
        searchResults = data.results || [];
        
        // Auto-select first result for text searches (unless multiple results)
        if (searchResults.length === 1) {
          const firstPolicy = searchResults[0] && searchResults[0].payload && searchResults[0].payload[0] ? searchResults[0].payload[0] : null;
          if (firstPolicy && firstPolicy.applicationId) {
            onSelect(firstPolicy.applicationId);
            return;
          } else {
            setShowResults(true); // Show dropdown even if invalid structure
          }
        } else if (searchResults.length > 1) {
          setShowResults(true); // Show dropdown if multiple results
        }
      } else {
        // Too short for meaningful search
        setError("Enter at least 3 characters for search");
        setShowResults(true);
        setTimeout(() => setShowResults(false), 2000);
        return;
      }
      
      setResults(searchResults);
      
      // Handle no results
      if (searchResults.length === 0) {
        setShowResults(true);
        setTimeout(() => setShowResults(false), 2000);
      }
      
    } catch (err) {
      console.error("Search failed:", err);
      setError(err.message || "Search failed");
      setResults([]);
      setShowResults(true); // Show error in dropdown
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectPolicy = (id) => {
    onSelect(id);
    setShowResults(false);
    // Optionally clear query or keep it? User asked to retain search value.
    // setActiveQuery(''); 
  };

  return (
    <div className="policy-search-container" ref={wrapperRef} style={{ position: 'relative' }}>
      <div className="search-box header-search">
        <input
          type="text"
          value={activeQuery}
          onChange={(e) => setActiveQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search: policy ID, text, state:VA, family:Smith, or * for wildcard"
          className="search-input"
        />
        <button onClick={handleSearch} className="btn-search">🔍</button>
      </div>

      {showResults && (
        <div className="search-results-dropdown">
          {error && <div className="p-2 text-red-500 text-sm">{error}</div>}
          
          {results.length === 0 && !error && (
            <div className="p-2 text-gray-500 text-sm">No policies found.</div>
          )}

          {results.map((r, index) => {
            // Safely extract policy data with error handling
            const policyData = r && r.payload && r.payload[0] ? r.payload[0] : null;
            if (!policyData) {
              console.warn('Invalid policy data structure:', r);
              return null;
            }
            return (
              <div 
                key={policyData.applicationId || index}
                className="search-result-item"
                onClick={() => handleSelectPolicy(policyData.applicationId)}
              >
                <div className="font-bold">{policyData.familyName || 'Untitled'}</div>
                <div className="text-xs text-gray-600">ID: {policyData.applicationId}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}