// ui/src/components/ExecutionTrace.jsx
import React from 'react';
import { DataGrid } from 'ml-fasttrack';

// Helper function to extract the rulesheet name from the file path
const getRulesheetNameFromPath = (fullPath) => {
  if (typeof fullPath !== 'string') return '';
  const parts = fullPath.split('/');
  const filenameWithExt = parts[parts.length - 1];
  if (!filenameWithExt) return '';
  const filenameParts = filenameWithExt.split('.');
  return filenameParts[0];
};

// Define columns for each type of change
const attributeColumns = [
  { 
    field: 'rulesheetName', 
    title: 'Rulesheet', 
    cell: (props) => <td>{getRulesheetNameFromPath(props.value)}</td> 
  },
  { field: 'ruleNumber', title: 'Rule #' },
  { field: 'entityCorticonId', title: 'Entity ID' },
  { field: 'entityName', title: 'Entity Name' },
  { field: 'attributeName', title: 'Attribute Name' },
  { 
    field: 'beforeValue', 
    title: 'Before Value', 
    cell: (props) => <td className="break-all"><pre>{JSON.stringify(props.value, null, 2)}</pre></td> 
  },
  { 
    field: 'afterValue', 
    title: 'After Value', 
    cell: (props) => <td className="break-all"><pre>{JSON.stringify(props.value, null, 2)}</pre></td> 
  },
  { field: 'sequence', title: 'Sequence' },
];

const associationColumns = [
  { 
    field: 'rulesheetName', 
    title: 'Rulesheet', 
    cell: (props) => <td>{getRulesheetNameFromPath(props.value)}</td> 
  },
  { field: 'ruleNumber', title: 'Rule #' },
  { field: 'sourceEntityCorticonId', title: 'Source Entity ID' },
  { field: 'sourceEntityName', title: 'Source Entity Name' },
  { field: 'associationRoleName', title: 'Association' },
  { field: 'targetEntityCorticonId', title: 'Target Entity ID' },
  { field: 'targetEntityName', title: 'Target Entity Name' },
  { field: 'action', title: 'Action' },
  { field: 'sequence', title: 'Sequence' },
];

const entityColumns = [
  { 
    field: 'rulesheetName', 
    title: 'Rulesheet', 
    cell: (props) => <td>{getRulesheetNameFromPath(props.value)}</td> 
  },
  { field: 'ruleNumber', title: 'Rule #' },
  { field: 'entityCorticonId', title: 'Entity ID' },
  { field: 'entityName', title: 'Entity Name' },
  { field: 'action', title: 'Action' },
  { field: 'sequence', title: 'Sequence' },
];

export default function ExecutionTrace({ metrics }) {
  if (!metrics) {
    return <p>No execution trace available.</p>;
  }

  const { attributeChanges, associationChanges, entityChanges } = metrics;

  return (
    <div>
      <h4>Attribute Changes</h4>
      {attributeChanges && attributeChanges.length > 0 ? (
        <DataGrid data={attributeChanges} columns={attributeColumns} />
      ) : (
        <p>No attribute changes.</p>
      )}

      <h4 className="mt-8">Association Changes</h4>
      {associationChanges && associationChanges.length > 0 ? (
        <DataGrid data={associationChanges} columns={associationColumns} />
      ) : (
        <p>No association changes.</p>
      )}

      <h4 className="mt-8">Entity Changes</h4>
      {entityChanges && entityChanges.length > 0 ? (
        <DataGrid data={entityChanges} columns={entityColumns} />
      ) : (
        <p>No entity changes.</p>
      )}
    </div>
  );
}