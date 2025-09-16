// ui/src/components/VehicleDetails.jsx
import React, { useState } from 'react';

const FeatureList = ({ vehicle }) => {
    const features = [
        { label: 'ABS', value: vehicle.abs },
        { label: 'Backup Camera', value: vehicle.backupCam },
        // ... (add all other features here)
        { label: 'Traction Control', value: vehicle.tractionControl }
    ].filter(f => f.value === 'Standard');

    if (features.length === 0) return <p>No special safety features listed.</p>;

    return (
        <ul className="feature-list">
            {features.map(f => <li key={f.label}>{f.label}</li>)}
        </ul>
    );
};

export default function VehicleDetails({ vehicle }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!vehicle) return null;

  return (
    <div className="accordion-item">
      <div className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <h4>{vehicle.make} {vehicle.model}</h4>
        <span className={`carrot ${isOpen ? 'open' : ''}`}>&#9660;</span>
      </div>
      {isOpen && (
        <div className="accordion-content">
          <div className="details-grid">
            <div><strong>Year:</strong> {vehicle.modelYear}</div>
            <div><strong>Type:</strong> {vehicle.type}</div>
          </div>

          <div className="sub-section">
              <h5>Safety & Anti-Theft</h5>
              <FeatureList vehicle={vehicle} />
          </div>

          <div className="sub-section">
              <h5>Coverages (Net Premium: ${vehicle.netPremium.toLocaleString()})</h5>
              <table className="coverage-table">
                {/* ... (table content from previous response) */}
              </table>
          </div>
        </div>
      )}
    </div>
  );
}