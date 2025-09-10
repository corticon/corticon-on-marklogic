// ui/src/components/DriversTable.jsx
import React from 'react';

export default function DriversTable({ drivers }) {
  if (!drivers || drivers.length === 0) {
    return <p>No drivers listed on this policy.</p>;
  }

  return (
    <table className="min-w-full table-auto divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Licensed</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Incidents</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discounts & Surcharges</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {drivers.map((driver, index) => (
          <tr key={index} className="odd:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{driver.first} {driver.last}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{driver.age}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{driver.yearLicensed}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{driver.incidents.length}</td>
            <td className="px-6 py-4 text-sm text-gray-500">
              <ul className="list-disc list-inside">
                {driver.discount?.map(d => <li key={d.category}>{d.category}</li>)}
                {driver.surcharge?.map(s => <li key={s.description}>{s.description}</li>)}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
