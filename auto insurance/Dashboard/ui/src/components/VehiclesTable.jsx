// ui/src/components/VehiclesTable.jsx
import React from 'react';

export default function VehiclesTable({ vehicles }) {
  if (!vehicles || vehicles.length === 0) {
    return <p>No vehicles listed on this policy.</p>;
  }

  return (
    <table className="min-w-full table-auto divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Premium</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {vehicles.map((vehicle, index) => (
          <tr key={index} className="odd:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{vehicle.make} {vehicle.model}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{vehicle.modelYear}</td>
            <td className="px-6 py-4 text-sm text-gray-500">{vehicle.type}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">${vehicle.netPremium.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
