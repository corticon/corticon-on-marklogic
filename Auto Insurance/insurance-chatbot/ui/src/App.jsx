// src/App.jsx
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import PolicySearch from "./components/PolicySearch";
import { getAnalytics, getPolicy } from "./api/marklogicService";
import { formatCurrency, formatWholeNumber, getPolicyPayload } from "./utils/policyUtils";
import "./App.css";

const PolicyDetails = lazy(() => import("./components/PolicyDetails"));
const PoliciesByState = lazy(() => import("./components/PoliciesByState"));
const Chatbot = lazy(() => import("./components/Chatbot"));

const views = [
  {
    id: "workspace",
    label: "Underwriting Desk",
    caption: "Search, triage, and explain a single policy"
  },
  {
    id: "portfolio",
    label: "Portfolio Intelligence",
    caption: "Track trends across the entire decision ledger"
  },
  {
    id: "concierge",
    label: "Policy Concierge",
    caption: "Ask questions in plain language"
  }
];

export default function App() {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("workspace");
  const [portfolioSnapshot, setPortfolioSnapshot] = useState(null);

  useEffect(() => {
    async function fetchPortfolioSnapshot() {
      try {
        const snapshot = await getAnalytics();
        setPortfolioSnapshot(snapshot);
      } catch (snapshotError) {
        console.warn("Failed to fetch portfolio snapshot", snapshotError);
      }
    }

    fetchPortfolioSnapshot();
  }, []);

  const selectedPolicy = useMemo(() => getPolicyPayload(policy), [policy]);
  const viewFallback = <div className="widget-panel placeholder-panel">Loading view…</div>;
  const policyFallback = <div className="widget-panel placeholder-panel">Loading policy workspace…</div>;

  async function fetchPolicy(policySelection) {
    setLoading(true);
    setError("");
    try {
      const payload = typeof policySelection === "string"
        ? await getPolicy(policySelection)
        : policySelection;
      setPolicy(payload);
      setView("workspace");
    } catch (e) {
      setPolicy(null);
      setError(e.message || "Failed to fetch policy");
    } finally {
      setLoading(false);
    }
  }
  return (
    <ErrorBoundary>
      <div className="app-shell">
        <header className="masthead">
          <div className="masthead-copy">
            <span className="eyebrow">Auto insurance control room</span>
            <h1>Modernized FastTrack workspace for policy review, explainability, and portfolio analysis.</h1>
            <p>
              The portal now behaves like an underwriting desk instead of a demo stub: search faster, inspect richer decision context, and move from a single policy to portfolio-wide patterns without leaving the workspace.
            </p>
          </div>

          <div className="masthead-summary">
            <div className="summary-chip">
              <span>Policies indexed</span>
              <strong>{formatWholeNumber(portfolioSnapshot?.summary?.policyCount)}</strong>
            </div>
            <div className="summary-chip">
              <span>Average premium</span>
              <strong>{formatCurrency(portfolioSnapshot?.summary?.avgNetPremium)}</strong>
            </div>
            <div className="summary-chip">
              <span>Selected policy</span>
              <strong>{selectedPolicy?.applicationId || "None selected"}</strong>
            </div>
          </div>
        </header>

        <nav className="view-nav" aria-label="Portal sections">
          {views.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "view-tab active" : "view-tab"}
              onClick={() => setView(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.caption}</span>
            </button>
          ))}
        </nav>

        {view === "workspace" ? (
          <div className="workspace-layout">
            <aside className="workspace-sidebar">
              <section className="widget-panel">
                <div className="widget-heading">
                  <div>
                    <h2>Policy finder</h2>
                    <p>Search by application ID, family name, state, or driver name.</p>
                  </div>
                </div>
                <PolicySearch onSearch={fetchPolicy} selectedPolicyId={selectedPolicy?.applicationId} />
              </section>

              <section className="widget-panel snapshot-panel">
                <div className="widget-heading compact">
                  <div>
                    <h3>Book snapshot</h3>
                    <p>Keep portfolio context visible while drilling into one policy.</p>
                  </div>
                </div>

                <div className="mini-metric-list">
                  <div>
                    <span>High-theft vehicles</span>
                    <strong>{formatWholeNumber(portfolioSnapshot?.summary?.highTheftVehicles)}</strong>
                  </div>
                  <div>
                    <span>Paperless policies</span>
                    <strong>{formatWholeNumber(portfolioSnapshot?.summary?.paperlessPolicies)}</strong>
                  </div>
                  <div>
                    <span>Multi-car policies</span>
                    <strong>{formatWholeNumber(portfolioSnapshot?.summary?.multiCarPolicies)}</strong>
                  </div>
                </div>

                <div className="snapshot-footnote">
                  {portfolioSnapshot?.rulesheetActivity?.[0]?.value
                    ? `Most active rulesheet: ${portfolioSnapshot.rulesheetActivity[0].value}`
                    : "Rulesheet activity will appear once analytics loads."}
                </div>
              </section>
            </aside>

            <main className="workspace-main">
              {loading ? <div className="widget-panel placeholder-panel">Loading policy workspace…</div> : null}
              {error ? <div className="widget-panel error-banner">{error}</div> : null}
              {!loading && !error && policy ? (
                <Suspense fallback={policyFallback}>
                  <PolicyDetails policy={policy} />
                </Suspense>
              ) : null}
              {!loading && !error && !policy ? (
                <section className="widget-panel workspace-empty">
                  <div className="widget-heading">
                    <div>
                      <h2>Start with a live policy or scan the portfolio first</h2>
                      <p>The new workspace keeps underwriting context, explainability, and chat all aligned around the same decision ledger.</p>
                    </div>
                  </div>

                  <div className="empty-state-grid">
                    <article>
                      <h3>Search the live decision book</h3>
                      <p>Pull a policy into the cockpit to inspect drivers, vehicles, rulesheet messages, and execution trace in one place.</p>
                    </article>
                    <article>
                      <h3>Use portfolio intelligence</h3>
                      <p>Switch to Portfolio Intelligence to see how premium, severity, and rulesheet activity are distributing across states.</p>
                    </article>
                    <article>
                      <h3>Move into guided chat</h3>
                      <p>Once a policy is selected, the concierge view gives you ready-made prompts for premium and discount explanations.</p>
                    </article>
                  </div>

                  <div className="stat-grid stat-grid--workspace">
                    <div className="stat-card accent-gold">
                      <span className="stat-label">Average premium</span>
                      <strong>{formatCurrency(portfolioSnapshot?.summary?.avgNetPremium)}</strong>
                    </div>
                    <div className="stat-card accent-blue">
                      <span className="stat-label">Top state by count</span>
                      <strong>{portfolioSnapshot?.stateBreakdown?.[0]?.state || "Loading"}</strong>
                    </div>
                    <div className="stat-card accent-green">
                      <span className="stat-label">Top discount</span>
                      <strong>{portfolioSnapshot?.topDiscounts?.[0]?.value || "Loading"}</strong>
                    </div>
                  </div>
                </section>
              ) : null}
            </main>
          </div>
        ) : null}

        {view === "portfolio" ? (
          <Suspense fallback={viewFallback}>
            <PoliciesByState />
          </Suspense>
        ) : null}
        {view === "concierge" ? (
          <Suspense fallback={viewFallback}>
            <Chatbot policy={policy} />
          </Suspense>
        ) : null}
      </div>
    </ErrorBoundary>
  );
}