// src/components/PolicyCard.jsx

export default function PolicyCard({ policyData, onSelect }) {
  if (!policyData) {
    return null;
  }
  const { familyName, applicationId, state, netPremium } = policyData;

  // Add a special class if the card is selectable
  const cardClassName = `policy-card ${onSelect ? 'is-selectable' : ''}`;

  return (
    <div className={cardClassName} onClick={onSelect}>
      <div className="policy-header">
        <h2>{familyName ? `${familyName} Family Policy` : 'Untitled'}</h2>
        <div className="policy-meta">
          <span>ID: {applicationId || '—'}</span>
          <span className="separator">•</span>
          <span>State: {state || '—'}</span>
        </div>
      </div>
      <div className="policy-body">
        <div className="premium-display">
          <span className="label">Net Premium:</span>
          <span className="value">
            {netPremium ? `$${netPremium.toFixed(2)}` : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}