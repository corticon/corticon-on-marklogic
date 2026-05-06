// src/components/DriversTable.jsx
import React from 'react';
import { Grid, GridColumn as Column } from '@progress/kendo-react-grid';
import '@progress/kendo-theme-default/dist/all.css';

export default function DriversTable({ drivers }) {
  // Custom cell component using Grid-level cells prop
  const CustomDataCell = (props) => {
    const { field, dataItem } = props;
    
    // Incidents rendering
    if (field === 'incidents') {
      const incidents = dataItem.incidents;
      return (
        <td {...props.tdProps}>
          {incidents && incidents.length > 0 ? (
            incidents.map((inc, i) => <div key={i}>{inc.incidentType}</div>)
          ) : (
            'None'
          )}
        </td>
      );
    }
    
    // Discounts rendering
    if (field === 'discounts') {
      const discounts = dataItem.discount;
      return (
        <td {...props.tdProps}>
          {discounts && discounts.length > 0 ? (
            discounts.map((d, i) => <div key={i}>{d.category}</div>)
          ) : (
            'None'
          )}
        </td>
      );
    }
    
    // Default rendering for other fields
    return (
      <td {...props.tdProps}>
        {dataItem[field]}
      </td>
    );
  };

  if (!drivers || drivers.length === 0) {
    return <p>No drivers listed for this policy.</p>;
  }

  return (
    <div className="table-container">
      <Grid
        data={drivers}
        dataItemKey="first"
        autoProcessData={true}
        defaultSort={[{ field: 'first', dir: 'asc' }]}
        sortable={true}
        filterable={true}
        pageable={{
          buttonCount: 5,
          info: true,
          pageSizes: [5, 10, 20],
          previousNext: true
        }}
        style={{ height: '600px' }}
        cells={{ data: CustomDataCell }}
      >
        <Column field="first" title="First Name" width="150px" />
        <Column field="last" title="Last Name" width="150px" />
        <Column field="age" title="Age" width="100px" filter="numeric" />
        <Column field="yearLicensed" title="Year Licensed" width="150px" filter="numeric" />
        <Column field="incidents" title="Incidents" filterable={false} sortable={false} />
        <Column field="discounts" title="Discounts & Surcharges" filterable={false} sortable={false} />
      </Grid>
    </div>
  );
}