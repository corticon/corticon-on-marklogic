// src/App.jsx
import { useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import PolicySearch from "./components/PolicySearch";
import PolicyDetails from "./components/PolicyDetails";
import PoliciesByState from "./components/PoliciesByState";
import Chatbot from "./components/Chatbot";
import { UI_VERSION } from "./version";
// ...
// No changes needed for Chatbot props as it is a custom component.

import { getPolicy } from "./api/marklogicService";
import "./App.css";

export default function App() {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState('details'); // Default to details view
  
  // Persist search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // Theme state
  const [theme, setTheme] = useState('light');

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  async function fetchPolicy(id) {
    setLoading(true);
    setError("");
    // Ensure we switch to details view when a policy is selected
    setView('details');
    try {
      const payload = await getPolicy(id);
      setPolicy(payload);
    } catch (e) {
      setPolicy(null);
      setError(e.message || "Failed to fetch policy");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ErrorBoundary>
      <div className="app-layout" data-theme={theme}>
        <header className="navbar">
          <div className="navbar-brand">Insurance Assistant</div>
          
          {/* Search Bar in Header */}
          <div className="navbar-search">
            <PolicySearch 
                query={searchQuery} 
                onQueryChange={setSearchQuery} 
                onSelect={fetchPolicy} 
            />
          </div>

          <nav className="navbar-links">
            <button 
              onClick={() => setView('details')} 
              className={view === 'details' ? 'active' : ''}
            >
              Policy Details
            </button>
            <button 
              onClick={() => setView('map')} 
              className={view === 'map' ? 'active' : ''}
            >
              Policies by State
            </button>
            <button 
              onClick={() => setView('chat')} 
              className={view === 'chat' ? 'active' : ''}
            >
              Chatbot
            </button>
            <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme">
                {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <span className="version-display">v{UI_VERSION}</span>
          </nav>
        </header>

        <main className="container">
          {view === 'details' && (
            <div className="details-view">
                {loading && <div className="loading-state">Loading...</div>}
                {error && <div className="error-state">{error}</div>}
                {policy ? (
                  <PolicyDetails policy={policy} theme={theme} />
                ) : (
                  <div className="placeholder">
                    <p>Use the search bar in the header to find a policy.</p>
                  </div>
                )}
            </div>
          )}

          {view === 'map' && (
            <PoliciesByState theme={theme} policy={policy} />
          )}
          
          {view === 'chat' && (
            <Chatbot policy={policy} />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}