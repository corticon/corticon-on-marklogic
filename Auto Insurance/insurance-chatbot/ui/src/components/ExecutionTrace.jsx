import { DataGrid } from "ml-fasttrack";

function getRulesheetName(fullPath) {
  if (typeof fullPath !== "string") {
    return "";
  }

  const parts = fullPath.split("/");
  const filename = parts[parts.length - 1] || "";
  return filename.split(".")[0] || filename;
}

const attributeColumns = [
  { field: "sequence", title: "Sequence" },
  {
    field: "rulesheetName",
    title: "Rulesheet",
    cell: (props) => <td>{getRulesheetName(props.dataItem.rulesheetName)}</td>
  },
  { field: "entityName", title: "Entity" },
  { field: "attributeName", title: "Attribute" },
  { field: "beforeValue", title: "Before" },
  { field: "afterValue", title: "After" }
];

const associationColumns = [
  { field: "sequence", title: "Sequence" },
  {
    field: "rulesheetName",
    title: "Rulesheet",
    cell: (props) => <td>{getRulesheetName(props.dataItem.rulesheetName)}</td>
  },
  { field: "sourceEntityName", title: "Source" },
  { field: "associationRoleName", title: "Association" },
  { field: "targetEntityName", title: "Target" },
  { field: "action", title: "Action" }
];

const entityColumns = [
  { field: "sequence", title: "Sequence" },
  {
    field: "rulesheetName",
    title: "Rulesheet",
    cell: (props) => <td>{getRulesheetName(props.dataItem.rulesheetName)}</td>
  },
  { field: "entityName", title: "Entity" },
  { field: "entityCorticonId", title: "Entity ID" },
  { field: "action", title: "Action" }
];

export default function ExecutionTrace({ metrics }) {
  if (!metrics) {
    return <div className="widget-panel placeholder-panel">No execution trace available.</div>;
  }

  const attributeChanges = metrics.attributeChanges || [];
  const associationChanges = metrics.associationChanges || [];
  const entityChanges = metrics.entityChanges || [];

  return (
    <section className="trace-stack">
      <div className="stat-grid stat-grid--trace">
        <div className="stat-card accent-blue">
          <span className="stat-label">Attribute changes</span>
          <strong>{attributeChanges.length}</strong>
        </div>
        <div className="stat-card accent-gold">
          <span className="stat-label">Association changes</span>
          <strong>{associationChanges.length}</strong>
        </div>
        <div className="stat-card accent-green">
          <span className="stat-label">Entity changes</span>
          <strong>{entityChanges.length}</strong>
        </div>
      </div>

      <section className="widget-panel">
        <div className="widget-heading compact">
          <div>
            <h3>Attribute changes</h3>
            <p>Property-level mutations applied by the rules execution.</p>
          </div>
        </div>
        <DataGrid data={attributeChanges} gridColumns={attributeColumns} GridProps={{ sortable: true, resizable: true, style: { maxHeight: 380 } }} />
      </section>

      <section className="widget-panel">
        <div className="widget-heading compact">
          <div>
            <h3>Association changes</h3>
            <p>Relationship changes created by rules during the decision flow.</p>
          </div>
        </div>
        <DataGrid data={associationChanges} gridColumns={associationColumns} GridProps={{ sortable: true, resizable: true, style: { maxHeight: 320 } }} />
      </section>

      <section className="widget-panel">
        <div className="widget-heading compact">
          <div>
            <h3>Entity changes</h3>
            <p>New entities and entity-level actions emitted during execution.</p>
          </div>
        </div>
        <DataGrid data={entityChanges} gridColumns={entityColumns} GridProps={{ sortable: true, resizable: true, style: { maxHeight: 280 } }} />
      </section>
    </section>
  );
}