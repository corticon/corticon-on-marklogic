// src/components/PolicyDetails.jsx
import { useState } from 'react';
import PolicyCard from './PolicyCard';
import DriversTable from './DriversTable';
import VehiclesTable from './VehiclesTable';
import DecisionLog from './DecisionLog';
import ExecutionTrace from './ExecutionTrace';
import PolicyNetworkGraph from './PolicyNetworkGraph';

export default function PolicyDetails({ policy, theme }) {
  const [activeTab, setActiveTab] = useState('drivers');

  if (!policy || !policy.payload || !policy.payload[0]) {
    return <div className="text-gray-500">No policy details available.</div>;
  }

  const policyData = policy.payload[0];
  const { corticon } = policy;

  return (
    <div className="policy-details-container space-y-6 border rounded-md p-6 bg-white">
      <PolicyCard policyData={policyData} />

      {/* Tab container */}
      <div className="tab-container">
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === 'drivers' ? 'active' : ''}`}
            onClick={() => setActiveTab('drivers')}
          >
            Drivers
          </button>
          <button
            className={`tab-button ${activeTab === 'vehicles' ? 'active' : ''}`}
            onClick={() => setActiveTab('vehicles')}
          >
            Vehicles
          </button>
          <button
            className={`tab-button ${activeTab === 'log' ? 'active' : ''}`}
            onClick={() => setActiveTab('log')}
          >
            Decision Log
          </button>
          <button
            className={`tab-button ${activeTab === 'trace' ? 'active' : ''}`}
            onClick={() => setActiveTab('trace')}
          >
            Execution Trace
          </button>
          <button
            className={`tab-button ${activeTab === 'network' ? 'active' : ''}`}
            onClick={() => setActiveTab('network')}
          >
            Policy Network
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'drivers' && <DriversTable drivers={policyData.drivers} />}
          {activeTab === 'vehicles' && <VehiclesTable vehicles={policyData.vehicles} />}
          {activeTab === 'log' && <DecisionLog messages={corticon?.messages?.message} />}
          {activeTab === 'trace' && <ExecutionTrace metrics={corticon?.Metrics} />}
          {activeTab === 'network' && (
            <div className="network-graph-container">
              <PolicyNetworkGraph policy={policy} theme={theme} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}