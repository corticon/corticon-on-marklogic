// ui/src/components/DriverDetails.jsx
import React, { useState } from 'react';

const YesNo = ({ value }) => (
  <span className={value ? 'text-success' : 'text-danger'}>
    {value ? 'Yes' : 'No'}
  </span>
);

const FinancialsList = ({ items }) => {
  if (!items || items.length === 0) return <li>None</li>;
  return items.map((item, i) => (
    <li key={i}>
      {item.category || item.description}: <strong>{item.value * 100}%</strong>
    </li>
  ));
};

export default function DriverDetails({ driver }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!driver) return null;

  return (
    <div className="accordion-item">
      <div className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <h4>{driver.first} {driver.last}</h4>
        <span className={`carrot ${isOpen ? 'open' : ''}`}>&#9660;</span>
      </div>
      {isOpen && (
        <div className="accordion-content">
          <div className="details-grid">
            <div><strong>Date of Birth:</strong> {driver.dob}</div>
            <div><strong>Age:</strong> {driver.age}</div>
            <div><strong>Year Licensed:</strong> {driver.yearLicensed}</div>
            <div><strong>Full-Time Student:</strong> <YesNo value={driver.fullTimeStudent} /></div>
            {driver.gpa && <div><strong>GPA:</strong> {driver.gpa} ({driver.gradeAverage})</div>}
          </div>
          
          <div className="sub-section">
            <h5>Incidents ({driver.incidents.length})</h5>
            <ul>
              {driver.incidents.length > 0 ? (
                driver.incidents.map((incident, i) => (
                  <li key={i}>{incident.incidentType} ({incident.date})</li>
                ))
              ) : <li>None</li>}
            </ul>
          </div>

          <div className="details-grid">
              <div className="sub-section">
                <h5>Discounts</h5>
                <ul>
                  <FinancialsList items={driver.discount} />
                </ul>
              </div>
              <div className="sub-section">
                <h5>Surcharges</h5>
                <ul>
                  <FinancialsList items={driver.surcharge} />
                </ul>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}