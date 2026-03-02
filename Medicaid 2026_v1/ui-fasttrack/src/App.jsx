import { useEffect, useState } from "react";
import { Shield, Search, MessageSquare, BarChart3, Activity } from "lucide-react";
import DeterminationsView from "./views/DeterminationsView";
import AssistantView from "./views/AssistantView";
import AnalyticsView from "./views/AnalyticsView";
import { debugLog } from "./lib/api";

const TABS = [
  { id: "search", label: "Eligibility Explorer", icon: Search },
  { id: "chat", label: "Support Assistant", icon: MessageSquare },
  { id: "analytics", label: "Population Analytics", icon: BarChart3 }
];

export default function App({ proxyBaseUrl }) {
  const [activeTab, setActiveTab] = useState("search");
  const [health, setHealth] = useState({ loading: true, ok: false, project: "" });

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    debugLog("app", `Checking proxy health: ${proxyBaseUrl}/health`);
    fetch(`${proxyBaseUrl}/health`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        debugLog("app", `Proxy health OK in ${Math.round(performance.now() - started)}ms`, data);
        setHealth({
          loading: false,
          ok: Boolean(data?.ok),
          project: data?.project || ""
        });
      })
      .catch((e) => {
        if (cancelled) return;
        debugLog("app", `Proxy health failed in ${Math.round(performance.now() - started)}ms`, {
          error: e?.message || "unknown"
        });
        setHealth({ loading: false, ok: false, project: "" });
      });
    return () => {
      cancelled = true;
    };
  }, [proxyBaseUrl]);

  useEffect(() => {
    debugLog("app", `Active tab changed: ${activeTab}`);
  }, [activeTab]);

  return (
    <div className="app-shell">
      <div className="app-background" aria-hidden="true" />
      <header className="top-header">
        <div className="top-header-inner">
          <div className="brand-block">
            <div className="brand-icon">
              <Shield size={20} />
            </div>
            <div>
              <div className="brand-title">Medicaid Eligibility Portal</div>
              <div className="brand-subtitle">Explainable Decision Ledger + FastTrack</div>
            </div>
          </div>
          <div className="status-strip">
            <div className={`status-pill ${health.ok ? "ok" : "warn"}`}>
              <Activity size={14} />
              {health.loading ? "Checking proxy..." : health.ok ? "Proxy Connected" : "Proxy Offline"}
            </div>
            {health.project ? <div className="status-pill neutral">{health.project}</div> : null}
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        <div className="tab-nav-inner">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="app-main">
        {activeTab === "search" ? <DeterminationsView proxyBaseUrl={proxyBaseUrl} /> : null}
        {activeTab === "chat" ? <AssistantView proxyBaseUrl={proxyBaseUrl} /> : null}
        {activeTab === "analytics" ? <AnalyticsView proxyBaseUrl={proxyBaseUrl} /> : null}
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <div>Medicaid Eligibility Decision Ledger UI (FastTrack-based)</div>
          <div>Mockups used for visual direction only; data is sourced from MarkLogic resource endpoints.</div>
        </div>
      </footer>
    </div>
  );
}
