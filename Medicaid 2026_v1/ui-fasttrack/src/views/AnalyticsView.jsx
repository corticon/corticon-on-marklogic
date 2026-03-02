import { useEffect, useMemo, useState } from "react";
import { Globe2, Ban, Users, MapPinned, Workflow, RefreshCw } from "lucide-react";
import SectionCard from "../components/SectionCard";
import MetricCard from "../components/MetricCard";
import LoadingState from "../components/LoadingState";
import { debugLog, fetchJson, splitPairValue, shortRulesheetName } from "../lib/api";

function listToMap(list) {
  const map = new Map();
  (list || []).forEach((item) => map.set(item.value, item.count));
  return map;
}

export default function AnalyticsView({ proxyBaseUrl }) {
  const [filters, setFilters] = useState({ state: "", populationType: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({ summary: null, reasons: null, geo: null, cohort: null, rules: null });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const started = performance.now();
    debugLog("analytics", "Loading dashboard payload", filters);

    fetchJson(proxyBaseUrl, "/v1/resources/analytics", {
      "rs:action": "dashboard",
      "rs:state": filters.state,
      "rs:populationType": filters.populationType
    }, { signal: controller.signal })
      .then((dashboard) => {
        const nextData = {
          summary: dashboard.summary || null,
          reasons: dashboard.reasons || null,
          geo: dashboard.geo || null,
          cohort: dashboard.cohort || null,
          rules: dashboard.rules || null,
          diagnostics: dashboard.diagnostics || null
        };
        debugLog("analytics", `Dashboard payload loaded in ${Math.round(performance.now() - started)}ms`, {
          summaryRows: nextData.summary?.filteredCounts,
          topReason: nextData.reasons?.topReasons?.[0] || null,
          diagnostics: dashboard?.diagnostics || null
        });
        setData(nextData);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        debugLog("analytics", `Dashboard payload load failed in ${Math.round(performance.now() - started)}ms`, {
          error: e.message
        });
        setError(e.message || "Failed to load analytics");
        setLoading(false);
      });

    return () => controller.abort();
  }, [proxyBaseUrl, filters.state, filters.populationType]);

  const summaryBlock = data.summary?.summary || {};
  const eligibilityMap = useMemo(() => listToMap(summaryBlock.eligibilityTop), [summaryBlock.eligibilityTop]);
  const householdsByState = data.geo?.householdsByState || [];
  const determinationsByStateMap = useMemo(() => listToMap(data.geo?.determinationsByState), [data.geo?.determinationsByState]);
  const stateTableRows = useMemo(() => householdsByState.map((item) => ({
    state: item.value,
    households: item.count,
    determinations: determinationsByStateMap.get(item.value) || 0
  })), [householdsByState, determinationsByStateMap]);

  const stateOptions = data.summary?.summary?.householdsByState || [];
  const populationOptions = data.cohort?.topPopulationTypes || [];
  const topProgramRules = useMemo(() => {
    return (data.rules?.topProgramRulesheetPairs || []).slice(0, 15).map((item) => {
      const pair = splitPairValue(item.value);
      return { programCode: pair.left || "(none)", rulesheet: shortRulesheetName(pair.right || ""), count: item.count };
    });
  }, [data.rules]);

  if (loading) {
    return (
      <div className="view-stack">
        <SectionCard title="Loading analytics">
          <LoadingState label="Loading summary, cohort, geography, and rule analytics..." />
        </SectionCard>
      </div>
    );
  }

  if (error) {
    return <div className="error-panel">{error}</div>;
  }

  return (
    <div className="view-stack">
      <SectionCard
        title="Population Analytics Dashboard"
        subtitle="Management view for ineligibility patterns, cohorts, geography, and rule influence."
        actions={(
          <button type="button" className="ghost-button" onClick={() => {
            debugLog("analytics", "Manual refresh requested", filters);
            setFilters((prev) => ({ ...prev }));
          }}>
            <RefreshCw size={14} />
            Refresh
          </button>
        )}
      >
        <div className="controls-grid analytics-filters">
          <label>
            <span>State Filter</span>
            <select value={filters.state} onChange={(e) => setFilters((prev) => ({ ...prev, state: e.target.value }))}>
              <option value="">All states</option>
              {stateOptions.map((item) => <option key={item.value} value={item.value}>{item.value}</option>)}
            </select>
          </label>
          <label>
            <span>Population Filter</span>
            <select value={filters.populationType} onChange={(e) => setFilters((prev) => ({ ...prev, populationType: e.target.value }))}>
              <option value="">All populations</option>
              {populationOptions.slice(0, 40).map((item) => <option key={item.value} value={item.value}>{item.value}</option>)}
            </select>
          </label>
          <div className="analytics-filter-note">
            <Globe2 size={14} />
            Filters apply to supported analytics actions and help narrow cohort/ineligibility patterns.
          </div>
        </div>
      </SectionCard>

      <div className="metric-grid">
        <MetricCard title="Households" value={data.summary?.filteredCounts?.households ?? "—"} subtitle="Filtered case count" accent="blue" />
        <MetricCard title="Determinations" value={data.summary?.filteredCounts?.determinations ?? "—"} subtitle="Filtered determination rows" accent="slate" />
        <MetricCard title="Eligible" value={eligibilityMap.get("Eligible") || 0} subtitle="Top-level outcome count" accent="green" />
        <MetricCard title="Ineligible" value={eligibilityMap.get("Ineligible") || 0} subtitle="Top-level outcome count" accent="red" />
      </div>

      <div className="analytics-grid">
        <SectionCard title="Common Ineligibility Reasons" subtitle="Top ineligibility reasons from filtered determination rows." className="span-6">
          <div className="bar-list">
            {(data.reasons?.topReasons || []).map((item, idx, arr) => {
              const max = arr[0]?.count || 1;
              const width = Math.max(4, (item.count / max) * 100);
              return (
                <div className="bar-row" key={`${item.value}-${item.count}`}>
                  <div className="bar-meta">
                    <span className="mono wrap">{item.value}</span>
                    <strong>{item.count}</strong>
                  </div>
                  <div className="bar-track"><div className="bar-fill danger" style={{ width: `${width}%` }} /></div>
                </div>
              );
            })}
            {!(data.reasons?.topReasons || []).length ? <div className="empty-inline">No ineligibility rows in the current filter scope.</div> : null}
          </div>
        </SectionCard>

        <SectionCard title="Cohort Commonalities" subtitle="Population tags and cross-state cohort patterns." className="span-6">
          <div className="bar-list compact">
            {(data.cohort?.topPopulationTypes || []).slice(0, 10).map((item, idx, arr) => {
              const max = arr[0]?.count || 1;
              return (
                <div className="bar-row" key={`${item.value}-${item.count}`}>
                  <div className="bar-meta">
                    <span>{item.value}</span>
                    <strong>{item.count}</strong>
                  </div>
                  <div className="bar-track"><div className="bar-fill info" style={{ width: `${(item.count / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
          <div className="list-rows top-space">
            {(data.cohort?.topPopulationByState || []).slice(0, 8).map((item) => {
              const pair = splitPairValue(item.value);
              return (
                <div className="list-row" key={`${item.value}-${item.count}`}>
                  <span>{pair.left} · {pair.right}</span>
                  <strong>{item.count}</strong>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Geographic Distribution" subtitle="Household and determination distribution by state." className="span-8">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th className="num">Households</th>
                  <th className="num">Determinations</th>
                </tr>
              </thead>
              <tbody>
                {stateTableRows.slice(0, 20).map((row) => (
                  <tr key={row.state}>
                    <td>{row.state}</td>
                    <td className="num">{row.households}</td>
                    <td className="num">{row.determinations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="list-rows top-space">
            {(data.geo?.topStateReasonPairs || []).slice(0, 6).map((item) => {
              const pair = splitPairValue(item.value);
              return (
                <div className="list-row list-row-stacked" key={`${item.value}-${item.count}`}>
                  <div><MapPinned size={12} /> {pair.left}</div>
                  <div className="subtle mono wrap">{pair.right}</div>
                  <strong>{item.count}</strong>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Rule Influence" subtitle="Rulesheets and program/rulesheet pair frequencies from trace metrics." className="span-4">
          <div className="list-rows">
            {(summaryBlock.rulesheetTop || []).slice(0, 8).map((item) => (
              <div className="list-row" key={`${item.value}-${item.count}`}>
                <span className="wrap">{shortRulesheetName(item.value)}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
          <div className="subsection-title"><Workflow size={14} /> Program / Rulesheet Pairs</div>
          <div className="list-rows">
            {topProgramRules.slice(0, 8).map((item) => (
              <div className="list-row list-row-stacked" key={`${item.programCode}-${item.rulesheet}-${item.count}`}>
                <div>{item.programCode}</div>
                <div className="subtle wrap">{item.rulesheet}</div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Management Insight Summary" subtitle="Narrative summary blocks for supervisors and policy ops analysts.">
        <div className="insight-strip">
          <div className="insight-item">
            <Ban size={16} />
            <span>
              Most common ineligibility reason: <strong>{data.reasons?.topReasons?.[0]?.value || "N/A"}</strong>
              {" "}({data.reasons?.topReasons?.[0]?.count || 0} rows)
            </span>
          </div>
          <div className="insight-item">
            <Users size={16} />
            <span>
              Highest-volume cohort tag: <strong>{data.cohort?.topPopulationTypes?.[0]?.value || "N/A"}</strong>
              {" "}({data.cohort?.topPopulationTypes?.[0]?.count || 0})
            </span>
          </div>
          <div className="insight-item">
            <Globe2 size={16} />
            <span>
              Highest-volume state: <strong>{data.geo?.householdsByState?.[0]?.value || "N/A"}</strong>
              {" "}({data.geo?.householdsByState?.[0]?.count || 0} households)
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
