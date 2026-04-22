import { DataGrid } from "ml-fasttrack";
import { getMessageSeveritySummary, normalizeList } from "../utils/policyUtils";

function SeverityCell({ severity }) {
  const tone = String(severity || "info").toLowerCase();
  return <span className={`severity-pill severity-pill--${tone}`}>{severity || "Info"}</span>;
}

const gridColumns = [
  {
    field: "severity",
    title: "Severity",
    cell: (props) => <td><SeverityCell severity={props.dataItem.severity} /></td>
  },
  { field: "ruleSheet", title: "Rulesheet" },
  { field: "rule", title: "Rule" },
  { field: "text", title: "Message" }
];

export default function DecisionLog({ messages }) {
  const rows = normalizeList(messages);
  const severity = getMessageSeveritySummary(rows);

  if (rows.length === 0) {
    return <div className="widget-panel placeholder-panel">No decision log messages.</div>;
  }

  return (
    <section className="widget-panel">
      <div className="widget-heading compact">
        <div>
          <h3>Decision log</h3>
          <p>Readable rule outcomes with severity counts surfaced above the full log.</p>
        </div>
      </div>

      <div className="severity-summary-row">
        <div><span>Info</span><strong>{severity.info}</strong></div>
        <div><span>Warning</span><strong>{severity.warning}</strong></div>
        <div><span>Violation</span><strong>{severity.violation}</strong></div>
      </div>

      <DataGrid
        data={rows}
        gridColumns={gridColumns}
        GridProps={{ sortable: true, resizable: true, style: { maxHeight: 520 } }}
      />
    </section>
  );
}