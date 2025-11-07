// frontend/ui/src/components/AnalyticsPanel.jsx
import React, { useState } from "react";
import {
  Chart,
  ChartSeries,
  ChartSeriesItem,
  ChartCategoryAxis,
  ChartCategoryAxisItem,
  ChartTitle,
} from "@progress/kendo-react-charts";
import "hammerjs";

export default function AnalyticsPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [type, setType] = useState(null);
  const [meta, setMeta] = useState(null); // timing + cache info from server
  const [bypassCache, setBypassCache] = useState(false);

  async function runAnalytics(selectedType) {
    setLoading(true);
    setError(null);
    setResult(null);
    setMeta(null);
    setType(selectedType);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const url = `http://localhost:4001/api/analytics?type=${selectedType}${bypassCache ? '&nocache=1' : ''}`;
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const h = resp.headers;
      const metaInfo = {
        duration: h.get('x-analytics-duration')
          ? Number(h.get('x-analytics-duration'))
          : null,
        cache: h.get('x-cache') || null,
        source: h.get('x-analytics-source') || null,
        fetchedAt: Date.now(),
      };

      setMeta(metaInfo);
      setResult(data);
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('Analytics request timed out');
      } else {
        setError(`Failed to load analytics: ${e.message}`);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  // Helper: flatten MarkLogic /v1/rows JSON into plain objects
  function flattenRows() {
    if (!result?.rows) return [];
    return result.rows.map((r) => {
      const flat = {};
      for (const [key, val] of Object.entries(r)) {
        flat[key] = val?.value ?? null;
      }
      return flat;
    });
  }

  // CSV Export utility
  function exportCSV() {
    const rows = flattenRows();
    if (!rows.length) return;

    const header = Object.keys(rows[0]).join(",");
    const csv = [header, ...rows.map((r) => Object.values(r).join(","))].join(
      "\n"
    );

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type || "analytics"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderChart() {
    const rows = flattenRows();
    if (!rows.length) return null;

    switch (type) {
      case "mostCommonAssistance":
        return (
          <Chart>
            <ChartTitle text="Most Common Assistance Programs" />
            <ChartCategoryAxis>
              <ChartCategoryAxisItem
                // Truncate long labels to reduce crowding
                categories={rows.map((r) =>
                  r.assistanceProgram?.length > 30
                    ? r.assistanceProgram.slice(0, 30) + "..."
                    : r.assistanceProgram
                )}
              />
            </ChartCategoryAxis>
            <ChartSeries>
              <ChartSeriesItem
                // Horizontal bars avoid x-axis label overlap entirely
                type="bar"
                data={rows.map((r) => Number(r.count || 0))}
                tooltip={{ visible: true }}
              />
            </ChartSeries>
          </Chart>
        );

      case "eligibilityByAgeGroup":
        return (
          <Chart>
            <ChartTitle text="Individuals by Age Group" />
            <ChartSeries>
              <ChartSeriesItem
                type="pie"
                data={rows.map((r) => ({
                  category: r.ageGroup,
                  value: Number(r.individuals || 0),
                }))}
              />
            </ChartSeries>
          </Chart>
        );

      case "nearMissFPL":
        return (
          <table className="table-auto border-collapse border border-gray-300 mt-3 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Household ID</th>
                <th className="border px-2 py-1">State</th>
                <th className="border px-2 py-1">Annual Income</th>
                <th className="border px-2 py-1">% FPL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{r.householdId}</td>
                  <td className="border px-2 py-1">{r.state}</td>
                  <td className="border px-2 py-1">
                    {'$' + Number(r.annualIncome || 0).toLocaleString()}
                  </td>
                  <td className="border px-2 py-1">
                    {(Number(r.householdPercentFPL || 0) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case "avgIncomeByFamilySize":
        return (
          <Chart>
            <ChartTitle text="Average Income by Family Size" />
            <ChartCategoryAxis>
              <ChartCategoryAxisItem
                categories={rows.map((r) => r.familySize)}
              />
            </ChartCategoryAxis>
            <ChartSeries>
              <ChartSeriesItem
                type="line"
                data={rows.map((r) => Number(r.avgIncome || 0))}
              />
            </ChartSeries>
          </Chart>
        );

      case "topDenialReasons":
        return (
          <Chart>
            <ChartTitle text="Top Denial / Ineligibility Reasons" />
            <ChartCategoryAxis>
              <ChartCategoryAxisItem
                categories={rows.map((r) =>
                  r.reason?.length > 30
                    ? r.reason.slice(0, 30) + "..."
                    : r.reason
                )}
              />
            </ChartCategoryAxis>
            <ChartSeries>
              <ChartSeriesItem
                type="bar"
                data={rows.map((r) => Number(r.occurrences || 0))}
              />
            </ChartSeries>
          </Chart>
        );

      default:
        // fallback view: raw JSON preview
        return (
          <div className="overflow-x-auto mt-3">
            <pre className="bg-gray-50 p-3 text-xs rounded max-h-96 overflow-y-auto">
              {JSON.stringify(rows, null, 2)}
            </pre>
          </div>
        );
    }
  }

  return (
    <div className="p-6 bg-white border rounded-xl shadow">
      <h2 className="text-lg font-semibold mb-3 text-gray-800 flex justify-between items-center">
        <span>Analytics Dashboard</span>
        <div className="flex items-center gap-3">
          {result?.rows?.length > 0 && (
            <button
              className="text-sm text-blue-600 hover:text-blue-800"
              onClick={exportCSV}
            >
              ⬇ Export CSV
            </button>
          )}
          {meta && (
            <span className="text-xs text-gray-500">
              {`Loaded${meta.duration != null ? ` in ${meta.duration} ms` : ''} (cache: ${meta.cache || 'MISS'})`}
            </span>
          )}
        </div>
      </h2>

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          className="btn"
          onClick={() => runAnalytics("mostCommonAssistance")}
        >
          Common Assistance Programs
        </button>
        <button
          className="btn"
          onClick={() => runAnalytics("eligibilityByAgeGroup")}
        >
          Eligibility by Age Group
        </button>
        <button className="btn" onClick={() => runAnalytics("nearMissFPL")}>
          Near-Miss (190–210% FPL)
        </button>
        <button
          className="btn"
          onClick={() => runAnalytics("avgIncomeByFamilySize")}
        >
          Avg Income by Family Size
        </button>
        <button
          className="btn"
          onClick={() => runAnalytics("topDenialReasons")}
        >
          Top Denial Reasons
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-600 ml-2">
          <input
            type="checkbox"
            checked={bypassCache}
            onChange={(e) => setBypassCache(e.target.checked)}
          />
          Bypass cache
        </label>
      </div>

      {loading && (
        <div className="text-gray-500 animate-pulse">Running analytics...</div>
      )}
      {error && <div className="text-red-600 mt-2">{error}</div>}
      {result && <div className="mt-5">{renderChart()}</div>}
    </div>
  );
}
