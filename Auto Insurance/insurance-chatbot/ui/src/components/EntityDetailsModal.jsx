import React from 'react';

export default function EntityDetailsModal({ isOpen, onClose, title, data, theme }) {
  if (!isOpen) return null;

  // Helper to format keys (camelCase to Title Case)
  const formatKey = (key) => {
    // Insert space before capital letters
    const withSpaces = key.replace(/([A-Z])/g, " $1");
    // Capitalize the first letter and trim
    return (withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)).trim();
  };

  // Helper to format values
  const formatValue = (value) => {
    if (value === null || value === 'null' || value === undefined) return '-';
    if (value === true || value === 'true') return 'Yes';
    if (value === false || value === 'false') return 'No';
    return String(value);
  };

  // Helper to render object properties recursively or simply
  const renderData = (obj) => {
    if (!obj) return <p>No details available.</p>;
    
    return (
      <table className="entity-details-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {Object.entries(obj).map(([key, value]) => {
             // Skip internal or complex objects for now if needed, or render them
             if (typeof value === 'object' && value !== null) {
                 return null; // Simplified view
             }
             return (
                <tr key={key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold', width: '40%' }}>{formatKey(key)}</td>
                  <td style={{ padding: '8px' }}>{formatValue(value)}</td>
                </tr>
             );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'var(--card-bg)',
        color: 'var(--text-primary)',
        padding: '20px',
        borderRadius: '8px',
        width: '500px',
        maxWidth: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 4px 6px var(--shadow-color)',
        border: '1px solid var(--border-color)'
      }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            &times;
          </button>
        </div>
        <div className="modal-body">
          {renderData(data)}
        </div>
        <div className="modal-footer" style={{ marginTop: '20px', textAlign: 'right' }}>
           <button 
             onClick={onClose}
             className="btn-primary"
           >
             Close
           </button>
        </div>
      </div>
    </div>
  );
}
