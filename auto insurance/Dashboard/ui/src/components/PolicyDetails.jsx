// ui/src/components/PolicyDetails.jsx
import React from 'react';
import VehicleDetails from './VehicleDetails';
import DriverDetails from './DriverDetails';

const YesNo = ({ value }) => (
  <span className={value ? 'text-success' : 'text-danger'}>
    {value ? 'Yes' : 'No'}
  </span>
);

export default function PolicyDetails({ policy }) {
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

  return (
    <div className="policy-details-container">
      <div className="policy-header">
        <div>
          <h2>Policy Details: <a href={`/policy/${applicationId}`}>{applicationId}</a></h2>
          <h3>{familyName} Family • {state}</h3>
        </div>
        <div className="net-premium-display">
          <span>Net Premium</span>
          <p>${netPremium ? netPremium.toLocaleString() : '—'}</p>
        </div>
      </div>

      <div className="details-section">
        <h4>Policy Summary</h4>
        <div className="details-grid policy-summary">
          <div><strong>Customer Since:</strong> {customerSince}</div>
          <div><strong>Payment Plan:</strong> {paymentPlan}</div>
          <div><strong>Multi-Car Policy:</strong> <YesNo value={policy.payload[0].isMultiCar} /></div>
          <div><strong>Home Policy Bundle:</strong> <YesNo value={policy.payload[0].hasHomePolicy} /></div>
          <div><strong>Paperless Billing:</strong> <YesNo value={policy.payload[0].isPaperless} /></div>
          <div>
            <strong>Policy Discounts:</strong>
            {discount.map(d => `${d.category} (${d.value * 100}%)`).join(', ')}
          </div>
        </div>
      </div>

      <div className="details-section">
        <h4>Drivers ({drivers.length})</h4>
        <div className="accordion">
          {drivers.map((driver, i) => (
            <DriverDetails key={i} driver={driver} />
          ))}
        </div>
      </div>

      <div className="details-section">
        <h4>Vehicles ({vehicles.length})</h4>
        <div className="accordion">
          {vehicles.map((vehicle, i) => (
            <VehicleDetails key={i} vehicle={vehicle} />
          ))}
        </div>
      </div>
    </div>
  );
}