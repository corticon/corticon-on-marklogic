import { DataGrid } from "ml-fasttrack";
import { formatCurrency, getVehicleRows } from "../utils/policyUtils";

const gridColumns = [
  { field: "label", title: "Vehicle" },
  { field: "bodyStyle", title: "Body style" },
  { field: "highTheft", title: "Theft profile" },
  { field: "coverageCount", title: "Coverages" },
  { field: "coverageSummary", title: "Coverage mix" },
  {
    field: "netPremium",
    title: "Net premium",
    cell: (props) => <td>{formatCurrency(props.dataItem.netPremium)}</td>
  }
];

export default function VehiclesTable({ vehicles }) {
  const rows = getVehicleRows(vehicles);

  if (rows.length === 0) {
    return <div className="widget-panel placeholder-panel">No vehicles listed on this policy.</div>;
  }

  return (
    <section className="widget-panel">
      <div className="widget-heading compact">
        <div>
          <h3>Vehicle exposure</h3>
          <p>Vehicle-level pricing, coverage, and theft-risk indicators for this policy.</p>
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
