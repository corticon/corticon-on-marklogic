// ui/src/components/VehiclesTable.jsx
import React from 'react';
import { Grid, GridColumn as Column } from '@progress/kendo-react-grid';
import { process } from '@progress/kendo-data-query';
import '@progress/kendo-theme-default/dist/all.css';

export default function VehiclesTable({ vehicles }) {
  const [dataState, setDataState] = React.useState({
    sort: [{ field: 'modelYear', dir: 'desc' }],
    skip: 0,
    take: 10,
    filter: { logic: "and", filters: [] }
  });

  if (!vehicles || vehicles.length === 0) {
    return <p>No vehicles listed on this policy.</p>;
  }

  // Currency Formatter
  const currencyCell = (props) => {
    const value = props.dataItem[props.field];
    return (
      <td style={{ textAlign: 'right' }}>
        {value ? `$${value.toLocaleString()}` : '$0'}
      </td>
    );
  };

  // Year aligned right
  const rightAlignCell = (props) => {
    return <td style={{ textAlign: 'right' }}>{props.dataItem[props.field]}</td>;
  }

  return (
    <div className="table-container">
      <Grid
        data={process(vehicles, dataState)}
        {...dataState}
        onDataStateChange={(e) => setDataState(e.dataState)}
        sortable={true}
        filterable={true}
        pageable={true}
        pageSize={10}
        style={{ height: '600px' }}
      >
        <Column field="modelYear" title="Year" width="100px" cell={rightAlignCell} filter="numeric" filterable={true} />
        <Column field="make" title="Make" width="150px" filterable={true} />
        <Column field="model" title="Model" width="150px" filterable={true} />
        <Column field="type" title="Type" width="150px" filterable={true} />
        <Column field="netPremium" title="Net Premium" cell={currencyCell} width="150px" headerClassName="k-text-right" filter="numeric" filterable={true} />
      </Grid>
    </div>
  );
}
