// ui/src/components/ExecutionTrace.jsx
import React from 'react';

// Helper: extract a friendly rulesheet name from a file path
const getRulesheetNameFromPath = (fullPath) => {
  if (typeof fullPath !== 'string') return '';
  const parts = fullPath.split('/');
  const filenameWithExt = parts[parts.length - 1] || '';
  return filenameWithExt.split('.')[0] || filenameWithExt;
};

// Render a compact table (non-virtualized) so anchors always exist in DOM
const Table = ({ columns, rows, anchorField = 'sequence' }) => (
  <div style={{ maxHeight: 420, overflowY: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}>
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {columns.map((c, i) => (
            <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              {c.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-100">
        {rows.map((r, idx) => (
          <tr key={idx} id={anchorField && r?.[anchorField] != null ? `trace-seq-${r[anchorField]}` : undefined}>
            {columns.map((c, ci) => (
              <td key={ci} className="px-3 py-2 text-sm text-gray-700 align-top">
                {c.render ? c.render(r[c.field], r) : String(r[c.field] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function ExecutionTrace({ metrics, targetSequence }) {
  if (!metrics) return <p>No execution trace available.</p>;
  const { attributeChanges = [], associationChanges = [], entityChanges = [] } = metrics;

  // When targetSequence changes, try to scroll the closest scrollable container
  React.useEffect(() => {
    if (!targetSequence) return;
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(`trace-seq-${targetSequence}`);
      if (el) {
        let scrollParent = el.parentElement;
        while (scrollParent && scrollParent !== document.body) {
          const style = window.getComputedStyle(scrollParent);
          if (/(auto|scroll)/.test(style.overflowY)) break;
          scrollParent = scrollParent.parentElement;
        }
        if (!scrollParent) scrollParent = window;
        const highlight = () => {
          el.classList.add('ring-2', 'ring-blue-400');
          setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 1600);
        };
        if (scrollParent === window) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlight();
        } else {
          const parentRect = scrollParent.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const currentTop = scrollParent.scrollTop;
          const delta = (elRect.top - parentRect.top) - (parentRect.height / 2 - elRect.height / 2);
          scrollParent.scrollTo({ top: currentTop + delta, behavior: 'smooth' });
          highlight();
        }
        return;
      }
      attempts += 1;
      if (attempts < 30) setTimeout(tryScroll, 100);
    };
    tryScroll();
  }, [targetSequence, attributeChanges.length, associationChanges.length, entityChanges.length]);

  return (
    <div>
      <h4>Attribute Changes</h4>
      {attributeChanges.length > 0 ? (
        <Table
          columns={[
            { title: 'Rulesheet', field: 'rulesheetName', render: (v) => getRulesheetNameFromPath(v) },
            { title: 'Rule #', field: 'ruleNumber' },
            { title: 'Entity ID', field: 'entityCorticonId' },
            { title: 'Entity Name', field: 'entityName' },
            { title: 'Attribute Name', field: 'attributeName' },
            { title: 'Before Value', field: 'beforeValue', render: (v) => <pre className="break-all">{JSON.stringify(v, null, 2)}</pre> },
            { title: 'After Value', field: 'afterValue', render: (v) => <pre className="break-all">{JSON.stringify(v, null, 2)}</pre> },
            { title: 'Sequence', field: 'sequence' },
          ]}
          rows={attributeChanges}
          anchorField="sequence"
        />
      ) : (
        <p>No attribute changes.</p>
      )}

      <h4 className="mt-8">Association Changes</h4>
      {associationChanges.length > 0 ? (
        <Table
          columns={[
            { title: 'Rulesheet', field: 'rulesheetName', render: (v) => getRulesheetNameFromPath(v) },
            { title: 'Rule #', field: 'ruleNumber' },
            { title: 'Source Entity ID', field: 'sourceEntityCorticonId' },
            { title: 'Source Entity Name', field: 'sourceEntityName' },
            { title: 'Association', field: 'associationRoleName' },
            { title: 'Target Entity ID', field: 'targetEntityCorticonId' },
            { title: 'Target Entity Name', field: 'targetEntityName' },
            { title: 'Action', field: 'action' },
            { title: 'Sequence', field: 'sequence' },
          ]}
          rows={associationChanges}
          anchorField="sequence"
        />
      ) : (
        <p>No association changes.</p>
      )}

      <h4 className="mt-8">Entity Changes</h4>
      {entityChanges.length > 0 ? (
        <Table
          columns={[
            { title: 'Rulesheet', field: 'rulesheetName', render: (v) => getRulesheetNameFromPath(v) },
            { title: 'Rule #', field: 'ruleNumber' },
            { title: 'Entity ID', field: 'entityCorticonId' },
            { title: 'Entity Name', field: 'entityName' },
            { title: 'Action', field: 'action' },
            { title: 'Sequence', field: 'sequence' },
          ]}
          rows={entityChanges}
          anchorField="sequence"
        />
      ) : (
        <p>No entity changes.</p>
      )}
    </div>
  );
}

