// ui/src/components/DecisionLog.jsx
import React from 'react';
import { Grid, GridColumn as Column } from '@progress/kendo-react-grid';
import '@progress/kendo-theme-default/dist/all.css';

export default function DecisionLog({ messages }) {

  // Add unique IDs to messages for Kendo Grid
  const messagesWithIds = messages.map((msg, index) => ({
    ...msg,
    uniqueId: `${msg.severity || ''}-${msg.rule || ''}-${msg.ruleSheet || ''}-${msg.text || ''}-${index}`.replace(/\s+/g, '_').substring(0, 100)
  }));

  // Custom cell component using Grid-level cells prop
  const CustomDataCell = (props) => {
    const { field, dataItem } = props;
    
    // Only apply badge styling to severity field
    if (field === 'severity') {
      const severity = dataItem[field];
      let badgeClass = "severity-badge";
      
      if (severity === 'Info') {
        badgeClass += " severity-info";
      } else if (severity === 'Warning') {
        badgeClass += " severity-warning";
      } else if (severity === 'Violation') {
        badgeClass += " severity-danger";
      }
      
      return (
        <td {...props.tdProps}>
          <span className={badgeClass}>{severity}</span>
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

  if (!messages || messages.length === 0) {
    return <p>No decision log messages.</p>;
  }

  return (
    <div className="decision-log-grid">
      <Grid
        data={messagesWithIds}
        dataItemKey="uniqueId"
        autoProcessData={true}
        defaultSort={[{ field: 'severity', dir: 'asc' }]}
        sortable={true}
        filterable={true}
        pageable={{
          buttonCount: 5,
          info: true,
          pageSizes: [10, 20, 50],
          previousNext: true
        }}
        scrollable="virtual"
        style={{ height: '600px' }}
        resizable={true}
        cells={{ data: CustomDataCell }}
      >
        <Column field="severity" title="Severity" width="120px" />
        <Column field="rule" title="Rule" width="100px" />
        <Column field="ruleSheet" title="Rule Sheet" width="200px" />
        <Column field="text" title="Message" />
      </Grid>
    </div>
  );
}