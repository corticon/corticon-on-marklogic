// ui/src/components/DecisionLog.jsx
import React from 'react';

const severityBadge = (severity) => {
  switch (severity) {
    case 'Info':
      return <span className="severity-badge severity-info">Info</span>;
    case 'Warning':
      return <span className="severity-badge severity-warning">Warning</span>;
    case 'Violation':
      return <span className="severity-badge severity-danger">Violation</span>;
    default:
      return <span className="severity-badge">{severity}</span>;
  }
};

export default function DecisionLog({ messages }) {
  if (!messages || messages.length === 0) {
    return <p>No decision log messages.</p>;
  }

  return (
    <div className="decision-log-table">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule Sheet</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {messages.map((msg, index) => (
            <tr key={index} className={`severity-${msg.severity.toLowerCase()}`}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{severityBadge(msg.severity)}</td>
              <td className="px-6 py-4 text-sm text-gray-500">{msg.rule}</td>
              <td className="px-6 py-4 text-sm text-gray-500">{msg.ruleSheet}</td>
              <td className="px-6 py-4 text-sm text-gray-500 break-words">{msg.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}