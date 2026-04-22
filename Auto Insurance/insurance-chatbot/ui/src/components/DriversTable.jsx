// src/components/DriversTable.jsx

import { DataGrid } from "ml-fasttrack";
import { getDriverRows } from "../utils/policyUtils";

const gridColumns = [
  { field: "name", title: "Driver" },
  { field: "segment", title: "Segment" },
  { field: "age", title: "Age" },
  { field: "licensed", title: "Licensed since" },
  { field: "incidentSummary", title: "Incident profile" },
  { field: "discounts", title: "Discounts" },
  { field: "surcharges", title: "Surcharges" }
];

export default function DriversTable({ drivers }) {
  const rows = getDriverRows(drivers);

  if (rows.length === 0) {
    return <div className="widget-panel placeholder-panel">No drivers listed for this policy.</div>;
  }

  return (
    <section className="widget-panel">
      <div className="widget-heading compact">
        <div>
          <h3>Driver roster</h3>
          <p>Underwriting-ready view of driver demographics, incidents, and applied adjustments.</p>
        </div>
      </div>

      <DataGrid
        data={rows}
        gridColumns={gridColumns}
        GridProps={{ sortable: true, resizable: true, style: { maxHeight: 520 } }}
      />
    </section>
  );
}