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
          mlService.getNearMissIncomeStats()
        ]);

        setProgramStats(results[0].status === 'fulfilled' ? results[0].value : []);
        setDemographicStats(results[1].status === 'fulfilled' ? results[1].value : []);
        setRuleStats(results[2].status === 'fulfilled' ? results[2].value : []);
        setNearMissStats(results[3].status === 'fulfilled' ? results[3].value : []);
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
  const programChartData = {
    labels: programStats.map(d => safeVal(d.Program_Name)),
    datasets: [
      {
        label: 'Failed Income Test',
        data: programStats.map(d => safeVal(d.Failed_Income_Test)),
        backgroundColor: '#ef4444', // Red
        stack: 'Stack 0',
      },
      {
        label: 'Failed Resource Test',
        data: programStats.map(d => safeVal(d.Failed_Resource_Test)),
        backgroundColor: '#f97316', // Orange
        stack: 'Stack 0',
      },
       {
        label: 'Passed / Other',
        data: programStats.map(d => safeVal(d.Total_Evaluated) - safeVal(d.Failed_Income_Test) - safeVal(d.Failed_Resource_Test)),
        backgroundColor: '#10b981', // Green
        stack: 'Stack 0',
      },
    ],
  };

  const demographicChartData = {
    labels: demographicStats.map(d => safeVal(d.Demographic_Group)),
    datasets: [{
      data: demographicStats.map(d => safeVal(d.Enrollment_Count)),
      backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
      borderWidth: 1,
    }],
  };

  // --- Kendo Grid Data Preparation ---
  const ruleGridData = ruleStats.map(r => ({
      rulesheet: cleanRulesheet(r.rulesheetName),
      entity: safeVal(r.entityName),
      attribute: safeVal(r.attributeName),
      count: Number(safeVal(r.Firing_Count))
  }));

  const missGridData = nearMissStats.map(m => ({
      id: safeVal(m.householdId),
      fpl: (Number(safeVal(m.householdPercentFPL)) * 100).toFixed(1) + '%',
      income: `$${Number(safeVal(m.monthlyIncome)).toLocaleString()}`,
      program: safeVal(m.Program_Denied_Income)
  }));

  return (
    <div className="analytics-panel">
      <h2 className="analytics-title">Medicaid Program Insight Dashboard</h2>

      {/* Top Row: Charts */}
      <div className="charts-grid">
        <div className="card chart-card">
          <h3 className="card-title">Eligibility Test Outcomes</h3>
          <div className="chart-wrapper">
            <Bar
              data={programChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
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
          <h3 className="card-title">"Near Miss" Income Cases</h3>
          <Grid
             data={process(missGridData, missGridState)}
             {...missGridState}
             onDataStateChange={(e) => setMissGridState(e.dataState)}
             pageable={true}
             sortable={true}
             style={{ height: '400px' }}
          >
            <Column field="id" title="Household ID" width="140px" />
            <Column field="fpl" title="FPL %" width="100px" />
            <Column field="income" title="Monthly Inc." width="140px" />
            <Column field="program" title="Denied Program" />
          </Grid>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;