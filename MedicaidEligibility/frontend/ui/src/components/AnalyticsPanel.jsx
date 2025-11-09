import React, { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Grid, GridColumn as Column } from '@progress/kendo-react-grid';
import * as mlService from '../api/marklogicService';
import './AnalyticsPanel.css';

// Enable Kendo grid features if desired
import { process } from '@progress/kendo-data-query';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const AnalyticsPanel = () => {
  const [programStats, setProgramStats] = useState([]);
  const [demographicStats, setDemographicStats] = useState([]);
  const [ruleStats, setRuleStats] = useState([]);
  const [nearMissStats, setNearMissStats] = useState([]);
  const [pathwaysPass, setPathwaysPass] = useState([]);
  const [pathwaysUnderHours, setPathwaysUnderHours] = useState([]);
  const [pathwaysAdultsNotEnrolled, setPathwaysAdultsNotEnrolled] = useState([]);
  const [procRootCauses, setProcRootCauses] = useState([]);
  const [ssnQuery, setSsnQuery] = useState('');
  const [decisionPath, setDecisionPath] = useState([]);
  const [loading, setLoading] = useState(true);

  // Kendo Grid state for sorting/paging if needed
  const [ruleGridState, setRuleGridState] = useState({ skip: 0, take: 10 });
  const [missGridState, setMissGridState] = useState({ skip: 0, take: 10 });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          mlService.getProgramEligibilityStats(),
          mlService.getDemographicTrends(),
          mlService.getRuleFiringStats(),
          mlService.getNearMissByThreshold(),
          mlService.getPathwaysFinancialPass(),
          mlService.getPathwaysUnderHours(),
          mlService.getPathwaysNotEnrolledAdults(),
          mlService.getProceduralRootCauses(),
        ]);

        setProgramStats(results[0].status === 'fulfilled' ? results[0].value : []);
        setDemographicStats(results[1].status === 'fulfilled' ? results[1].value : []);
        setRuleStats(results[2].status === 'fulfilled' ? results[2].value : []);
        setNearMissStats(results[3].status === 'fulfilled' ? results[3].value : []);
        setPathwaysPass(results[4].status === 'fulfilled' ? results[4].value : []);
        setPathwaysUnderHours(results[5].status === 'fulfilled' ? results[5].value : []);
        setPathwaysAdultsNotEnrolled(results[6].status === 'fulfilled' ? results[6].value : []);
        setProcRootCauses(results[7].status === 'fulfilled' ? results[7].value : []);
      } catch (error) {
        console.error("Critical failure fetching analytics data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading Analytics...</p>
      </div>
    );
  }

  // --- Data Helpers ---
  const safeVal = (val) => (val && typeof val === 'object' && val.hasOwnProperty('value') ? val.value : val);
  const cleanRulesheet = (path) => {
      const val = safeVal(path);
      if (!val || typeof val !== 'string') return 'Unknown';
      // Extract filename without extension from full path
      const parts = val.split('/');
      const filename = parts[parts.length - 1];
      return filename ? filename.replace(/\.(ers|eds)$/, '') : val;
  };

  // --- Chart Data Preparation ---
  // Eligibility by Class of Assistance (Passed only, top 12)
  const passedByProgram = programStats.map(d => {
    const total = Number(safeVal(d.Total_Evaluated) || 0);
    const failI = Number(safeVal(d.Failed_Income_Test) || 0);
    const failR = Number(safeVal(d.Failed_Resource_Test) || 0);
    return { program: safeVal(d.Program_Name), passed: Math.max(0, total - failI - failR) };
  }).sort((a,b) => b.passed - a.passed).slice(0, 12);
  const eligibilityChartData = {
    labels: passedByProgram.map(x => x.program),
    datasets: [{
      label: 'Eligible (Passed)',
      data: passedByProgram.map(x => x.passed),
      backgroundColor: '#10b981'
    }]
  };

  // Aggregate by Demographic_Group (query returns Program dimension too)
  const demographicTotals = demographicStats.reduce((acc, row) => {
    const grp = safeVal(row.Demographic_Group);
    const cnt = Number(safeVal(row.Enrollment_Count) || 0);
    acc[grp] = (acc[grp] || 0) + cnt;
    return acc;
  }, {});
  const demographicLabels = Object.keys(demographicTotals);
  const demographicValues = demographicLabels.map(k => demographicTotals[k]);
  const demographicChartData = {
    labels: demographicLabels,
    datasets: [{
      data: demographicValues,
      backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
      borderWidth: 1,
    }],
  };

  // --- Pathways KPI + Histogram ---
  const pathwaysKpi = {
    financialPass: pathwaysPass.length,
    underHours: pathwaysUnderHours.length,
    notEnrolledAdults: pathwaysAdultsNotEnrolled.length,
  };
  const hourBins = ['0-20', '20-40', '40-60', '60-80'];
  const hoursCounts = [0,0,0,0];
  pathwaysUnderHours.forEach(row => {
    const hrs = Number(safeVal(row.totalHrs) || 0);
    const idx = hrs < 20 ? 0 : hrs < 40 ? 1 : hrs < 60 ? 2 : 3;
    hoursCounts[idx] += 1;
  });
  const pathwaysHoursData = {
    labels: hourBins,
    datasets: [{
      label: 'Individuals',
      data: hoursCounts,
      backgroundColor: '#3b82f6'
    }]
  };

  const isEmptyBar = (data) => !data.labels || data.labels.length === 0 || data.datasets.every(ds => (ds.data || []).every(v => Number(v) === 0));

  // (Removed) churn and least-fired computations per request

  // Procedural root causes bar
  const procData = {
    labels: procRootCauses.map(r => String(safeVal(r.attributeName))),
    datasets: [{
      label: 'Firing Count',
      data: procRootCauses.map(r => Number(safeVal(r.Firing_Count) || 0)),
      backgroundColor: '#10b981'
    }]
  };

  // Grids
  const underHoursGrid = pathwaysUnderHours.map(m => ({
    ssn: safeVal(m.ssn),
    first: safeVal(m.first),
    last: safeVal(m.last),
    totalHrs: Number(safeVal(m.totalHrs) || 0)
  }));

  // (Removed) ABD Savings Penalty grid per request

  // --- Kendo Grid Data Preparation ---
  const ruleGridData = ruleStats.map(r => ({
      rulesheet: cleanRulesheet(r.rulesheetName),
      entity: safeVal(r.entityName),
      attribute: safeVal(r.attributeName),
      count: Number(safeVal(r.Firing_Count))
  }));

  const missGridData = nearMissStats.map(m => ({
      id: safeVal(m.householdId),
      familySize: Number(safeVal(m.familySize) || 0),
      program: safeVal(m.Program),
      annualIncome: Number(safeVal(m.annualIncome) || 0),
      threshold: Number(safeVal(m.incomeThreshold) || 0),
      overPct: ((Number(safeVal(m.incomeToThreshold) || 0) - 1) * 100)
  }));

  // Grid cell formatters
  const CurrencyCell = (props) => {
    const val = props.dataItem[props.field];
    const txt = val == null ? '' : `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return <td>{txt}</td>;
  };
  const Percent4Cell = (props) => {
    const val = props.dataItem[props.field];
    const txt = val == null ? '' : `${Number(val).toFixed(4)}%`;
    return <td>{txt}</td>;
  };

  return (
    <div className="analytics-panel">
      <h2 className="analytics-title">Medicaid Program Insight Dashboard</h2>

      {/* Top Row: Charts */}
      <div className="charts-grid">
        <div className="card chart-card">
          <h3 className="card-title">Eligibility by Class of Assistance</h3>
          <div className="chart-wrapper">
            <Bar
              data={eligibilityChartData}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: { x: { beginAtZero: true } }
              }}
            />
          </div>
        </div>

        <div className="card chart-card">
          <h3 className="card-title">Population Demographics</h3>
          <div className="chart-wrapper doughnut-wrapper">
             <Doughnut
               data={demographicChartData}
               options={{
                 responsive: true,
                 maintainAspectRatio: false,
                 plugins: { legend: { position: 'right' } }
               }}
             />
          </div>
        </div>
      </div>

      {/* Bottom Row: Data Grids */}
      <div className="grids-grid">
        <div className="card chart-card">
          <h3 className="card-title">Pathways Hours Gap</h3>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
            <div>Financial Pass: <strong>{pathwaysKpi.financialPass}</strong></div>
            <div>Under 80 Hours: <strong>{pathwaysKpi.underHours}</strong></div>
            <div>Adults Not Enrolled: <strong>{pathwaysKpi.notEnrolledAdults}</strong></div>
          </div>
          <div className="chart-wrapper">
            {isEmptyBar(pathwaysHoursData) ? (
              <div style={{ color: '#64748b' }}>No qualifying activity data in 0–80 hours window.</div>
            ) : (
              <Bar data={pathwaysHoursData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
            )}
          </div>
          <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: 13 }}>
            Individuals who financially qualify for Pathways but report fewer than 80 hours/month of qualifying activity.
            Bins: 0–20, 20–40, 40–60, 60–80 hours in the latest month of reported activity.
          </div>
        </div>

        <div className="card grid-card">
          <h3 className="card-title">Pathways: Individuals Under 80 Hours</h3>
          <Grid
             data={underHoursGrid}
             pageable={true}
             sortable={true}
             style={{ height: '400px', width: '100%' }}
          >
            <Column field="ssn" title="SSN" />
            <Column field="first" title="First" />
            <Column field="last" title="Last" />
            <Column field="totalHrs" title="Total Hrs" />
          </Grid>
        </div>
      </div>

      {/* (Removed) Churn Risk and Least-Fired Rules per request */}

      {/* Procedural Root Causes */}
      <div className="grids-grid">
        <div className="card chart-card">
          <h3 className="card-title">Procedural Denials: Root Causes</h3>
          <div className="chart-wrapper">
            {isEmptyBar(procData) ? (
              <div style={{ color: '#64748b' }}>No procedural root causes found.</div>
            ) : (
              <Bar data={procData} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }} />
            )}
          </div>
        </div>
      </div>

      {/* Decision Path Timeline */}
      <div className="grids-grid">
        <div className="card grid-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="card-title">Decision Path (Notes + Rule Firings)</h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              placeholder="Enter SSN (e.g., 449-24-8687)"
              value={ssnQuery}
              onChange={(e) => setSsnQuery(e.target.value)}
              style={{ flex: '0 0 280px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: 6 }}
            />
            <button
              onClick={async () => {
                if (!ssnQuery) return;
                const rows = await mlService.getDecisionPathBySSN(ssnQuery);
                // sort by Sequence
                const sorted = [...rows].sort((a,b) => (Number(safeVal(a.Sequence) || 0) - Number(safeVal(b.Sequence) || 0)));
                setDecisionPath(sorted);
              }}
              style={{ padding: '8px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6 }}
            >
              Fetch Timeline
            </button>
          </div>
          <div style={{ maxHeight: 360, overflow: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
            {decisionPath.length === 0 ? (
              <div style={{ color: '#64748b' }}>No timeline loaded.</div>
            ) : (
              <ol>
                {decisionPath.map((row, idx) => (
                  <li key={idx} style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: '#475569' }}>
                      [{safeVal(row.Type)}] #{Number(safeVal(row.Sequence) || 0)}
                    </span>
                    <div>{safeVal(row.Details)}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
      </div>
      <div className="card grid-card">
          <h3 className="card-title">Top Rule Executions</h3>
          <Grid
            data={process(ruleGridData, ruleGridState)}
            {...ruleGridState}
            onDataStateChange={(e) => setRuleGridState(e.dataState)}
            pageable={true}
            sortable={true}
            style={{ height: '400px' }}
          >
            <Column field="rulesheet" title="Rulesheet" width="180px" />
            <Column field="entity" title="Entity" width="120px" />
            <Column field="attribute" title="Attribute" />
            <Column field="count" title="Count" width="100px" filter="numeric" />
          </Grid>
        </div>

        <div className="card grid-card">
          <h3 className="card-title">"Near Miss" Income vs Program Threshold</h3>
          <Grid
             data={process(missGridData, missGridState)}
             {...missGridState}
             onDataStateChange={(e) => setMissGridState(e.dataState)}
             pageable={true}
             sortable={true}
             style={{ height: '400px' }}
          >
            <Column field="id" title="Household ID" width="140px" />
            <Column field="familySize" title="Size" width="80px" />
            <Column field="program" title="Program" width="320px" />
            <Column field="annualIncome" title="Annual Income" width="160px" cell={CurrencyCell} />
            <Column field="threshold" title="Income Threshold" width="180px" cell={CurrencyCell} />
            <Column field="overPct" title="Over Limit %" width="140px" cell={Percent4Cell} />
          </Grid>
          {missGridData.length === 0 && (
            <div style={{ marginTop: '0.5rem', color: '#64748b' }}>
              No near-miss cases within 0–5% over the program income threshold.
            </div>
          )}
        </div>
      </div>

      {/* Adults Not Enrolled in Pathways */}
      <div className="grids-grid">
        <div className="card grid-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="card-title">Pathways: Adults 19–64 Not Enrolled</h3>
          <Grid
            data={process(pathwaysAdultsNotEnrolled.map(r => ({
              ssn: safeVal(r.ssn),
              first: safeVal(r.first),
              last: safeVal(r.last),
              age: Number(safeVal(r.age) || 0)
            })), { skip: 0, take: 10 })}
            pageable={true}
            sortable={true}
            style={{ height: '400px', width: '100%' }}
          >
            <Column field="ssn" title="SSN" />
            <Column field="first" title="First" />
            <Column field="last" title="Last" />
            <Column field="age" title="Age" />
          </Grid>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
