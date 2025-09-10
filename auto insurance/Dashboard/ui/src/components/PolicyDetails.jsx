// ui/src/components/PolicyDetails.jsx
import React, { useState } from 'react';
import DriversTable from './DriversTable';
import VehiclesTable from './VehiclesTable';
import DecisionLog from './DecisionLog';
import ExecutionTrace from './ExecutionTrace';
import AccordionItem from './AccordionItem';

const YesNo = ({ value }) => (
  <span className={value ? 'text-success' : 'text-danger'}>
    {value ? 'Yes' : 'No'}
  </span>
);

export default function PolicyDetails({ policy }) {
  const [activeTab, setActiveTab] = useState('details');

  if (!policy) return null;

  const {
    applicationId,
    familyName,
    customerSince,
    paymentPlan,
    state,
    vehicles = [],
    drivers = [],
    discount = [],
    netPremium,
  } = policy.payload[0];

  const corticon = policy.corticon;

  return (
    <div className="policy-details-container">
      <div className="policy-header">
        <div>
          <h2>Policy Details: <a href={`/policy/${applicationId}`}>{applicationId}</a></h2>
          <h3 className="text-2xl font-bold text-gray-800">{familyName} Family • {state}</h3>
        </div>
        <div className="net-premium-display">
          <span>Net Premium</span>
          <p className="text-3xl font-bold">${netPremium ? netPremium.toLocaleString() : '—'}</p>
        </div>
      </div>

      <div className="tabs">
        <button className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>Policy Details</button>
        <button className={activeTab === 'log' ? 'active' : ''} onClick={() => setActiveTab('log')}>Decision Log</button>
        <button className={activeTab === 'trace' ? 'active' : ''} onClick={() => setActiveTab('trace')}>Execution Trace</button>
      </div>

      {activeTab === 'details' && (
        <div className="accordion">
          <AccordionItem title="Policy Summary">
            <div className="details-grid policy-summary">
              <div><strong>Customer Since:</strong> {customerSince}</div>
              <div><strong>Payment Plan:</strong> {paymentPlan}</div>
              <div><strong>Multi-Car Policy:</strong> <YesNo value={policy.payload[0].isMultiCar} /></div>
              <div><strong>Home Policy Bundle:</strong> <YesNo value={policy.payload[0].hasHomePolicy} /></div>
              <div><strong>Paperless Billing:</strong> <YesNo value={policy.payload[0].isPaperless} /></div>
              <div>
                <strong>Policy Discounts:</strong>
                <ul>
                  {discount.map(d => <li key={d.category}>{`${d.category} (${d.value * 100}%)`}</li>)}
                </ul>
              </div>
            </div>
          </AccordionItem>

          <AccordionItem title={`Drivers (${drivers.length})`}>
            <DriversTable drivers={drivers} />
          </AccordionItem>

          <AccordionItem title={`Vehicles (${vehicles.length})`}>
            <VehiclesTable vehicles={vehicles} />
          </AccordionItem>
        </div>
      )}

      {activeTab === 'log' && (
        <DecisionLog messages={corticon.messages.message} />
      )}

      {activeTab === 'trace' && (
        <ExecutionTrace metrics={corticon.Metrics} />
      )}
    </div>
  );
}