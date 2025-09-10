// ui/src/components/ExecutionTrace.jsx
import React from 'react';

export default function ExecutionTrace({ metrics }) {
  if (!metrics) {
    return <p>No execution trace available.</p>;
  }

  const { attributeChanges, associationChanges, entityChanges } = metrics;

  return (
    <div>
      <h4>Attribute Changes</h4>
      {attributeChanges && attributeChanges.length > 0 ? (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sequence</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rulesheet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attribute</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Before</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">After</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {attributeChanges.map((change, index) => (
              <tr key={index}>
                <td className="px-6 py-4 text-sm text-gray-500">{change.sequence}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.rulesheetName}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.ruleNumber}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.entityName} ({change.entityCorticonId})</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.attributeName}</td>
                <td className="px-6 py-4 text-sm text-gray-500 break-all"><pre>{JSON.stringify(change.beforeValue, null, 2)}</pre></td>
                <td className="px-6 py-4 text-sm text-gray-500 break-all"><pre>{JSON.stringify(change.afterValue, null, 2)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No attribute changes.</p>
      )}

      <h4 className="mt-8">Association Changes</h4>
      {associationChanges && associationChanges.length > 0 ? (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sequence</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rulesheet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source Entity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Association</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Entity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {associationChanges.map((change, index) => (
              <tr key={index}>
                <td className="px-6 py-4 text-sm text-gray-500">{change.sequence}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.rulesheetName}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.ruleNumber}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.sourceEntityName} ({change.sourceEntityCorticonId})</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.associationRoleName}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.targetEntityName} ({change.targetEntityCorticonId})</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No association changes.</p>
      )}

      <h4 className="mt-8">Entity Changes</h4>
      {entityChanges && entityChanges.length > 0 ? (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sequence</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rulesheet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entityChanges.map((change, index) => (
              <tr key={index}>
                <td className="px-6 py-4 text-sm text-gray-500">{change.sequence}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.rulesheetName}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.ruleNumber}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.entityName} ({change.entityCorticonId})</td>
                <td className="px-6 py-4 text-sm text-gray-500">{change.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No entity changes.</p>
      )}
    </div>
  );
}
