import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import './JsonExplorer.css'

// ── Type helpers ─────────────────────────────────────────────────────────────

function getType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

// ── Flatten JSON tree → visible row array ────────────────────────────────────
// A single flat container means nth-child alternating stripes work at all depths.

// Sort an object's keys: primitive-valued fields alphabetically first,
// then nested objects/arrays alphabetically.
function sortedKeys(obj) {
  const isComplex = (v) => v !== null && (typeof v === 'object' || Array.isArray(v))
  const primitives = []
  const complex    = []
  Object.keys(obj).forEach(k => (isComplex(obj[k]) ? complex : primitives).push(k))
  primitives.sort()
  complex.sort()
  return [...primitives, ...complex]
}

function flattenTree(value, key, depth, expanded, rows, pathPrefix) {
  const type = getType(value)
  const path = pathPrefix ? `${pathPrefix}/${key}` : (key ?? 'root')

  if (type === 'object' && value !== null) {
    const keys = sortedKeys(value)
    const isOpen = expanded.has(path)
    rows.push({ kind: 'branch', type: 'object', path, depth, label: key, childCount: keys.length, isOpen })
    if (isOpen) {
      keys.forEach(k => flattenTree(value[k], k, depth + 1, expanded, rows, path))
      rows.push({ kind: 'close', type: 'object', path, depth, label: key })
    }
    return
  }

  if (type === 'array') {
    const isOpen = expanded.has(path)
    rows.push({ kind: 'branch', type: 'array', path, depth, label: key, childCount: value.length, isOpen })
    if (isOpen) {
      value.forEach((v, i) => {
        const itemType = getType(v)
        const itemPath = `${path}/${i}`
        if (itemType === 'object' && v !== null) {
          if (value.length === 1) {
            // Single-item array — inline the object's properties directly (no extra nesting)
            sortedKeys(v).forEach(k =>
              flattenTree(v[k], k, depth + 1, expanded, rows, itemPath)
            )
          } else {
            // Multi-item array — show each item as a labeled collapsible branch
            flattenTree(v, `[${i}]`, depth + 1, expanded, rows, path)
          }
        } else {
          flattenTree(v, String(i), depth + 1, expanded, rows, path)
        }
      })
      rows.push({ kind: 'close', type: 'array', path, depth, label: key })
    }
    return
  }

  rows.push({ kind: 'leaf', type, path, depth, label: key, value })
}

// ── Case-sensitive filter: prune tree, keep nodes whose key/value contains filter ─

function filterData(value, key, filter) {
  const keyStr = (key !== null && key !== undefined) ? String(key) : ''
  const keyIsNumeric = /^\d+$/.test(keyStr)
  const keyMatches = keyStr.length > 0 && !keyIsNumeric && keyStr.includes(filter)
  if (keyMatches) return value   // keep entire subtree when key matches

  const type = getType(value)

  if (type === 'object' && value !== null) {
    const filteredEntries = Object.entries(value)
      .map(([k, v]) => [k, filterData(v, k, filter)])
      .filter(([, v]) => v !== undefined)
    return filteredEntries.length > 0 ? Object.fromEntries(filteredEntries) : undefined
  }

  if (type === 'array') {
    const filteredItems = value
      .map(item => {
        const itemType = getType(item)
        if (itemType === 'object' && item !== null) return filterData(item, null, filter)
        return filterData(item, null, filter)
      })
      .filter(item => item !== undefined)
    return filteredItems.length > 0 ? filteredItems : undefined
  }

  // Leaf — match against display string
  const display = value === null ? 'null' : String(value)
  return display.includes(filter) ? value : undefined
}

// ── Highlight matching substring in a string ─────────────────────────────────

function Highlight({ text, filter }) {
  if (!filter || !text.includes(filter)) return <>{text}</>
  const parts = text.split(filter)
  return <>
    {parts.map((part, i) => (
      <span key={i}>
        {part}
        {i < parts.length - 1 && <mark className="jex-highlight">{filter}</mark>}
      </span>
    ))}
  </>
}

function buildRows(data, expanded) {
  if (data == null) return []
  const rows = []
  flattenTree(data, null, 0, expanded, rows, '')
  return rows
}

// ── Initial expanded set (auto-expands to depth 2) ───────────────────────────

function collectInitialExpanded(value, key, depth, limit, set, pathPrefix) {
  const type = getType(value)
  const path = pathPrefix ? `${pathPrefix}/${key}` : (key ?? 'root')
  if ((type === 'object' || type === 'array') && depth < limit) {
    set.add(path)
    const children = type === 'array'
      ? value.map((v, i) => [String(i), v])
      : Object.entries(value ?? {})
    children.forEach(([k, v]) => collectInitialExpanded(v, k, depth + 1, limit, set, path))
  }
}

function buildInitialExpanded(data) {
  const set = new Set()
  if (data != null) collectAllPaths(data, null, set, '')
  return set
}

function collectAllPaths(value, key, set, pathPrefix) {
  const type = getType(value)
  const path = pathPrefix ? `${pathPrefix}/${key}` : (key ?? 'root')

  if (type === 'object' && value !== null) {
    set.add(path)
    Object.entries(value).forEach(([k, v]) => collectAllPaths(v, k, set, path))
    return
  }

  if (type === 'array') {
    set.add(path)
    value.forEach((v, i) => {
      const itemType = getType(v)
      if (itemType === 'object' && v !== null) {
        if (value.length === 1) {
          // Single-item array: flattenTree inlines properties with itemPath as prefix
          const itemPath = `${path}/${i}`
          Object.entries(v).forEach(([k, val]) => collectAllPaths(val, k, set, itemPath))
        } else {
          // Multi-item array: flattenTree uses [i] as the key
          collectAllPaths(v, `[${i}]`, set, path)
        }
      } else {
        collectAllPaths(v, String(i), set, path)
      }
    })
  }
}

// ── Type dot (small colored square — visual type hint without technical labels) ────────

function TypeDot({ type, kind }) {
  const cls = kind === 'branch'
    ? (type === 'array' ? 'jex-dot-array' : 'jex-dot-object')
    : `jex-dot-${type}`
  return <span className={`jex-dot ${cls}`} aria-hidden="true" />
}

// ── Single flat row ──────────────────────────────────────────────────────────

function ExplorerRow({ row, rowIndex, onToggle, filter }) {
  const indent = row.depth * 20
  const isBranch = row.kind === 'branch'

  return (
    <div
      className={`jex-row ${isBranch ? 'jex-row-branch' : 'jex-row-leaf'} ${rowIndex % 2 === 0 ? 'jex-even' : 'jex-odd'}`}
      style={{ paddingLeft: indent }}
      onClick={() => isBranch && onToggle(row.path)}
      role={isBranch ? 'button' : 'row'}
      tabIndex={isBranch ? 0 : undefined}
      onKeyDown={isBranch ? (e) => (e.key === 'Enter' || e.key === ' ') && onToggle(row.path) : undefined}
      aria-expanded={isBranch ? row.isOpen : undefined}
    >
      {/* Expand chevron */}
      <span className="jex-chevron" aria-hidden="true">
        {isBranch ? (row.isOpen ? '▾' : '▸') : ''}
      </span>

      {/* Colored type dot */}
      <TypeDot type={row.type} kind={row.kind} />

      {/* Field name — skip numeric array indices (no visual value) */}
      {(row.label !== null && row.label !== undefined && !/^\d+$/.test(row.label)) && (
        <span className={`jex-label ${isBranch ? 'jex-label-branch' : ''}`}>
          <Highlight text={row.label} filter={filter} />
        </span>
      )}

      {/* Leaf: value badge */}
      {row.kind === 'leaf' && (
        <span className={`jex-value-badge jex-value-${row.type}`}>
          <Highlight text={row.value === null ? 'null' : String(row.value)} filter={filter} />
        </span>
      )}
    </div>
  )
}

// ── Public component ─────────────────────────────────────────────────────────

export default function JsonExplorer({ data, emptyMessage = 'No data to display.' }) {
  const [expanded, setExpanded] = useState(() => buildInitialExpanded(data))
  const [filter, setFilter] = useState('')
  const filterInputRef = useRef(null)

  useEffect(() => {
    setExpanded(buildInitialExpanded(data))
    setFilter('')
  }, [data])

  // When filter is active, prune the tree and expand everything in the result
  const filteredData = useMemo(() => {
    if (!filter || data == null) return data
    const result = filterData(data, null, filter)
    return result ?? null
  }, [data, filter])

  const displayExpanded = useMemo(() => {
    if (!filter) return expanded
    const all = new Set()
    if (filteredData != null) collectAllPaths(filteredData, null, all, '')
    return all
  }, [filter, filteredData, expanded])

  const rows = useMemo(() => buildRows(filteredData, displayExpanded), [filteredData, displayExpanded])

  const handleToggle = useCallback((path) => {
    if (filter) return  // tree is fully expanded when filtering
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }, [filter])

  const expandAll = useCallback(() => {
    if (data == null) return
    const all = new Set()
    collectAllPaths(data, null, all, '')
    setExpanded(all)
  }, [data])

  const collapseAll = useCallback(() => {
    // Keep only the root node expanded so top-level children remain visible but collapsed
    const type = getType(data)
    setExpanded(data != null && (type === 'object' || type === 'array') ? new Set(['root']) : new Set())
  }, [data])

  const clearFilter = useCallback(() => {
    setFilter('')
    filterInputRef.current?.focus()
  }, [])

  if (data == null) {
    return <div className="jex-empty">{emptyMessage}</div>
  }

  const nodeCount = rows.filter(r => r.kind !== 'close').length
  const noMatches = filter && filteredData == null

  return (
    <div className="jex-container">
      <div className="jex-toolbar">
        <button className="jex-btn" onClick={expandAll}   type="button" disabled={!!filter}>Expand all</button>
        <button className="jex-btn" onClick={collapseAll} type="button" disabled={!!filter}>Collapse all</button>
        <div className="jex-filter-wrap">
          <input
            ref={filterInputRef}
            className="jex-filter-input"
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter (case-sensitive)…"
            spellCheck={false}
            aria-label="Filter nodes"
          />
          {filter && (
            <button className="jex-filter-clear" onClick={clearFilter} type="button" title="Clear filter">✕</button>
          )}
        </div>
        <span className="jex-row-count">
          {filter
            ? (noMatches ? 'No matches' : `${nodeCount} match${nodeCount !== 1 ? 'es' : ''}`)
            : `${nodeCount} node${nodeCount !== 1 ? 's' : ''}`
          }
        </span>
      </div>
      {noMatches
        ? <div className="jex-empty">No nodes match <strong>{filter}</strong></div>
        : (
          <div className="jex-list" role="tree" aria-label="JSON Explorer">
            {rows
              .filter(r => r.kind !== 'close')
              .map((row, i) => (
                <ExplorerRow
                  key={`${row.path}-${row.kind}-${i}`}
                  row={row}
                  rowIndex={i}
                  onToggle={handleToggle}
                  filter={filter}
                />
              ))}
          </div>
        )
      }
    </div>
  )
}
