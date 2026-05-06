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
      <div className="policy-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div className="policy-title-box">
            {familyName ? `${familyName} Family Policy` : 'Untitled'}
        </div>
        
        <div className="policy-details-row" style={{ display: 'flex', alignItems: 'center', flexGrow: 1, justifyContent: 'flex-end', gap: '15px' }}>
          <div className="premium-box">
            <span className="label">ID:</span>
            <span className="value">{applicationId || '—'}</span>
          </div>
          
          <div className="premium-box">
            <span className="label">State:</span>
            <span className="value">{state || '—'}</span>
          </div>
          
          <div className="premium-box">
            <span className="label">Net Premium:</span>
            <span className="value">
              {netPremium ? `$${netPremium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}