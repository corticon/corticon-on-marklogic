import React, { useEffect, useState } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Fix for hot reload canvas reuse
ChartJS.overrides.bar = { ...ChartJS.overrides.bar, destroy: true };

const palette = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
  "#59a14f", "#edc949", "#af7aa1", "#ff9da7",
  "#9c755f", "#bab0ab"
];

export default function AnalyticsPanel() {
  const [charts, setCharts] = useState({});
  const [visible, setVisible] = useState(false);
  const [lineageId, setLineageId] = useState("");
  const [lineageMode, setLineageMode] = useState('messages'); // 'messages' | 'metrics'
  const [heatmapMode, setHeatmapMode] = useState('messages'); // 'messages' | 'metrics'

  useEffect(() => {
    const types = [
      "eligibilityByAgeGroup",
      "avgIncomeByFamilySize",
      "mostCommonAssistance",
      // New data-backed queries
      "ageDistribution",
      "sizeDistribution",
      "incomeBuckets",
      "topProgramNames",
      "programGroupCounts",
      "incomeTestOutcomeByGroup",
      "relationTop",
      "fplBandDistribution",
    ];
    types.forEach(async (type) => {
      try {
        const res = await fetch(`http://localhost:4001/api/analytics?type=${type}`);
        const json = await res.json();
        setCharts((prev) => ({ ...prev, [type]: json }));
      } catch (e) {
        console.error("Failed to load analytics:", e);
      }
    });
    const t = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  const chartBox = (title, chart, caption, delay = 0) => (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "16px",
        padding: "25px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
        flex: "1 1 48%",
        minHeight: "560px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        textAlign: "center",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
      }}
    >
      <div style={{ width: "100%" }}>
        <h3 style={{ color: "#333", marginBottom: "15px", fontSize: "1.3rem" }}>
          {title}
        </h3>
        <div
          style={{
            height: "420px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {chart}
        </div>
      </div>
      <p
        style={{
          marginTop: "10px",
          fontSize: "0.95rem",
          color: "#555",
          background: "#f8f9fa",
          borderRadius: "8px",
          padding: "10px 14px",
          lineHeight: 1.4,
        }}
      >
        {caption}
      </p>
    </div>
  );

  // 🧩 Eligibility by Age Group (stacked by program when available; otherwise single series)
  const ageChart = charts.eligibilityByAgeGroup && (() => {
    const rows = charts.eligibilityByAgeGroup.rows || [];
    const hasProgram = rows.some(r => r.program && r.program.value != null);
    const ageGroups = [...new Set(rows.map(r => r.ageGroup?.value))].filter(Boolean);
    let datasets;
    if (hasProgram) {
      const programs = [...new Set(rows.map(r => r.program?.value))].filter(Boolean);
      datasets = programs.map((p, i) => ({
        label: p,
        data: ageGroups.map(a => rows.find(r => r.ageGroup?.value === a && r.program?.value === p)?.count?.value || 0),
        backgroundColor: palette[i % palette.length],
      }));
    } else {
      datasets = [{
        label: "# Individuals",
        data: ageGroups.map(a => rows.find(r => r.ageGroup?.value === a)?.individuals?.value || 0),
        backgroundColor: palette[0],
      }];
    }
    return (
      <Bar
        data={{ labels: ageGroups, datasets }}
        options={{
          responsive: true,
          plugins: { legend: { position: "bottom" } },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: "# of Individuals" } },
            x: { title: { display: true, text: "Age Group" } },
          },
        }}
      />
    );
  })();

  // 💵 Average Income by Family Size
  const incomeChart = charts.avgIncomeByFamilySize && (() => {
    const labels = (charts.avgIncomeByFamilySize.rows||[]).map(r => r.familySize?.value).filter(v => v !== undefined);
    const data = (charts.avgIncomeByFamilySize.rows||[]).map(r => r.avgIncome?.value).filter(v => v !== undefined);
    return (
      <Line
        data={{
          labels,
          datasets: [{
            label: "Average Income ($)",
            data,
            borderColor: palette[0],
            backgroundColor: "rgba(78,121,167,0.2)",
            tension: 0.3,
            fill: true,
          }],
        }}
        options={{
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: "Family Size" } },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Average Household Income ($)" },
              ticks: { callback: (v) => `$${v.toLocaleString()}` },
            },
          },
        }}
      />
    );
  })();

    // 📊 Age distribution
  const ageDistChart = charts.ageDistribution && (() => {
    const rows = charts.ageDistribution.rows || [];
    const labels = rows.map(r => r.ageGroup?.value);
    const data = rows.map(r => r.individuals?.value || 0);
    return (
      <Bar data={{ labels, datasets: [{ label: "Individuals", data, backgroundColor: palette[1] }] }}
           options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
    );
  })();

  // 👪 Household size distribution
  const sizeDistChart = charts.sizeDistribution && (() => {
    const rows = charts.sizeDistribution.rows || [];
    const labels = rows.map(r => r.size?.value);
    const data = rows.map(r => r.households?.value || 0);
    return (
      <Bar data={{ labels, datasets: [{ label: "Households", data, backgroundColor: palette[3] }] }}
           options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
    );
  })();

  // 💸 Income buckets
  const incomeBucketsChart = charts.incomeBuckets && (() => {
    const rows = charts.incomeBuckets.rows || [];
    const labels = rows.map(r => r.incomeBucket?.value);
    const data = rows.map(r => r.households?.value || 0);
    return (
      <Bar data={{ labels, datasets: [{ label: "Households", data, backgroundColor: palette[5] }] }}
           options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
    );
  })();

  // 🏷️ Top program names
  const topProgramsChart = charts.topProgramNames && (() => {
    const rows = charts.topProgramNames.rows || [];
    const labels = rows.map(r => r.program?.value);
    const data = rows.map(r => r.count?.value || 0);
    return (
      <Bar data={{ labels, datasets: [{ label: "Count", data, backgroundColor: palette[2] }] }}
           options={{ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }} />
    );
  })();

  // 🧱 Program groups
  const programGroupsChart = charts.programGroupCounts && (() => {
    const rows = charts.programGroupCounts.rows || [];
    const labels = rows.map(r => r.assistanceGroup?.value);
    const data = rows.map(r => r.count?.value || 0);
    return (
      <Bar data={{ labels, datasets: [{ label: "Count", data, backgroundColor: palette.slice(0, labels.length) }] }}
           options={{ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }} />
    );
  })();

  // ✅ Income-test outcome by group (stacked)
  const incomeOutcomeChart = charts.incomeTestOutcomeByGroup && (() => {
    const rows = charts.incomeTestOutcomeByGroup.rows || [];
    const labels = rows.map(r => r.group?.value);
    const pass = rows.map(r => r.pass?.value || 0);
    const fail = rows.map(r => r.fail?.value || 0);
    const unknown = rows.map(r => r.unknown?.value || 0);
    return (
      <Bar data={{ labels, datasets: [
        { label: 'Pass', data: pass, backgroundColor: '#59a14f' },
        { label: 'Fail', data: fail, backgroundColor: '#e15759' },
        { label: 'Unknown', data: unknown, backgroundColor: '#bab0ab' },
      ] }}
           options={{ plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }} />
    );
  })();

  // 👤 Relation to applicant top 20
  const relationTopChart = charts.relationTop && (() => {
    const rows = charts.relationTop.rows || [];
    const labels = rows.map(r => r.relationToApplicant?.value);
    const data = rows.map(r => r.individuals?.value || 0);
    return (
      <Bar data={{ labels, datasets: [{ label: "Individuals", data, backgroundColor: palette[6] }] }}
           options={{ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }} />
    );
  })();

  // 📈 FPL bands
  const fplBandChart = charts.fplBandDistribution && (() => {
    const rows = charts.fplBandDistribution.rows || [];
    const labels = rows.map(r => r.fplBand?.value);
    const data = rows.map(r => r.households?.value || 0);
    return (
      <Bar data={{ labels, datasets: [{ label: "Households", data, backgroundColor: palette[4] }] }}
           options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
    );
  })();
// 🧪 Pathways activity failures (bar by age group)
  const pathwaysChart = charts.pathwaysActivityFailures && (() => {
    const labels = (charts.pathwaysActivityFailures.rows||[]).map(r => r.ageGroup?.value).filter(Boolean);
    const data = (charts.pathwaysActivityFailures.rows||[]).map(r => r.count?.value || 0);
    return (
      <Bar
        data={{ labels, datasets: [{ label: "# Individuals", data, backgroundColor: palette[2] }] }}
        options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
      />
    );
  })();

  // 📈 Near-miss income table
  const nearMissTable = charts.nearMissIncome && (() => {
    const rows = (charts.nearMissIncome.rows||[]).map(r => ({
      householdId: r.householdId?.value,
      state: r.state?.value,
      program: r.program?.value,
      annualIncome: r.annualIncome?.value,
      incomeThreshold: r.incomeThreshold?.value,
      overPercent: r.overPercent?.value,
    }));
    const sorted = rows.sort((a,b) => (a.overPercent ?? 0) - (b.overPercent ?? 0)).slice(0,20);
    return (
      <div style={{ width: "100%", overflowX: "auto" }}>
        <table className="table-auto" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f4f4f5" }}>
              <th className="px-2 py-1">Household</th>
              <th className="px-2 py-1">State</th>
              <th className="px-2 py-1">Program</th>
              <th className="px-2 py-1">Income</th>
              <th className="px-2 py-1">Threshold</th>
              <th className="px-2 py-1">Over %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r,i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                <td className="px-2 py-1">{r.householdId}</td>
                <td className="px-2 py-1">{r.state}</td>
                <td className="px-2 py-1">{r.program}</td>
                <td className="px-2 py-1">${'{'}(r.annualIncome||0).toLocaleString(){'}'}</td>
                <td className="px-2 py-1">${'{'}(r.incomeThreshold||0).toLocaleString(){'}'}</td>
                <td className="px-2 py-1">{(r.overPercent ?? 0).toFixed ? r.overPercent.toFixed(2) : r.overPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  })();

  // 🎯 Tie-breakers table
  const tieBreakersTable = charts.tieBreakerOutcomes && (() => {
    const rows = (charts.tieBreakerOutcomes.rows||[]).map(r => ({
      householdId: r.householdId?.value,
      first: r.first?.value,
      last: r.last?.value,
      eligiblePrograms: r.eligiblePrograms?.value,
      chosenGroup: r.chosenGroup?.value,
      minPriority: r.minPriority?.value,
    })).slice(0,20);
    return (
      <div style={{ width: "100%", overflowX: "auto" }}>
        <table className="table-auto" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f4f4f5" }}>
              <th className="px-2 py-1">Household</th>
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Eligible Programs</th>
              <th className="px-2 py-1">Chosen Group</th>
              <th className="px-2 py-1">Priority</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                <td className="px-2 py-1">{r.householdId}</td>
                <td className="px-2 py-1">{r.first} {r.last}</td>
                <td className="px-2 py-1">{r.eligiblePrograms}</td>
                <td className="px-2 py-1">{r.chosenGroup}</td>
                <td className="px-2 py-1">{r.minPriority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  })();




  // 💬 Most Common Assistance Programs
  const assistChart = charts.mostCommonAssistance && (() => {
    const labels = (charts.mostCommonAssistance.rows||[]).map(r => r.assistanceGroup?.value).filter(Boolean);
    const data = (charts.mostCommonAssistance.rows||[]).map(r => r.count?.value || 0);
    return (
      <Pie
        data={{
          labels,
          datasets: [{
            label: "Individuals",
            data,
            backgroundColor: palette.slice(0, labels.length),
          }],
        }}
        options={{
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${ctx.raw} individuals`,
              },
            },
          },
        }}
      />
    );
  })();

  // 🔁 Churn risk (Pickle/DAC) pie
  const churnChart = charts.churnPrograms && (() => {
    const labels = (charts.churnPrograms.rows||[]).map(r => r.program?.value).filter(Boolean);
    const data = (charts.churnPrograms.rows||[]).map(r => r.count?.value || 0);
    return (
      <Pie
        data={{ labels, datasets: [{ label: "Eligible", data, backgroundColor: palette.slice(0, labels.length) }] }}
        options={{ plugins: { legend: { position: "bottom" } } }}
      />
    );
  })();

  // 🧮 Rule usage heatmap (render as top rules table)
  const currentHeatmap = heatmapMode === 'metrics' ? charts.ruleUsageHeatmapMetrics : charts.ruleUsageHeatmap;
  const ruleUsageTable = currentHeatmap && (() => {
    const rows = (currentHeatmap.rows||[]).map(r => ({
      rulesheetName: r.rulesheetName?.value,
      ruleNumber: r.ruleNumber?.value,
      count: r.count?.value || 0,
    })).sort((a,b) => b.count - a.count).slice(0,25);
    return (
      <div style={{ width: "100%", overflowX: "auto" }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <span style={{ color: '#555' }}>Source:</span>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="radio" name="heatmap" checked={heatmapMode==='messages'} onChange={()=>setHeatmapMode('messages')} />
            Messages
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="radio" name="heatmap" checked={heatmapMode==='metrics'} onChange={()=>setHeatmapMode('metrics')} />
            Metrics
          </label>
        </div>
        <table className="table-auto" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f4f4f5" }}>
              <th className="px-2 py-1">Rulesheet</th>
              <th className="px-2 py-1">Rule #</th>
              <th className="px-2 py-1">Fired Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                <td className="px-2 py-1">{r.rulesheetName}</td>
                <td className="px-2 py-1">{r.ruleNumber}</td>
                <td className="px-2 py-1">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  })();

  // 📜 Decision lineage for a household (input-driven)
  const loadLineage = async () => {
    const id = parseInt(lineageId, 10);
    if (!id) return;
    try {
      const type = lineageMode === 'metrics' ? 'ruleLineageMetrics' : 'ruleLineage';
      const res = await fetch(`http://localhost:4001/api/analytics?type=${type}&householdId=${id}`);
      const json = await res.json();
      setCharts(prev => ({ ...prev, ruleLineage: json }));
    } catch (e) {
      console.error('Failed to load lineage', e);
    }
  };

  const ruleLineageTable = charts.ruleLineage && (() => {
    const rows = (charts.ruleLineage.rows||[]).map(r => ({
      rulesheetName: r.rulesheetName?.value,
      ruleNumber: r.ruleNumber?.value,
      severity: r.severity?.value,
      text: r.text?.value,
    }));
    return (
      <div style={{ width: "100%", overflowX: "auto" }}>
        <div style={{ marginBottom: 8, color: '#555' }}>Lineage for household {lineageId}</div>
        <table className="table-auto" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f4f4f5" }}>
              <th className="px-2 py-1">Rulesheet</th>
              <th className="px-2 py-1">Rule #</th>
              <th className="px-2 py-1">Severity</th>
              <th className="px-2 py-1">Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                <td className="px-2 py-1">{r.rulesheetName}</td>
                <td className="px-2 py-1">{r.ruleNumber}</td>
                <td className="px-2 py-1">{r.severity}</td>
                <td className="px-2 py-1" style={{ maxWidth: 700 }}>{r.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  })();
  // 🏠 Complex households (bar by state)
  const complexHouseholdsChart = charts.complexHouseholds && (() => {
    const labels = (charts.complexHouseholds.rows||[]).map(r => r.state?.value).filter(Boolean);
    const data = (charts.complexHouseholds.rows||[]).map(r => r.households?.value || 0);
    return (
      <Bar
        data={{ labels, datasets: [{ label: "Households", data, backgroundColor: palette[4] }] }}
        options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
      />
    );
  })();

  return (
    <div
      style={{
        padding: "40px",
        maxWidth: "1500px",
        margin: "auto",
        background: "#fafafa",
        minHeight: "100vh",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          marginBottom: "40px",
          fontSize: "1.8rem",
          fontWeight: "600",
          color: "#222",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(30px)",
          transition: "opacity 1s ease, transform 1s ease",
        }}
      >
        Medicaid Eligibility Analytics Dashboard
      </h2>
      {/* Lineage loader */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
        <label style={{ color: '#444' }}>Household ID:</label>
        <input
          value={lineageId}
          onChange={(e) => setLineageId(e.target.value)}
          placeholder="e.g. 14"
          style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: 6 }}
        />
        <button onClick={loadLineage} style={{ padding: '6px 12px', background: '#4e79a7', color: 'white', borderRadius: 6 }}>
          Load Lineage
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "30px",
        }}
      >
        {ageChart &&
          chartBox(
            "Eligibility by Age Group",
            ageChart,
            "Shows how eligibility varies across age groups and program types — revealing which demographics are most likely to qualify.",
            0.1
          )}
        {incomeChart &&
          chartBox(
            "Average Income by Family Size",
            incomeChart,
            "Demonstrates how average income changes with family size — useful for spotting trends in larger or smaller households.",
            0.2
          )}
        {assistChart &&
          chartBox(
            "Most Common Assistance Programs",
            assistChart,
            "Shows which Medicaid programs serve the largest share of individuals overall — a quick snapshot of program reach.",
            0.3
          )}
        {ruleUsageTable &&
          chartBox(
            "Rule Usage Heatmap (Top Fired)",
            ruleUsageTable,
            "Counts of fired rules aggregated by rulesheet and rule number.",
            0.32
          )}
        {pathwaysChart &&
          chartBox(
            "Pathways Activity Requirement Impact",
            pathwaysChart,
            "Individuals who are financially eligible but fail Pathways' 80-hour activity requirement (by age group).",
            0.35
          )}
        {ageDistChart &&
          chartBox(
            "Age Distribution",
            ageDistChart,
            "Distribution of individuals by age group.",
            0.32
          )}
        {sizeDistChart &&
          chartBox(
            "Household Size Distribution",
            sizeDistChart,
            "How many households fall into each family size.",
            0.34
          )}
        {incomeBucketsChart &&
          chartBox(
            "Income Buckets",
            incomeBucketsChart,
            "Distribution of household incomes by coarse buckets.",
            0.36
          )}
        {topProgramsChart &&
          chartBox(
            "Top Program Names",
            topProgramsChart,
            "Most frequent program determinations across the population.",
            0.38
          )}
        {programGroupsChart &&
          chartBox(
            "Program Groups",
            programGroupsChart,
            "Counts by high-level program grouping.",
            0.40
          )}
        {incomeOutcomeChart &&
          chartBox(
            "Income-Test Outcome by Group",
            incomeOutcomeChart,
            "Pass vs Unknown (no failures in this dataset) by group.",
            0.42
          )}
        {relationTopChart &&
          chartBox(
            "Relation to Applicant (Top 20)",
            relationTopChart,
            "Most common relationship types represented in the dataset.",
            0.44
          )}
        {fplBandChart &&
          chartBox(
            "FPL Band Distribution",
            fplBandChart,
            "Households by derived Federal Poverty Level band.",
            0.46
          )}        {nearMissTable &&
          chartBox(
            "Near-Miss Financial Ineligibility (< 5%)",
            nearMissTable,
            "Households over the program threshold by less than 5% — prime candidates for policy tuning.",
            0.4
          )}
        {tieBreakersTable &&
          chartBox(
            "Program Tie-Breakers (Eligible > 2)",
            tieBreakersTable,
            "Applicants eligible for multiple programs and their assigned priority group.",
            0.45
          )}
        {churnChart &&
          chartBox(
            "Churn Risk (Pickle & DAC)",
            churnChart,
            "Share of individuals eligible via safety-net programs like Pickle or Disabled Adult Child.",
            0.5
          )}
        {complexHouseholdsChart &&
          chartBox(
            "Household Composition Complexity",
            complexHouseholdsChart,
            "Count of large households (>4) with at least one non-parent/child relation.",
            0.55
          )}
        {charts.ruleLineage &&
          chartBox(
            "Show Your Work (Decision Lineage)",
            ruleLineageTable,
            "All rule messages for a specific household; enter an ID and load to view.",
            0.6
          )}
      </div>
    </div>
  );
}
