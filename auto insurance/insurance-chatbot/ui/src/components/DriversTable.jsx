// src/components/DriversTable.jsx

export default function DriversTable({ drivers }) {
  if (!drivers || drivers.length === 0) {
    return <p>No drivers listed for this policy.</p>;
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Age</th>
            <th>Licensed</th>
            <th>Incidents</th>
            <th>Discounts & Surcharges</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver, index) => (
            <tr key={index}>
              <td>{driver.first} {driver.last}</td>
              <td>{driver.age}</td>
              <td>{driver.yearLicensed}</td>
              <td>
                {driver.incidents?.map((inc, i) => (
                  <div key={i}>{inc.incidentType}</div>
                )) || 'None'}
              </td>
              <td>
                {/* FIX: Change 'discounts' to 'discount' */}
                {driver.discount?.map((d, i) => (
                  <div key={i}>{d.category}</div>
                )) || 'None'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}