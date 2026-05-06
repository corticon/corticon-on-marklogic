// ui/src/components/ExecutionTrace.jsx
import React from 'react';
import { Grid, GridColumn as Column } from '@progress/kendo-react-grid';
import '@progress/kendo-theme-default/dist/all.css';

// Helper function to extract the rulesheet name from the file path
const getRulesheetNameFromPath = (fullPath) => {
  if (typeof fullPath !== 'string') return '';
  const parts = fullPath.split('/');
  const filenameWithExt = parts[parts.length - 1];
  if (!filenameWithExt) return '';
  const filenameParts = filenameWithExt.split('.');
  return filenameParts[0];
};


export default function ExecutionTrace({ metrics }) {
  // Custom cell component using Grid-level cells prop
  const CustomDataCell = (props) => {
    const { field, dataItem } = props;
    
    // Type badge styling
    if (field === 'type') {
      const type = dataItem[field];
      let badgeClass = "type-badge";
      
      if (type === 'Attribute') {
        badgeClass += " type-attribute";
      } else if (type === 'Entity') {
        badgeClass += " type-entity";
      } else if (type === 'Association') {
        badgeClass += " type-association";
      }
      
      return (
        <td {...props.tdProps}>
          <span className={badgeClass}>{type}</span>
        </td>
      );
    }
    
    // Rulesheet name extraction
    if (field === 'rulesheetName') {
      const value = dataItem[field];
      return (
        <td {...props.tdProps}>
          {getRulesheetNameFromPath(value)}
        </td>
      );
    }
    
    // JSON formatting for before/after values
    if (field === 'beforeValueString' || field === 'afterValueString') {
      // Get the original value (not the stringified version)
      const originalField = field === 'beforeValueString' ? 'beforeValue' : 'afterValue';
      const value = dataItem[originalField];
      if (value === undefined || value === null) {
        return <td {...props.tdProps}></td>;
      }
      return (
        <td {...props.tdProps} className="break-all">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.8em' }}>
            {JSON.stringify(value, null, 2)}
          </pre>
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

  if (!metrics) {
    return <p>No execution trace available.</p>;
  }

  const { attributeChanges, associationChanges, entityChanges } = metrics;

  // Combine all changes into a single list with stringified values for sorting/filtering
  const allChanges = React.useMemo(() => {
    const attributes = (attributeChanges || []).map(item => ({ 
      ...item, 
      type: 'Attribute',
      primaryEntityName: item.entityName,
      propertyName: item.attributeName,
      beforeValueString: item.beforeValue !== undefined && item.beforeValue !== null 
        ? JSON.stringify(item.beforeValue) 
        : '',
      afterValueString: item.afterValue !== undefined && item.afterValue !== null 
        ? JSON.stringify(item.afterValue) 
        : ''
    }));
    const associations = (associationChanges || []).map(item => ({ 
      ...item, 
      type: 'Association',
      primaryEntityName: item.sourceEntityName,
      propertyName: item.associationRoleName,
      beforeValueString: item.beforeValue !== undefined && item.beforeValue !== null 
        ? JSON.stringify(item.beforeValue) 
        : '',
      afterValueString: item.afterValue !== undefined && item.afterValue !== null 
        ? JSON.stringify(item.afterValue) 
        : ''
    }));
    const entities = (entityChanges || []).map(item => ({ 
      ...item, 
      type: 'Entity',
      primaryEntityName: item.entityName,
      propertyName: '',
      beforeValueString: item.beforeValue !== undefined && item.beforeValue !== null 
        ? JSON.stringify(item.beforeValue) 
        : '',
      afterValueString: item.afterValue !== undefined && item.afterValue !== null 
        ? JSON.stringify(item.afterValue) 
        : ''
    }));
    return [...attributes, ...associations, ...entities];
  }, [attributeChanges, associationChanges, entityChanges]);

  if (allChanges.length === 0) {
     return <p>No execution trace changes recorded.</p>;
  }

  return (
    <div className="execution-trace-container">
      <h4 className="text-lg font-semibold mb-2">Execution Trace</h4>
      <Grid
        data={allChanges}
        dataItemKey="sequence"
        autoProcessData={true}
        defaultSort={[{ field: 'sequence', dir: 'asc' }]}
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
        <Column field="type" title="Type" width="120px" />
        <Column field="sequence" title="Seq" width="80px" filter="numeric" />
        <Column field="rulesheetName" title="Rulesheet" width="200px" />
        <Column field="ruleNumber" title="Rule #" width="100px" />
        <Column field="primaryEntityName" title="Entity" width="150px" />
        <Column field="propertyName" title="Attribute/Association" width="200px" />
        <Column field="targetEntityName" title="Target Entity" width="150px" />
        <Column field="beforeValueString" title="Before" width="200px" />
        <Column field="afterValueString" title="After" width="200px" />
        <Column field="action" title="Action" width="100px" />
      </Grid>
    </div>
  );
}