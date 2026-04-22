import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Splitter } from '@progress/kendo-react-layout'
import { TabStrip, TabStripTab } from '@progress/kendo-react-layout'
import { Grid, GridColumn, GridToolbar } from '@progress/kendo-react-grid'
import { TreeView } from '@progress/kendo-react-treeview'
import { Button } from '@progress/kendo-react-buttons'
import { Input, Switch, TextArea } from '@progress/kendo-react-inputs'
import { ComboBox } from '@progress/kendo-react-dropdowns'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import './QueryMaintenancePage.css'

const PROXY_BASE = import.meta.env.VITE_ML_SCHEME + '://' +
  import.meta.env.VITE_ML_HOST + ':' + import.meta.env.VITE_ML_PORT +
  (import.meta.env.VITE_ML_BASE_PATH || '')

const AUTH_HEADER = 'Basic ' + btoa(
  import.meta.env.VITE_ML_USERNAME + ':' + import.meta.env.VITE_ML_PASSWORD
)

// Helper to call MarkLogic REST via proxy
async function mlFetch(path, options = {}) {
  const url = `${PROXY_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': AUTH_HEADER,
      ...(options.headers || {})
    }
  })
  return res
}

// Map MarkLogic error codes to user-friendly messages
const ERROR_FRIENDLY_MAP = {
  'SQL-TABLENOTFOUND': 'The SQL table referenced in the query does not exist. Check the table name for typos.',
  'SQL-NOCOLUMN': 'A column referenced in the SQL statement was not found. Verify column names.',
  'SQL-SYNTAXERROR': 'The SQL statement has a syntax error. Review the query for missing keywords or punctuation.',
  'SQL-NODB': 'The database referenced in the query was not found.',
  'XDMP-NOSUCHDB': 'The specified database does not exist on this MarkLogic server.',
  'XDMP-DOCNOTFOUND': 'The requested document was not found.',
  'XDMP-EXTIME': 'The query took too long to execute and was cancelled. Try reducing the data set with a WHERE clause or lowering Max Rows.',
  'SEC-PRIV': 'You do not have sufficient privileges to run this query. Contact your administrator.',
  'JS-JAVASCRIPT': 'A JavaScript error occurred during query execution.',
  'XDMP-CAST': 'A data type conversion error occurred. Check that parameter values match the expected column types.',
}

function parseMLError(stepNo, statusCode, rawText) {
  let friendly = `Step ${stepNo} failed with status ${statusCode}.`
  let technical = rawText
  let code = ''

  try {
    const parsed = JSON.parse(rawText)
    const err = parsed.errorResponse || parsed
    code = err.messageCode || ''
    const detail = err.messageDetail?.messageTitle || ''
    const message = err.message || ''

    // Pick the best friendly message
    if (ERROR_FRIENDLY_MAP[code]) {
      friendly = ERROR_FRIENDLY_MAP[code]
    } else if (detail) {
      friendly = `Step ${stepNo}: ${detail}`
    } else if (message) {
      // Extract the readable part after "--"
      const dashIdx = message.indexOf(' -- ')
      friendly = dashIdx >= 0
        ? `Step ${stepNo}: ${message.substring(dashIdx + 4)}`
        : `Step ${stepNo}: ${message}`
    }

    // Build clean technical detail
    technical = [
      code && `Code: ${code}`,
      message && `Message: ${message}`,
      err.stackTrace && `Stack: ${err.stackTrace}`
    ].filter(Boolean).join('\n')
  } catch (e) {
    // rawText wasn't JSON — use as-is
  }

  return { friendly, technical, code }
}

// Check if a step is a document write step (insert / update / upsert)
function isWriteStep(step) {
  const t = step?.statementType
  return t === 'insert' || t === 'update' || t === 'upsert'
}

/**
 * Returns true when foreignKey and parentKey are REQUIRED for this step:
 * addToExistingEntity matches a prior enabled SELECT step's roleName (case-insensitive).
 * In every other situation (write step, addAsTopLevelEntity set, no prior match) returns false.
 */
function getFkPkEnabled(step, allSteps) {
  if (isWriteStep(step)) return false
  if (step.addAsTopLevelEntity) return false
  if (!step.addToExistingEntity) return false
  const linkRole = step.addToExistingEntity.toLowerCase()
  return allSteps.some(s =>
    !isWriteStep(s) &&
    s.enable !== false &&
    s.sequenceNo < step.sequenceNo &&
    (s.roleName || '').toLowerCase() === linkRole
  )
}

// Extract {Entity.field} parameters from SQL statements
function extractParameters(steps) {
  const params = new Set()
  if (!steps) return []
  steps.forEach(step => {
    if (!step.statement) return
    const matches = step.statement.match(/\{([^}]+)\}/g)
    if (matches) {
      matches.forEach(m => params.add(m.replace(/[{}]/g, '')))
    }
  })
  return [...params]
}

// Validate a SQL statement and return an array of warning strings.
// This is a client-side heuristic check — not a full SQL parser.
// Only validates SELECT statements; write steps have no SQL.
function validateSql(sql, statementType) {
  if (!sql || !sql.trim()) return []
  const warnings = []
  const normalized = sql.replace(/\s+/g, ' ').trim()

  // SELECT mode (default)
  // Must start with SELECT
  if (!/^SELECT\b/i.test(normalized)) {
    warnings.push('Statement should start with SELECT.')
  }

  // Must have a FROM clause
  if (!/\bFROM\b/i.test(normalized)) {
    warnings.push('Missing FROM clause.')
  }

  // Check for consecutive conditions without AND/OR in WHERE clause
  const whereMatch = normalized.match(/\bWHERE\b\s+(.*)/is)
  if (whereMatch) {
    const whereBody = whereMatch[1]
    // Strip trailing ORDER BY/GROUP BY/HAVING/LIMIT
    let noParens = whereBody.replace(/\b(ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT)\b.*/i, '')
    // Iteratively replace innermost parenthesised groups with a non-paren placeholder
    // until no parentheses remain — handles subqueries of any nesting depth.
    // Using __SUB__ (no parens) so each pass exposes the next outer level.
    while (/\([^()]*\)/.test(noParens)) {
      noParens = noParens.replace(/\([^()]*\)/g, '__SUB__')
    }
    const segments = noParens.split(/\bAND\b|\bOR\b/i)
    for (const seg of segments) {
      const ops = seg.match(/(?:<=|>=|<>|!=|=|<|>)/g) || []
      if (ops.length > 1) {
        warnings.push('WHERE clause may have consecutive conditions without AND/OR between them.')
        break
      }
    }
  }

  // Unmatched parentheses
  let depth = 0
  for (const ch of normalized) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (depth < 0) break
  }
  if (depth !== 0) {
    warnings.push('Unmatched parentheses in the statement.')
  }

  // Unclosed single quotes (ignoring escaped quotes '')
  const stripped = normalized.replace(/''/g, '')
  const quoteCount = (stripped.match(/'/g) || []).length
  if (quoteCount % 2 !== 0) {
    warnings.push('Unclosed single quote in the statement.')
  }

  // Unclosed curly-brace parameters
  const openBraces = (normalized.match(/\{/g) || []).length
  const closeBraces = (normalized.match(/\}/g) || []).length
  if (openBraces !== closeBraces) {
    warnings.push('Unclosed parameter placeholder { } in the statement.')
  }

  // WHERE without any condition
  if (/\bWHERE\s*$/i.test(normalized)) {
    warnings.push('WHERE clause is empty — no conditions specified.')
  }

  // Trailing comma before FROM
  if (/,\s*FROM\b/i.test(normalized)) {
    warnings.push('Trailing comma before FROM clause.')
  }

  // AND/OR at end of statement with no following condition
  if (/\b(AND|OR)\s*$/i.test(normalized)) {
    warnings.push('Statement ends with AND/OR but no following condition.')
  }

  // Dangling comparison operator at end
  if (/[<>=!]+\s*$/i.test(normalized)) {
    warnings.push('Statement ends with a comparison operator but no value.')
  }

  return warnings
}

// ── Vocabulary validation helpers ─────────────────────────────────────────────────

/** Resolve a bare or fully-qualified entity name to its manifest id, or null. */
function resolveEntityId(entityName, manifest) {
  if (!manifest || !entityName) return null
  const name = entityName.trim()
  if (manifest.entities[name]) return name
  return manifest.entityIndex[name.toLowerCase()] || null
}

/**
 * Resolve a dot-separated attribute path (e.g. "Products.routingOperations.id") against
 * the manifest, traversing roles for intermediate segments.
 *
 * Returns { ok: true }                if the full path is valid
 *         { ok: false, error: string } if any segment is invalid
 *         null                         if param has no dots (bare form — caller handles)
 */
function resolveParamPath(param, manifest) {
  const segments = param.split('.')
  if (segments.length < 2) return null // bare form — caller handles

  const entitySegment = segments[0]
  const attrSegment   = segments[segments.length - 1]
  const roleSegments  = segments.slice(1, -1) // may be empty for 2-segment form

  let entityId = resolveEntityId(entitySegment, manifest)
  if (!entityId) {
    return { ok: false, error: `Unknown entity "${entitySegment}" in parameter "{${param}}". Check the vocabulary.` }
  }

  // Traverse intermediate role segments
  for (const role of roleSegments) {
    const ent = manifest.entities[entityId]
    if (!ent) {
      return { ok: false, error: `Entity "${entityId}" not found in vocabulary (param "{${param}}").` }
    }
    const matchedRole = Object.keys(ent.roles).find(r => r.toLowerCase() === role.toLowerCase())
    if (!matchedRole) {
      return { ok: false, error: `"${entityId}" has no role "${role}" in parameter "{${param}}". Check spelling.` }
    }
    // Advance to target entity — role.target may be qualified ("BOM.BOMComponents")
    const targetName = ent.roles[matchedRole].target
    const bareName   = targetName.split('.').pop()
    entityId = manifest.entities[targetName]
      ? targetName
      : (manifest.entityIndex[(bareName || '').toLowerCase()] || targetName)
    if (!manifest.entities[entityId]) {
      return { ok: false, error: `Role "${matchedRole}" on "${ent.qualifiedName}" points to unknown entity "${targetName}" (param "{${param}}").` }
    }
  }

  // Check final attribute on the resolved entity
  const finalEnt = manifest.entities[entityId]
  if (!finalEnt.attributes.some(a => a.toLowerCase() === attrSegment.toLowerCase())) {
    return { ok: false, error: `"${entityId}" has no attribute "${attrSegment}" in parameter "{${param}}". Check spelling.` }
  }

  return { ok: true }
}

/**
 * Validate entity/role/placeholder fields in all steps against the vocabulary manifest.
 * Returns array of { stepNo, field, message }.
 */
function validateQuerySteps(steps, manifest) {
  if (!manifest || !steps?.length) return []
  const errors = []
  const allAttrs = new Set()
  Object.values(manifest.entities).forEach(e => e.attributes.forEach(a => allAttrs.add(a.toLowerCase())))

  steps.forEach(step => {
    const sNo = step.sequenceNo

    // addAsTopLevelEntity — must be a known entity
    if (step.addAsTopLevelEntity && !resolveEntityId(step.addAsTopLevelEntity, manifest)) {
      errors.push({ stepNo: sNo, field: 'addAsTopLevelEntity',
        message: `Unknown entity "${step.addAsTopLevelEntity}". Check the vocabulary.` })
    }

    // addToExistingEntity + roleName — entity must exist, role must exist on it with correct direction
    if (step.addToExistingEntity) {
      const entityId = resolveEntityId(step.addToExistingEntity, manifest)
      if (!entityId) {
        // Try to suggest the correct parent by scanning for an entity that owns this roleName
        let suggestion = ''
        if (step.roleName) {
          const roleLower = step.roleName.toLowerCase()
          for (const [id, ent] of Object.entries(manifest.entities)) {
            if (Object.keys(ent.roles).some(r => r.toLowerCase() === roleLower)) {
              suggestion = ` Did you mean "${id.split('.').pop()}"?`
              break
            }
          }
        }
        errors.push({ stepNo: sNo, field: 'addToExistingEntity',
          message: `Unknown entity "${step.addToExistingEntity}".${suggestion}` })
      } else if (step.roleName) {
        const ent = manifest.entities[entityId]
        const matchedRole = Object.keys(ent.roles).find(r => r.toLowerCase() === step.roleName.toLowerCase())
        if (!matchedRole) {
          errors.push({ stepNo: sNo, field: 'roleName',
            message: `"${entityId}" has no role "${step.roleName}". Valid roles: ${Object.keys(ent.roles).sort().join(', ')}.` })
        } else if (ent.roles[matchedRole].cardinality === '*->1') {
          errors.push({ stepNo: sNo, field: 'roleName',
            message: `Role "${step.roleName}" is a child reference (*->1), not a parent collection. The parent entity owns this role — swap addToExistingEntity with the parent.` })
        }
      }
    }

    // SQL {param} placeholder validation
    // Accepts bare {attrName} and arbitrarily deep {Entity.role.role.attr} forms.
    if (step.statement) {
      ;(step.statement.match(/\{([^}]+)\}/g) || []).forEach(t => {
        const param = t.replace(/[{}]/g, '')
        const resolved = resolveParamPath(param, manifest)
        if (resolved === null) {
          // bare form — global attribute check
          if (!allAttrs.has(param.toLowerCase())) {
            errors.push({ stepNo: sNo, field: 'statement',
              message: `Unknown parameter "{${param}}" — not a vocabulary attribute. Check spelling.` })
          }
        } else if (!resolved.ok) {
          errors.push({ stepNo: sNo, field: 'statement', message: resolved.error })
        }
      })
    }

    // documentUriTemplate {param} placeholder validation
    // Accepts bare {attrName} and arbitrarily deep {Entity.role.role.attr} forms.
    // For write steps, bare placeholders are validated against the UNION of:
    //   1. The parent entity (addToExistingEntity) attributes
    //   2. The role target entity (addToExistingEntity + roleName → target) attributes
    // This is correct because URI template params can come from either entity.
    if (step.documentUriTemplate) {
      const parentId = step.addToExistingEntity ? resolveEntityId(step.addToExistingEntity, manifest) : null
      const uriAttrs = new Set()
      if (parentId && manifest.entities[parentId]) {
        // Add parent entity attrs
        manifest.entities[parentId].attributes.forEach(a => uriAttrs.add(a.toLowerCase()))
        // Add role target entity attrs (resolve via roleName)
        if (step.roleName) {
          const parentEnt = manifest.entities[parentId]
          const matchedRole = Object.keys(parentEnt.roles).find(r => r.toLowerCase() === (step.roleName || '').toLowerCase())
          if (matchedRole) {
            const targetName = parentEnt.roles[matchedRole].target
            const bareName   = targetName.split('.').pop()
            const targetId   = manifest.entities[targetName]
              ? targetName
              : (manifest.entityIndex[(bareName || '').toLowerCase()] || null)
            if (targetId && manifest.entities[targetId]) {
              manifest.entities[targetId].attributes.forEach(a => uriAttrs.add(a.toLowerCase()))
            }
          }
        }
      }
      const targetAttrs = uriAttrs.size > 0 ? uriAttrs : allAttrs
      ;(step.documentUriTemplate.match(/\{([^}]+)\}/g) || []).forEach(t => {
        const param = t.replace(/[{}]/g, '')
        const resolved = resolveParamPath(param, manifest)
        if (resolved === null) {
          // bare form — validate against parent + role-target union (or global fallback)
          if (!targetAttrs.has(param.toLowerCase())) {
            errors.push({ stepNo: sNo, field: 'documentUriTemplate',
              message: `Unknown URI placeholder "{${param}}" — not an attribute on "${step.addToExistingEntity || 'entity'}".` })
          }
        } else if (!resolved.ok) {
          errors.push({ stepNo: sNo, field: 'documentUriTemplate', message: resolved.error })
        }
      })
    }
  })
  return errors
}

/**
 * Get attribute suggestions for SQL / URI template autocomplete.
 *
 * SQL mode (entityFilter = null): returns full Entity.role.attr dotted paths,
 * traversing role links up to MAX_DEPTH levels.  This lets users type {Prod to
 * see Products.plant, Products.routingOperations.id, etc.
 *
 * URI template mode (entityFilter set): returns flat attribute names scoped to
 * the given entity (no dotted prefix needed for bare URI placeholders).
 */
function getAttributeSuggestions(manifest, prefix, entityFilter) {
  if (!manifest) return []
  const lp = (prefix || '').toLowerCase()

  if (entityFilter) {
    // URI template — flat attrs from the specified entity
    const id = manifest.entityIndex[(entityFilter || '').toLowerCase()] || entityFilter
    const attrs = new Set()
    if (id && manifest.entities[id]) manifest.entities[id].attributes.forEach(a => attrs.add(a))
    return [...attrs].filter(a => a.toLowerCase().startsWith(lp)).sort()
  }

  // SQL mode — full Entity.role.role.attr dotted paths
  const MAX_DEPTH = 3  // depth 1 = root entity; each role traversal increments depth
  const results = new Set()

  function collectPaths(entityId, displayPrefix, depth, visitedIds) {
    if (depth > MAX_DEPTH) return
    const ent = manifest.entities[entityId]
    if (!ent) return
    // Add one path per attribute at this level
    ent.attributes.forEach(a => results.add(displayPrefix + a))
    // Traverse child roles (skip *->1 back-references to avoid noise)
    if (depth < MAX_DEPTH) {
      Object.entries(ent.roles).forEach(([roleName, role]) => {
        if (role.cardinality === '*->1') return   // skip parent pointers
        const targetName = role.target
        const bareName   = targetName.split('.').pop()
        const targetId   = manifest.entities[targetName]
          ? targetName
          : (manifest.entityIndex[(bareName || '').toLowerCase()] || null)
        if (targetId && !visitedIds.has(targetId)) {
          const newVisited = new Set(visitedIds)
          newVisited.add(targetId)
          collectPaths(targetId, displayPrefix + roleName + '.', depth + 1, newVisited)
        }
      })
    }
  }

  // Start one traversal per root entity, using the bare (last-segment) name as prefix
  // so suggestions read as  Products.plant,  BOMComponents.brand, etc.
  // resolveEntityId() can look these up via entityIndex, so validation also works.
  Object.keys(manifest.entities).forEach(id => {
    const bareName = id.split('.').pop()
    collectPaths(id, bareName + '.', 1, new Set([id]))
  })

  return [...results]
    .filter(a => a.toLowerCase().startsWith(lp))
    .sort((a, b) => {
      // Sort shallower paths (fewer dots) before deeper ones, then alphabetically within same depth
      const depthDiff = (a.match(/\./g) || []).length - (b.match(/\./g) || []).length
      return depthDiff !== 0 ? depthDiff : a.localeCompare(b)
    })
}

/**
 * Detect an open {-brace context at cursorPos in value (for autocomplete trigger).
 * Returns { triggerPos, prefix } or null.
 */
function getAcContext(value, cursorPos) {
  const before = value.slice(0, cursorPos)
  const lastOpen = before.lastIndexOf('{')
  if (lastOpen === -1) return null
  const afterOpen = before.slice(lastOpen + 1)
  if (afterOpen.includes('}') || /\s/.test(afterOpen)) return null
  return { triggerPos: lastOpen, prefix: afterOpen }
}

export default function QueryMaintenancePage() {
  // --- State ---
  const [queries, setQueries] = useState([])
  const [ruleProjects, setRuleProjects] = useState([])
  const [treeData, setTreeData] = useState([])
  const [selectedUri, setSelectedUri] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [queryDoc, setQueryDoc] = useState(null)
  const [queryEtag, setQueryEtag] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tabIndex, setTabIndex] = useState(0)
  const [splitterPanes, setSplitterPanes] = useState([
    { size: '300px', min: '180px', max: '600px', collapsible: true, resizable: true },
    { min: '400px' }
  ])

  // Project editing state
  const [projectEditName, setProjectEditName] = useState('')
  const [projectRenaming, setProjectRenaming] = useState(false)

  // Test tab state
  const [paramValues, setParamValues] = useState({})
  const [testResults, setTestResults] = useState(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState(null)
  const [copiedStepIdx, setCopiedStepIdx] = useState(null)

  // Compute resolved SQL (parameter-substituted) for each enabled step
  const resolvedSteps = useMemo(() => {
    if (!queryDoc?.steps) return []
    return queryDoc.steps
      .filter(step => step.enable && step.statement)
      .map(step => {
        let sql = step.statement
        Object.entries(paramValues).forEach(([param, value]) => {
          const trimmed = (value || '').trim()
          let replacement
          if (trimmed !== '' && !isNaN(trimmed)) {
            replacement = trimmed
          } else {
            replacement = `'${trimmed.replace(/'/g, "''")}'`
          }
          sql = sql.replace(
            new RegExp(`\\{${param.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\}`, 'g'),
            replacement
          )
        })
        return { sequenceNo: step.sequenceNo, sql }
      })
  }, [queryDoc?.steps, paramValues])

  // Grid edit-descriptor state (KendoReact v13 incell editing API)
  // Keys are sequenceNo values; true = entire row is in edit mode
  const [stepEdit, setStepEdit] = useState({})

  // Tracks only the sequence of sequenceNos so the useEffect below only fires when
  // steps are added/removed/reordered — NOT on every field edit keystroke.
  // This prevents KendoReact Grid from remounting cell editors and losing focus.
  const stepSeqKey = useMemo(
    () => (queryDoc?.steps || []).map(s => s.sequenceNo).join(','),
    [queryDoc?.steps]
  )

  // Re-initialise edit descriptor only when the step set changes (not on value changes).
  useEffect(() => {
    if (!queryDoc?.steps) { setStepEdit({}); return }
    const ed = {}
    queryDoc.steps.forEach(s => { if (s.sequenceNo != null) ed[s.sequenceNo] = true })
    setStepEdit(ed)
  }, [stepSeqKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // SQL editor dialog state
  const [sqlEditorOpen, setSqlEditorOpen] = useState(false)
  const [sqlEditorIdx, setSqlEditorIdx] = useState(null)
  const [sqlEditorValue, setSqlEditorValue] = useState('')
  const [sqlEditorStatementType, setSqlEditorStatementType] = useState('select')

  // Write step config state (inside the step editor dialog)
  const [writeEditorParentEntity, setWriteEditorParentEntity] = useState('')
  const [writeEditorRoleName, setWriteEditorRoleName] = useState('')
  const [writeEditorUriTemplate, setWriteEditorUriTemplate] = useState('')
  const [writeEditorCollections, setWriteEditorCollections] = useState([])
  const [writeEditorCollInput, setWriteEditorCollInput] = useState('')

  // Live SQL validation warnings in the editor dialog
  const sqlEditorWarnings = useMemo(() => validateSql(sqlEditorValue, sqlEditorStatementType), [sqlEditorValue, sqlEditorStatementType])

  // ── Project settings & vocabulary manifest ───────────────────────────────────
  // Keyed by project name — each entry: { ruleProjectDir, corticonJsWorkLocation,
  // vocabularyManifest, vocabEcoreRelPath, vocabLastModified }
  const [projectSettings, setProjectSettings] = useState({})
  const [projectSettingsDirty, setProjectSettingsDirty] = useState(false)
  const [vocabRefreshing, setVocabRefreshing] = useState(false)
  // Bumped when the vocabulary manifest is refreshed — causes gridData to change
  // so stable cell renderers pick up the new manifest from the ref on next render.
  const [vocabVersion, setVocabVersion] = useState(0)

  // ── Autocomplete state (SQL editor + URI template) ───────────────────────
  const [acOpen, setAcOpen] = useState(false)
  const [acSuggestions, setAcSuggestions] = useState([])
  const [acHighlight, setAcHighlight] = useState(0)
  const [acTarget, setAcTarget] = useState(null) // 'sql' | 'uri'
  const [acTriggerPos, setAcTriggerPos] = useState(0)
  const [acFilter, setAcFilter] = useState('')
  const sqlEditorWrapRef = useRef(null)
  const uriTemplateWrapRef = useRef(null)
  const acListRef = useRef(null)

  // Visible suggestions = acSuggestions filtered by the explicit popup filter input
  const visibleSuggestions = useMemo(
    () => acFilter
      ? acSuggestions.filter(s => s.toLowerCase().includes(acFilter.toLowerCase()))
      : acSuggestions,
    [acSuggestions, acFilter]
  )

  // Scroll highlighted item into view when navigating with keyboard
  useEffect(() => {
    if (!acOpen || !acListRef.current) return
    const item = acListRef.current.children[acHighlight]
    item?.scrollIntoView({ block: 'nearest' })
  }, [acHighlight, acOpen])

  const openSqlEditor = (idx, step) => {
    setSqlEditorIdx(idx)
    setSqlEditorStatementType(isWriteStep(step) ? step.statementType : 'select')
    setSqlEditorValue(step.statement || '')
    setWriteEditorParentEntity(step.addToExistingEntity || '')
    setWriteEditorRoleName(step.roleName || '')
    setWriteEditorUriTemplate(step.documentUriTemplate || '')
    setWriteEditorCollections(step.collections || [])
    setWriteEditorCollInput('')
    setSqlEditorOpen(true)
  }

  const saveSqlEditor = () => {
    const isWrite = isWriteStep({ statementType: sqlEditorStatementType })
    if (isWrite) {
      if (!writeEditorParentEntity.trim()) {
        alert('Parent Entity is required for write steps')
        return
      }
      if (!writeEditorUriTemplate.trim()) {
        alert('Document URI template is required for write steps')
        return
      }
      if (!writeEditorUriTemplate.trim().startsWith('/')) {
        alert('Document URI template must start with /')
        return
      }
    }
    if (sqlEditorIdx !== null) {
      setQueryDoc(prev => {
        const steps = [...prev.steps]
        const step = { ...steps[sqlEditorIdx] }
        if (isWrite) {
          step.statementType = sqlEditorStatementType
          step.addToExistingEntity = writeEditorParentEntity
          step.roleName = writeEditorRoleName
          step.documentUriTemplate = writeEditorUriTemplate
          // Auto-commit any text still in the collections input that the user
          // typed but didn't confirm with Enter before clicking Save.
          const finalCollections = [...writeEditorCollections]
          if (writeEditorCollInput.trim()) finalCollections.push(writeEditorCollInput.trim())
          if (finalCollections.length > 0) {
            step.collections = finalCollections
          } else {
            delete step.collections
          }
          delete step.statement
          delete step.addAsTopLevelEntity
          delete step.foreignKey
          delete step.parentKey
          delete step.maxRows
        } else {
          step.statement = sqlEditorValue
          delete step.statementType
          delete step.documentUriTemplate
          delete step.collections
          if (step.addAsTopLevelEntity === undefined) step.addAsTopLevelEntity = null
          if (!step.maxRows) step.maxRows = 5000
        }
        steps[sqlEditorIdx] = step
        return { ...prev, steps }
      })
      setDirty(true)
    }
    setSqlEditorOpen(false)
  }

  const cancelSqlEditor = () => {
    setSqlEditorOpen(false)
  }

  // Status message
  const [statusMessage, setStatusMessage] = useState(null)

  // --- Load query list ---
  const loadQueryList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await mlFetch(
        '/v1/search?format=json&pageLength=500&options=corticonml-options&start=1',
        {
          method: 'POST',
          body: JSON.stringify({
            query: {
              'collection-query': { uri: ['QueryDefs'] }
            }
          })
        }
      )
      if (!res.ok) throw new Error(`Search failed: ${res.status}`)
      const data = await res.json()
      const list = (data.results || []).map(r => {
        const content = r.extracted?.content?.[0] || {}
        return {
          uri: r.uri,
          queryName: content.queryName || r.uri.split('/').pop().replace('.json', ''),
          ruleProject: content.ruleProject || 'Unassigned'
        }
      })
      list.sort((a, b) => a.queryName.localeCompare(b.queryName))
      setQueries(list)

      // Derive unique rule projects
      const projects = [...new Set(list.map(q => q.ruleProject))].sort()
      setRuleProjects(projects)
    } catch (err) {
      console.error('Failed to load queries:', err)
      setStatusMessage({ type: 'error', text: 'Failed to load query list: ' + err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQueryList()
  }, [loadQueryList])

  // --- Build tree data when queries change ---
  useEffect(() => {
    const projectMap = {}
    queries.forEach(q => {
      const proj = q.ruleProject || 'Unassigned'
      if (!projectMap[proj]) projectMap[proj] = []
      projectMap[proj].push(q)
    })
    // Include projects created locally that have no queries yet
    ruleProjects.forEach(proj => {
      if (!projectMap[proj]) projectMap[proj] = []
    })
    const tree = Object.keys(projectMap).sort().map(proj => ({
      text: proj,
      isProject: true,
      expanded: proj === selectedProject || (selectedUri && projectMap[proj].some(q => q.uri === selectedUri)),
      items: projectMap[proj].map(q => ({
        text: q.queryName,
        uri: q.uri,
        ruleProject: q.ruleProject,
        selected: q.uri === selectedUri
      }))
    }))
    setTreeData(tree)
  }, [queries, selectedUri, selectedProject, ruleProjects])

  // --- Load selected query document ---
  const loadQuery = useCallback(async (uri) => {
    if (!uri) return
    setLoading(true)
    setTestResults(null)
    setTestError(null)
    try {
      const res = await mlFetch(`/v1/documents?uri=${encodeURIComponent(uri)}&format=json`)
      if (!res.ok) throw new Error(`Load failed: ${res.status}`)
      const etag = res.headers.get('ETag')
      const doc = await res.json()
      // Normalize literal \n in SQL statements to actual newlines so display
      // is correct and JSON.stringify produces valid escaped output on save.
      if (doc.steps) {
        doc.steps = doc.steps.map(step => ({
          ...step,
          statement: typeof step.statement === 'string'
            ? step.statement.replace(/\\n/g, '\n')
            : step.statement
        }))
      }
      setQueryDoc(doc)
      setQueryEtag(etag)
      setDirty(false)
      // Reset param values for test tab
      const params = extractParameters(doc.steps)
      const pv = {}
      params.forEach(p => { pv[p] = '' })
      setParamValues(pv)
    } catch (err) {
      console.error('Failed to load query:', err)
      setStatusMessage({ type: 'error', text: 'Failed to load query: ' + err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedUri) loadQuery(selectedUri)
  }, [selectedUri, loadQuery])

  // --- Save query document ---
  const saveQuery = useCallback(async () => {
    if (!queryDoc || !selectedUri) return

    // Validate all SQL statements before saving
    const allWarnings = []
    ;(queryDoc.steps || []).forEach(step => {
      if (!step.statement) return
      const w = validateSql(step.statement, step.statementType)
      if (w.length > 0) {
        allWarnings.push({ sequenceNo: step.sequenceNo, warnings: w })
      }
    })

    // Validate FK pair completeness
    const fkWarnings = []
    ;(queryDoc.steps || []).forEach(step => {
      if (!step.addToExistingEntity) return
      if (isWriteStep(step)) return
      const hasFk = !!(step.foreignKey && step.foreignKey.trim())
      const hasPk = !!(step.parentKey && step.parentKey.trim())
      if (hasFk !== hasPk) {
        fkWarnings.push(`Step ${step.sequenceNo}: Both 'foreignKey' and 'parentKey' are required when using FK-based matching. ` +
          `'parentKey' is the unique identifier on the parent entity (named in 'Add to Existing Entity'), ` +
          `and 'foreignKey' is the column in the result rows that references it.`)
      }
    })

    if (fkWarnings.length > 0) {
      alert('Cannot save — FK configuration error:\n\n' + fkWarnings.join('\n\n'))
      return
    }
    if (allWarnings.length > 0) {
      const detail = allWarnings.map(s =>
        `Step ${s.sequenceNo}: ${s.warnings.join('; ')}`
      ).join('\n')
      if (!window.confirm(
        'SQL validation warnings:\n\n' + detail + '\n\nSave anyway?'
      )) return
    }

    // Vocabulary validation: block save if a manifest is loaded and steps have errors
    if (vocabManifestRef.current && queryDoc.steps?.length > 0) {
      const vocabErrors = validateQuerySteps(queryDoc.steps, vocabManifestRef.current)
      if (vocabErrors.length > 0) {
        const detail = vocabErrors
          .map(e => `  Step ${e.stepNo} [${e.field}]: ${e.message}`)
          .join('\n')
        alert(`Cannot save — vocabulary validation failed:\n\n${detail}\n\nFix the errors before saving.`)
        return
      }
    }

    setSaving(true)
    try {
      // Compute the canonical URI from the current queryName and ruleProject.
      // If the user renamed the query, we must write to the new URI and delete the old one.
      const nameSlug = (queryDoc.queryName || '').trim()
      const proj = (queryDoc.ruleProject || '').trim()
      const expectedUri = proj ? `/queries/${proj}/${nameSlug}.json` : selectedUri
      const uriChanged = expectedUri !== selectedUri

      // Write to the new (or same) URI
      const headers = {}
      if (!uriChanged && queryEtag) headers['If-Match'] = queryEtag
      const res = await mlFetch(
        `/v1/documents?uri=${encodeURIComponent(expectedUri)}&format=json&collection=QueryDefs`,
        { method: 'PUT', body: JSON.stringify(queryDoc), headers }
      )
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Save failed (${res.status}): ${errText}`)
      }

      // If the URI changed, delete the old document
      if (uriChanged) {
        await mlFetch(
          `/v1/documents?uri=${encodeURIComponent(selectedUri)}`,
          { method: 'DELETE' }
        )
        setSelectedUri(expectedUri)
        setQueryEtag(null)
      } else {
        const newEtag = res.headers.get('ETag')
        if (newEtag) setQueryEtag(newEtag)
      }

      setDirty(false)
      setStatusMessage({ type: 'success', text: 'Query saved successfully' })
      loadQueryList()
    } catch (err) {
      console.error('Failed to save query:', err)
      setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }, [queryDoc, selectedUri, queryEtag, loadQueryList])

  // --- Create new rule project ---
  const createProject = useCallback(() => {
    const name = prompt('Enter Rule Project name:')
    if (!name || !name.trim()) return
    const trimmed = name.trim()
    if (ruleProjects.includes(trimmed)) {
      setStatusMessage({ type: 'error', text: `Rule Project "${trimmed}" already exists` })
      return
    }
    setRuleProjects(prev => [...prev, trimmed].sort())
    setSelectedProject(trimmed)
    setStatusMessage({ type: 'success', text: `Rule Project "${trimmed}" created. Now add queries to it.` })
  }, [ruleProjects])

  // --- Create new query ---
  const createQuery = useCallback(async () => {
    // Determine target project
    let targetProject = selectedProject
    if (!targetProject && selectedUri) {
      targetProject = queries.find(q => q.uri === selectedUri)?.ruleProject
    }
    if (!targetProject || targetProject === 'Unassigned') {
      if (ruleProjects.filter(p => p !== 'Unassigned').length === 0) {
        setStatusMessage({ type: 'error', text: 'Please create a Rule Project first' })
        return
      }
      targetProject = ruleProjects.find(p => p !== 'Unassigned') || ruleProjects[0]
    }

    const name = prompt(`Enter query name (Rule Project: ${targetProject}):`)
    if (!name || !name.trim()) return
    const uri = `/queries/${targetProject}/${name.trim()}.json`
    const newDoc = {
      queryName: name.trim(),
      ruleProject: targetProject,
      steps: [
        {
          sequenceNo: 1,
          statement: '',
          enable: true,
          addAsTopLevelEntity: null,
          addToExistingEntity: '',
          roleName: '',
          maxRows: 5000
        }
      ]
    }
    try {
      const res = await mlFetch(
        `/v1/documents?uri=${encodeURIComponent(uri)}&format=json&collection=QueryDefs`,
        { method: 'PUT', body: JSON.stringify(newDoc) }
      )
      if (!res.ok) throw new Error(`Create failed: ${res.status}`)
      setStatusMessage({ type: 'success', text: `Query "${name.trim()}" created in "${targetProject}"` })
      setSelectedProject(targetProject)
      await loadQueryList()
      setSelectedUri(uri)
    } catch (err) {
      console.error('Failed to create query:', err)
      setStatusMessage({ type: 'error', text: 'Failed to create query: ' + err.message })
    }
  }, [loadQueryList, selectedProject, selectedUri, queries, ruleProjects])

  // --- Delete entire project (all its queries) ---
  const deleteProject = useCallback(async () => {
    if (!selectedProject) return
    const projectQueries = queries.filter(q => q.ruleProject === selectedProject)
    const hasQueries = projectQueries.length > 0
    const warning = hasQueries
      ? `Delete project "${selectedProject}" and its ${projectQueries.length} quer${projectQueries.length === 1 ? 'y' : 'ies'}?\n\n⚠️ Deleting this project will remove all your queries!`
      : `Delete empty project "${selectedProject}"?`
    if (!confirm(warning)) return
    try {
      for (const q of projectQueries) {
        const res = await mlFetch(
          `/v1/documents?uri=${encodeURIComponent(q.uri)}`,
          { method: 'DELETE' }
        )
        if (!res.ok) throw new Error(`Delete failed for "${q.queryName}": ${res.status}`)
      }
      setStatusMessage({ type: 'success', text: `Project "${selectedProject}" deleted (${projectQueries.length} quer${projectQueries.length === 1 ? 'y' : 'ies'} removed)` })
      setSelectedProject(null)
      setSelectedUri(null)
      setQueryDoc(null)
      await loadQueryList()
    } catch (err) {
      console.error('Failed to delete project:', err)
      setStatusMessage({ type: 'error', text: 'Failed to delete project: ' + err.message })
    }
  }, [selectedProject, queries, loadQueryList])

  // --- Delete query ---
  const deleteQuery = useCallback(async () => {
    if (!selectedUri) return
    const queryName = queries.find(q => q.uri === selectedUri)?.queryName || selectedUri
    const ruleProject = queries.find(q => q.uri === selectedUri)?.ruleProject || ''
    if (!confirm(`You are about to permanently delete the query "${queryName}"${ruleProject ? ` (project: "${ruleProject}")` : ''}.\n\nOnly this query will be deleted — the project will remain.\n\n⚠️ This action cannot be undone. Are you sure you want to proceed?`)) return
    try {
      const res = await mlFetch(
        `/v1/documents?uri=${encodeURIComponent(selectedUri)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
      setStatusMessage({ type: 'success', text: `Query "${queryName}" deleted` })
      setSelectedUri(null)
      setQueryDoc(null)
      await loadQueryList()
    } catch (err) {
      console.error('Failed to delete query:', err)
      setStatusMessage({ type: 'error', text: 'Failed to delete query: ' + err.message })
    }
  }, [selectedUri, queries, loadQueryList])

  // --- Edit handlers ---
  const updateQueryName = (val) => {
    setQueryDoc(prev => ({ ...prev, queryName: val }))
    setDirty(true)
  }

  // --- Rename project: updates ruleProject field + URI for all child queries ---
  const renameProject = useCallback(async () => {
    const newName = projectEditName.trim()
    if (!newName || newName === selectedProject) return
    const childQueries = queries.filter(q => q.ruleProject === selectedProject)
    if (childQueries.length === 0) {
      // No documents — just update local state
      setSelectedProject(newName)
      await loadQueryList()
      return
    }
    if (!window.confirm(
      `Rename project "${selectedProject}" to "${newName}"?\n\n` +
      `This will update ${childQueries.length} query document(s) in MarkLogic.`
    )) return
    setProjectRenaming(true)
    try {
      for (const q of childQueries) {
        // Load current doc
        const getRes = await mlFetch(`/v1/documents?uri=${encodeURIComponent(q.uri)}&format=json`)
        if (!getRes.ok) throw new Error(`Failed to load "${q.queryName}": ${getRes.status}`)
        const doc = await getRes.json()
        const newDoc = { ...doc, ruleProject: newName }
        const newUri = `/queries/${newName}/${q.queryName}.json`
        // Write to new URI
        const putRes = await mlFetch(
          `/v1/documents?uri=${encodeURIComponent(newUri)}&format=json&collection=QueryDefs`,
          { method: 'PUT', body: JSON.stringify(newDoc) }
        )
        if (!putRes.ok) throw new Error(`Failed to save "${q.queryName}": ${putRes.status}`)
        // Delete old URI
        await mlFetch(`/v1/documents?uri=${encodeURIComponent(q.uri)}`, { method: 'DELETE' })
      }
      setSelectedProject(newName)
      setSelectedUri(null)
      setQueryDoc(null)
      await loadQueryList()
      setStatusMessage({ type: 'success', text: `Project renamed to "${newName}" — ${childQueries.length} query document(s) updated.` })
    } catch (err) {
      console.error('Rename project failed:', err)
      setStatusMessage({ type: 'error', text: 'Rename failed: ' + err.message })
    } finally {
      setProjectRenaming(false)
    }
  }, [projectEditName, selectedProject, queries, loadQueryList])

  // Memoize updateStep — it's used as a dep by stable cell renderer useMemos.
  // It only closes over stable setState functions so the dep array is empty.
  const updateStep = useCallback((index, field, value) => {
    setQueryDoc(prev => {
      const steps = [...prev.steps]
      const updated = { ...steps[index], [field]: value }
      // When addToExistingEntity is cleared, also clear FK fields
      if (field === 'addToExistingEntity' && !value) {
        updated.foreignKey = ''
        updated.parentKey = ''
      }
      steps[index] = updated
      return { ...prev, steps }
    })
    setDirty(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addStep = () => {
    setQueryDoc(prev => {
      const maxSeq = prev.steps.reduce((max, s) => Math.max(max, s.sequenceNo || 0), 0)
      return {
        ...prev,
        steps: [...prev.steps, {
          sequenceNo: maxSeq + 1,
          statement: '',
          enable: true,
          addAsTopLevelEntity: null,
          addToExistingEntity: '',
          roleName: '',
          foreignKey: '',
          parentKey: '',
          maxRows: 5000
        }]
      }
    })
    setDirty(true)
  }

  const removeStep = (index) => {
    setQueryDoc(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }))
    setDirty(true)
  }

  // A ref that always holds the latest queryDoc, used by handleStepItemChange
  // so it can be a stable useCallback without closing over the mutable state.
  const queryDocRef = useRef(queryDoc)
  useEffect(() => { queryDocRef.current = queryDoc }, [queryDoc])

  // --- Grid item change handler for incell editing ---
  // Stable reference prevents KendoReact Grid from remounting cell editors on every render.
  const handleStepItemChange = useCallback((event) => {
    const { dataItem, field, value } = event
    const steps = queryDocRef.current?.steps || []
    const index = steps.findIndex(s => s.sequenceNo === dataItem.sequenceNo)
    if (index >= 0) {
      updateStep(index, field, value)
    }
  }, [updateStep])

  // ─────────────────────────────────────────────────────────────────────────────
  // Memoised grid data and vocabulary-derived state.
  // Defined OUTSIDE renderDefinitionTab so stable cell renderers (useMemo below)
  // don't cause KendoReact Grid to re-mount cell editors on every keystroke.
  // ─────────────────────────────────────────────────────────────────────────────

  // _vv field propagates vocabVersion bump into row identity so memoized cells
  // notice the change and re-render with fresh manifest data.
  const gridData = useMemo(
    () => (queryDoc?.steps || []).map((s, i) => ({ ...s, _idx: i, _vv: vocabVersion })),
    [queryDoc?.steps, vocabVersion]
  )

  const hasSelectSteps = useMemo(
    () => (queryDoc?.steps || []).some(s => !isWriteStep(s)),
    [queryDoc?.steps]
  )

  // Current project's vocabulary manifest (null if not yet loaded)
  const vocabManifest = useMemo(() => {
    if (!selectedProject) return null
    return projectSettings[selectedProject]?.vocabularyManifest || null
  }, [selectedProject, projectSettings])

  // Refs: cell renderers read these at closure-call time so the useMemo below
  // doesn't need vocabManifest/stepValidationErrors as deps (only updateStep + vocabVersion).
  const vocabManifestRef = useRef(null)
  const stepValidationErrorsRef = useRef({})
  useEffect(() => { vocabManifestRef.current = vocabManifest }, [vocabManifest])

  // Per-step validation errors keyed by sequenceNo → field → message
  const stepValidationErrors = useMemo(() => {
    if (!vocabManifest || !queryDoc?.steps) return {}
    const errors = {}
    validateQuerySteps(queryDoc.steps, vocabManifest).forEach(e => {
      if (!errors[e.stepNo]) errors[e.stepNo] = {}
      errors[e.stepNo][e.field] = e.message
    })
    return errors
  }, [vocabManifest, queryDoc?.steps])
  useEffect(() => { stepValidationErrorsRef.current = stepValidationErrors }, [stepValidationErrors])

  // ── Stable cell renderer objects ─────────────────────────────────────────────
  // Recreated ONLY when updateStep changes (never) or vocabVersion increments (vocab refresh).
  // All other state (manifest, errors) is read from refs at render time.

  // Cells for SELECT-only columns
  const selectOnlyCells = useMemo(() => {
    // addAsTopLevelEntity — entity name ComboBox (unchanged)
    const addAsTopLevelEntity = {
      data: (props) => {
        if (isWriteStep(props.dataItem)) return <td className="entity-cell-write" />
        const val = props.dataItem.addAsTopLevelEntity || ''
        const err = stepValidationErrorsRef.current[props.dataItem.sequenceNo]?.addAsTopLevelEntity
        const manifest = vocabManifestRef.current
        if (manifest) {
          return (
            <td className={err ? 'entity-cell-error' : undefined} title={err || undefined}>
              <ComboBox
                data={Object.keys(manifest.entities).sort()}
                value={val}
                onChange={(e) => updateStep(props.dataItem._idx, 'addAsTopLevelEntity', e.value || '')}
                allowCustom={true}
                size="small"
                fillMode="flat"
                className="entity-combobox"
                popupSettings={{ width: 'auto', popupClass: 'entity-cb-popup' }}
              />
            </td>
          )
        }
        return (
          <td className={err ? 'entity-cell-error' : undefined}>
            <input type="text" className="entity-field-input"
              value={val} title={err || val}
              onChange={(e) => updateStep(props.dataItem._idx, 'addAsTopLevelEntity', e.target.value)} />
          </td>
        )
      }
    }

    // parentKey — enabled only when a prior step's roleName matches addToExistingEntity
    // Attributes: the parent entity that OWNS the link role
    const parentKey = {
      data: (props) => {
        if (isWriteStep(props.dataItem)) return <td className="entity-cell-write" />
        const allSteps = queryDocRef.current?.steps || []
        const enabled = getFkPkEnabled(props.dataItem, allSteps)
        if (!enabled) {
          return <td className="fkpk-disabled" title="No prior step links here — Parent Key not applicable" />
        }
        const val = props.dataItem.parentKey || ''
        const err = stepValidationErrorsRef.current[props.dataItem.sequenceNo]?.parentKey
        const manifest = vocabManifestRef.current
        // Parent Key: attributes from the Parent Entity (addToExistingEntity)
        let attrList = []
        if (manifest) {
          const parentId = resolveEntityId(props.dataItem.addToExistingEntity || '', manifest)
          if (parentId && manifest.entities[parentId]) {
            attrList = (manifest.entities[parentId].attributes || []).slice().sort()
          }
        }
        if (manifest) {
          return (
            <td className={err ? 'entity-cell-error' : undefined} title={err || undefined}>
              <ComboBox
                data={attrList}
                value={val}
                onChange={(e) => updateStep(props.dataItem._idx, 'parentKey', e.value || '')}
                allowCustom={true}
                size="small"
                fillMode="flat"
                className="entity-combobox"
                popupSettings={{ width: 'auto', popupClass: 'entity-cb-popup' }}
              />
            </td>
          )
        }
        return (
          <td>
            <input type="text" className="entity-field-input"
              value={val}
              onChange={(e) => updateStep(props.dataItem._idx, 'parentKey', e.target.value)} />
          </td>
        )
      }
    }

    // foreignKey — enabled only when a prior step's roleName matches addToExistingEntity
    // Attributes: the TARGET entity of the link role (the child entity this step fetches)
    const foreignKey = {
      data: (props) => {
        if (isWriteStep(props.dataItem)) return <td className="entity-cell-write" />
        const allSteps = queryDocRef.current?.steps || []
        const enabled = getFkPkEnabled(props.dataItem, allSteps)
        if (!enabled) {
          return <td className="fkpk-disabled" title="No prior step links here — Foreign Key not applicable" />
        }
        const val = props.dataItem.foreignKey || ''
        const err = stepValidationErrorsRef.current[props.dataItem.sequenceNo]?.foreignKey
        const manifest = vocabManifestRef.current
        // Foreign Key: attributes from the target entity of the Associated Entity Role (roleName)
        let attrList = []
        if (manifest) {
          const parentId = resolveEntityId(props.dataItem.addToExistingEntity || '', manifest)
          if (parentId && manifest.entities[parentId]) {
            const roleName = props.dataItem.roleName || ''
            const roleNameLower = roleName.toLowerCase()
            const roleKey = Object.keys(manifest.entities[parentId].roles)
              .find(r => r.toLowerCase() === roleNameLower)
            const roleInfo = roleKey ? manifest.entities[parentId].roles[roleKey] : null
            if (roleInfo) {
              const targetId = resolveEntityId(roleInfo.target, manifest) || roleInfo.target
              if (targetId && manifest.entities[targetId]) {
                attrList = (manifest.entities[targetId].attributes || []).slice().sort()
              }
            }
          }
        }
        if (manifest) {
          return (
            <td className={err ? 'entity-cell-error' : undefined} title={err || undefined}>
              <ComboBox
                data={attrList}
                value={val}
                onChange={(e) => updateStep(props.dataItem._idx, 'foreignKey', e.value || '')}
                allowCustom={true}
                size="small"
                fillMode="flat"
                className="entity-combobox"
                popupSettings={{ width: 'auto', popupClass: 'entity-cb-popup' }}
              />
            </td>
          )
        }
        return (
          <td>
            <input type="text" className="entity-field-input"
              value={val}
              onChange={(e) => updateStep(props.dataItem._idx, 'foreignKey', e.target.value)} />
          </td>
        )
      }
    }

    return { addAsTopLevelEntity, parentKey, foreignKey }
  }, [updateStep, vocabVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cells for columns visible in both SELECT and write steps: addToExistingEntity, roleName
  const alwaysCells = useMemo(() => ({
    addToExistingEntity: {
      data: (props) => {
        const val = props.dataItem.addToExistingEntity || ''
        const err = stepValidationErrorsRef.current[props.dataItem.sequenceNo]?.addToExistingEntity
        const manifest = vocabManifestRef.current
        if (manifest) {
          return (
            <td className={err ? 'entity-cell-error' : undefined} title={err || undefined}>
              <ComboBox
                data={Object.keys(manifest.entities).sort()}
                value={val}
                onChange={(e) => updateStep(props.dataItem._idx, 'addToExistingEntity', e.value || '')}
                allowCustom={true}
                size="small"
                fillMode="flat"
                className="entity-combobox"
                popupSettings={{ width: 'auto', popupClass: 'entity-cb-popup' }}
              />
            </td>
          )
        }
        return (
          <td className={err ? 'entity-cell-error' : undefined}>
            <input type="text" className="entity-field-input"
              value={val} title={err || val}
              onChange={(e) => updateStep(props.dataItem._idx, 'addToExistingEntity', e.target.value)} />
          </td>
        )
      }
    },
    roleName: {
      data: (props) => {
        const val = props.dataItem.roleName || ''
        const err = stepValidationErrorsRef.current[props.dataItem.sequenceNo]?.roleName
        const manifest = vocabManifestRef.current
        if (manifest) {
          const entityName = props.dataItem.addToExistingEntity || ''
          const entityId = manifest.entityIndex[(entityName).toLowerCase()] || entityName
          const roleList = entityId && manifest.entities[entityId]
            ? Object.keys(manifest.entities[entityId].roles).sort()
            : [...new Set(Object.values(manifest.entities).flatMap(e => Object.keys(e.roles)))].sort()
          return (
            <td className={err ? 'entity-cell-error' : undefined} title={err || undefined}>
              <ComboBox
                data={roleList}
                value={val}
                onChange={(e) => updateStep(props.dataItem._idx, 'roleName', e.value || '')}
                allowCustom={true}
                size="small"
                fillMode="flat"
                className="entity-combobox"
                popupSettings={{ width: 'auto', popupClass: 'entity-cb-popup' }}
              />
            </td>
          )
        }
        return (
          <td className={err ? 'entity-cell-error' : undefined}>
            <input type="text" className="entity-field-input"
              value={val} title={err || val}
              onChange={(e) => updateStep(props.dataItem._idx, 'roleName', e.target.value)} />
          </td>
        )
      }
    }
  }), [updateStep, vocabVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stable cells for Seq # and Max Rows number inputs (prevents focus loss on typing)
  const seqNoCells = useMemo(() => ({
    data: (props) => (
      <td style={{ textAlign: 'center', padding: '4px 2px' }}>
        <input
          type="number"
          className="entity-field-input"
          style={{ textAlign: 'center', width: '100%' }}
          value={props.dataItem.sequenceNo ?? ''}
          onChange={(e) => updateStep(props.dataItem._idx, 'sequenceNo', e.target.value === '' ? '' : Number(e.target.value))}
        />
      </td>
    )
  }), [updateStep]) // eslint-disable-line react-hooks/exhaustive-deps

  const maxRowsCells = useMemo(() => ({
    data: (props) => (
      <td style={{ textAlign: 'center', padding: '4px 2px' }}>
        <input
          type="number"
          className="entity-field-input"
          style={{ textAlign: 'center', width: '100%' }}
          value={props.dataItem.maxRows ?? ''}
          onChange={(e) => updateStep(props.dataItem._idx, 'maxRows', e.target.value === '' ? '' : Number(e.target.value))}
        />
      </td>
    )
  }), [updateStep]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Project settings callbacks ─────────────────────────────────────────────

  const loadProjectSettings = useCallback(async (projectName) => {
    if (!projectName) return
    try {
      const uri = `/query-project-settings/${encodeURIComponent(projectName)}.json`
      const res = await mlFetch(`/v1/documents?uri=${encodeURIComponent(uri)}&format=json`)
      if (res.status === 404) {
        // No saved settings yet — initialize empty entry without overwriting an existing one
        setProjectSettings(prev => ({
          ...prev,
          [projectName]: prev[projectName] || { ruleProjectDir: '', corticonJsWorkLocation: '' }
        }))
        return
      }
      if (!res.ok) throw new Error(`Load project settings: HTTP ${res.status}`)
      const doc = await res.json()
      setProjectSettings(prev => ({ ...prev, [projectName]: doc }))
    } catch (err) {
      console.error('[loadProjectSettings]', err)
      setProjectSettings(prev => ({
        ...prev,
        [projectName]: prev[projectName] || { ruleProjectDir: '', corticonJsWorkLocation: '' }
      }))
    }
  }, [])

  // Auto-load settings when the selected project changes (if not already loaded)
  useEffect(() => {
    if (selectedProject && !projectSettings[selectedProject]) {
      loadProjectSettings(selectedProject)
    }
  }, [selectedProject, projectSettings, loadProjectSettings])

  const updateProjectSetting = useCallback((field, value) => {
    if (!selectedProject) return
    setProjectSettings(prev => ({
      ...prev,
      [selectedProject]: { ...(prev[selectedProject] || {}), [field]: value }
    }))
    setProjectSettingsDirty(true)
  }, [selectedProject])

  const saveProjectSettings = useCallback(async () => {
    if (!selectedProject) return
    const settings = projectSettings[selectedProject]
    if (!settings) return
    const uri = `/query-project-settings/${encodeURIComponent(selectedProject)}.json`
    try {
      const res = await mlFetch(
        `/v1/documents?uri=${encodeURIComponent(uri)}&format=json&collection=QueryProjectSettings`,
        { method: 'PUT', body: JSON.stringify({ projectName: selectedProject, ...settings }) }
      )
      if (!res.ok) throw new Error(`Save project settings: HTTP ${res.status}`)
      setProjectSettingsDirty(false)
      setStatusMessage({ type: 'success', text: 'Project settings saved.' })
    } catch (err) {
      console.error('[saveProjectSettings]', err)
      setStatusMessage({ type: 'error', text: 'Failed to save project settings: ' + err.message })
    }
  }, [selectedProject, projectSettings])

  const refreshVocabulary = useCallback(async () => {
    if (!selectedProject) return
    const settings = projectSettings[selectedProject]
    if (!settings?.ruleProjectDir?.trim()) {
      setStatusMessage({ type: 'error', text: 'Set "Rule Project Directory" in Project Properties first.' })
      return
    }
    if (!settings?.corticonJsWorkLocation?.trim()) {
      setStatusMessage({ type: 'error', text: 'Set "Corticon.js Work Location" in Project Properties first.' })
      return
    }
    setVocabRefreshing(true)
    try {
      const res = await mlFetch('/generate-vocabulary-report', {
        method: 'POST',
        body: JSON.stringify({
          ruleProjectDir: settings.ruleProjectDir,
          corticonJsWorkLocation: settings.corticonJsWorkLocation
        })
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(payload.error || `Vocabulary report failed (HTTP ${res.status})`)
      }
      const data = await res.json()
      const entityCount = Object.keys(data.manifest.entities).length
      const updatedSettings = {
        ...settings,
        vocabularyManifest: data.manifest,
        vocabEcoreRelPath: data.vocabEcoreRelPath,
        vocabLastModified: data.ecoreLastModified
      }
      setProjectSettings(prev => ({ ...prev, [selectedProject]: updatedSettings }))
      setVocabVersion(v => v + 1)
      // Auto-save updated settings (with manifest) back to MarkLogic
      const uri = `/query-project-settings/${encodeURIComponent(selectedProject)}.json`
      await mlFetch(
        `/v1/documents?uri=${encodeURIComponent(uri)}&format=json&collection=QueryProjectSettings`,
        { method: 'PUT', body: JSON.stringify({ projectName: selectedProject, ...updatedSettings }) }
      )
      setStatusMessage({ type: 'success', text: `Vocabulary refreshed: ${data.vocabEcoreRelPath} (${entityCount} entities)` })
    } catch (err) {
      console.error('[refreshVocabulary]', err)
      setStatusMessage({ type: 'error', text: 'Vocabulary refresh failed: ' + err.message })
    } finally {
      setVocabRefreshing(false)
    }
  }, [selectedProject, projectSettings])

  // ── Autocomplete handlers (SQL editor + URI template) ─────────────────────

  const handleSqlChange = (e) => {
    const newVal = e.value
    setSqlEditorValue(newVal)
    if (!vocabManifestRef.current) { setAcOpen(false); return }
    const textarea = sqlEditorWrapRef.current?.querySelector('textarea')
    const cursorPos = textarea?.selectionStart ?? newVal.length
    const ctx = getAcContext(newVal, cursorPos)
    if (ctx) {
      const suggestions = getAttributeSuggestions(vocabManifestRef.current, ctx.prefix, null)
      if (suggestions.length > 0) {
        setAcTarget('sql'); setAcTriggerPos(ctx.triggerPos)
        setAcSuggestions(suggestions); setAcHighlight(0); setAcFilter(''); setAcOpen(true)
      } else { setAcOpen(false) }
    } else { setAcOpen(false) }
  }

  const handleSqlKeyDown = (e) => {
    if (!acOpen || acTarget !== 'sql') return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAcHighlight(h => Math.min(h + 1, visibleSuggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAcHighlight(h => Math.max(h - 1, 0)) }
    else if ((e.key === 'Enter' || e.key === 'Tab') && visibleSuggestions.length > 0) { e.preventDefault(); insertSuggestion(visibleSuggestions[acHighlight] || visibleSuggestions[0]) }
    else if (e.key === 'Escape') { setAcOpen(false) }
  }

  const handleUriChange = (e) => {
    const newVal = e.value
    setWriteEditorUriTemplate(newVal)
    if (!vocabManifestRef.current) { setAcOpen(false); return }
    const input = uriTemplateWrapRef.current?.querySelector('input')
    const cursorPos = input?.selectionStart ?? newVal.length
    const ctx = getAcContext(newVal, cursorPos)
    if (ctx) {
      const entityFilter = writeEditorParentEntity || null
      const suggestions = getAttributeSuggestions(vocabManifestRef.current, ctx.prefix, entityFilter)
      if (suggestions.length > 0) {
        setAcTarget('uri'); setAcTriggerPos(ctx.triggerPos)
        setAcSuggestions(suggestions); setAcHighlight(0); setAcFilter(''); setAcOpen(true)
      } else { setAcOpen(false) }
    } else { setAcOpen(false) }
  }

  const handleUriKeyDown = (e) => {
    if (!acOpen || acTarget !== 'uri') return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAcHighlight(h => Math.min(h + 1, visibleSuggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAcHighlight(h => Math.max(h - 1, 0)) }
    else if ((e.key === 'Enter' || e.key === 'Tab') && visibleSuggestions.length > 0) { e.preventDefault(); insertSuggestion(visibleSuggestions[acHighlight] || visibleSuggestions[0]) }
    else if (e.key === 'Escape') { setAcOpen(false) }
  }

  const handleAcFilterKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAcHighlight(h => Math.min(h + 1, visibleSuggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAcHighlight(h => Math.max(h - 1, 0)) }
    else if ((e.key === 'Enter' || e.key === 'Tab') && visibleSuggestions.length > 0) { e.preventDefault(); insertSuggestion(visibleSuggestions[acHighlight] || visibleSuggestions[0]) }
    else if (e.key === 'Escape') { setAcOpen(false) }
  }

  const insertSuggestion = (attrName) => {
    if (acTarget === 'sql') {
      const textarea = sqlEditorWrapRef.current?.querySelector('textarea')
      const cursorPos = textarea?.selectionStart ?? sqlEditorValue.length
      const before = sqlEditorValue.slice(0, acTriggerPos + 1) // include the {
      const after = sqlEditorValue.slice(cursorPos)
      const newValue = before + attrName + '}' + after
      setSqlEditorValue(newValue)
      const newCursorPos = acTriggerPos + 1 + attrName.length + 1
      requestAnimationFrame(() => {
        if (textarea) { textarea.setSelectionRange(newCursorPos, newCursorPos); textarea.focus() }
      })
    } else if (acTarget === 'uri') {
      const input = uriTemplateWrapRef.current?.querySelector('input')
      const cursorPos = input?.selectionStart ?? writeEditorUriTemplate.length
      const before = writeEditorUriTemplate.slice(0, acTriggerPos + 1)
      const after = writeEditorUriTemplate.slice(cursorPos)
      const newValue = before + attrName + '}' + after
      setWriteEditorUriTemplate(newValue)
      const newCursorPos = acTriggerPos + 1 + attrName.length + 1
      requestAnimationFrame(() => {
        if (input) { input.setSelectionRange(newCursorPos, newCursorPos); input.focus() }
      })
    }
    setAcOpen(false)
  }

  // --- Test query ---
  const runTest = useCallback(async () => {
    if (!queryDoc?.steps) return
    setTestLoading(true)
    setTestError(null)
    setTestResults(null)

    try {
      // Process each enabled step
      const allResults = []
      for (const step of queryDoc.steps) {
        if (!step.enable) continue

        // Substitute parameters in the statement
        // Only wrap non-numeric values in SQL single quotes
        let sql = step.statement
        Object.entries(paramValues).forEach(([param, value]) => {
          const trimmed = (value || '').trim()
          let replacement
          if (trimmed !== '' && !isNaN(trimmed)) {
            // Numeric value — no quotes
            replacement = trimmed
          } else {
            // String value — escape single quotes and wrap
            replacement = `'${trimmed.replace(/'/g, "''")}'`
          }
          sql = sql.replace(
            new RegExp(`\\{${param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'),
            replacement
          )
        })

        // Execute via /v1/eval using Server-Side JavaScript
        // Use single-quote escaping: pass SQL in a JS variable to avoid nested quote issues
        // Use xdmp.sql with 'map' format, then strip schema.table prefix from keys
        const jsCode = [
          `var sql = ${JSON.stringify(sql)};`,
          `var rows = xdmp.sql(sql, 'map');`,
          `var result = [];`,
          `for (var row of rows) {`,
          `  var clean = {};`,
          `  for (var key of Object.keys(row)) {`,
          `    var parts = key.split('.');`,
          `    clean[parts[parts.length - 1]] = row[key];`,
          `  }`,
          `  result.push(clean);`,
          `}`,
          `result;`
        ].join('\n')

        const res = await mlFetch('/v1/eval', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'javascript=' + encodeURIComponent(jsCode)
        })

        if (!res.ok) {
          const errText = await res.text()
          const parsed = parseMLError(step.sequenceNo, res.status, errText)
          const err = new Error(parsed.friendly)
          err.errorDetail = parsed
          throw err
        }

        const contentType = res.headers.get('Content-Type') || ''
        let resultData
        if (contentType.includes('multipart')) {
          // Parse multipart response
          const text = await res.text()
          resultData = parseMultipartResponse(text)
        } else {
          resultData = await res.json()
        }

        allResults.push({
          sequenceNo: step.sequenceNo,
          statement: sql,
          data: resultData
        })
      }

      setTestResults(allResults)
      setStatusMessage({ type: 'success', text: `Test completed: ${allResults.length} step(s) executed` })
    } catch (err) {
      console.error('Test failed:', err)
      const detail = err.errorDetail || { friendly: err.message, technical: err.stack || '', code: '' }
      setTestError(detail)
      setStatusMessage({ type: 'error', text: 'Test failed — see details below' })
    } finally {
      setTestLoading(false)
    }
  }, [queryDoc, paramValues])

  // Parse multipart/mixed response from /v1/eval
  function parseMultipartResponse(text) {
    const rows = []
    // Split by boundary markers, extract JSON parts
    const parts = text.split(/--[a-f0-9]+/)
    for (const part of parts) {
      const jsonMatch = part.match(/\r?\n\r?\n([\s\S]*?)(\r?\n)?$/)
      if (jsonMatch) {
        const body = jsonMatch[1].trim()
        if (body && (body.startsWith('[') || body.startsWith('{'))) {
          try {
            const parsed = JSON.parse(body)
            if (Array.isArray(parsed)) {
              rows.push(...parsed)
            } else {
              rows.push(parsed)
            }
          } catch (e) { /* skip non-JSON parts */ }
        }
      }
    }
    return rows
  }

  // --- TreeView handlers ---
  const handleTreeExpandChange = (event) => {
    const updated = treeData.map(node => {
      if (node.text === event.item.text && node.isProject) {
        return { ...node, expanded: !node.expanded }
      }
      return node
    })
    setTreeData(updated)
  }

  const handleTreeItemClick = (event) => {
    const item = event.item
    if (item.isProject) {
      // Clicking a project node gives focus to the project and deselects any query
      if (dirty && selectedUri && !confirm('Unsaved changes will be lost. Continue?')) return
      setSelectedProject(item.text)
      setProjectEditName(item.text)
      setSelectedUri(null)
      setQueryDoc(null)
      setDirty(false)
      loadProjectSettings(item.text)
    } else if (item.uri) {
      // Clicking a query node
      if (dirty && !confirm('Unsaved changes will be lost. Continue?')) return
      setSelectedUri(item.uri)
      setSelectedProject(item.ruleProject)
      setTabIndex(0)
      loadProjectSettings(item.ruleProject)
    }
  }

  // --- Render: Left Panel (TreeView) ---
  const renderQueryList = () => (
    <div className="query-list-panel">
      <div className="query-list-toolbar">
        <h3>Queries</h3>
        <div className="query-list-actions">
          <Button themeColor="info" onClick={createProject} title="New Rule Project">+ Project</Button>
          <Button themeColor="primary" onClick={createQuery} title="New Query">+ Query</Button>
          <Button themeColor="error" onClick={deleteQuery} disabled={!selectedUri} title="Delete selected query">Delete Query</Button>
          <Button themeColor="error" onClick={deleteProject} disabled={!selectedProject || !!selectedUri} title="Delete entire project and all its queries">Delete Project</Button>
        </div>
      </div>
      <div className="query-list-items">
        {loading && queries.length === 0 && <div className="query-list-loading">Loading...</div>}
        {treeData.length > 0 ? (
          <TreeView
            data={treeData}
            expandIcons={true}
            onExpandChange={handleTreeExpandChange}
            onItemClick={handleTreeItemClick}
            textField="text"
            style={{ width: '100%' }}
            item={(props) => {
              const item = props.item
              if (item.isProject) {
                const isSelected = item.text === selectedProject && !selectedUri
                return (
                  <span className={`tree-project-node${isSelected ? ' selected' : ''}`}>
                    <span className="tree-project-icon">&#128193;</span>
                    <span className="tree-project-text">{item.text}</span>
                    <span className="tree-project-count">{item.items?.length || 0}</span>
                  </span>
                )
              }
              return (
                <span className={`tree-query-node ${item.uri === selectedUri ? 'selected' : ''}`}>
                  {item.text}
                </span>
              )
            }}
          />
        ) : (
          !loading && <div className="query-list-empty">No queries found. Click "+ Project" to start.</div>
        )}
      </div>
    </div>
  )

  // --- Render: Definition Tab ---
  const renderDefinitionTab = () => {
    if (!queryDoc) {
      return <div className="query-placeholder">Select a query from the list, or create a new one.</div>
    }

    // ── Vocabulary info bar ──────────────────────────────────────────────────
    const ps = selectedProject ? projectSettings[selectedProject] : null
    const errCount = Object.keys(stepValidationErrors).length
    let vocabBar
    if (vocabManifest && ps?.vocabEcoreRelPath) {
      const lastUpdated = ps.vocabLastModified
        ? (() => { const d = new Date(ps.vocabLastModified); const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` })()
        : 'unknown'
      vocabBar = (
        <div className={`vocab-info-bar${errCount > 0 ? ' has-errors' : ''}`}>
          <span className="vocab-info-name">
            <span className="vocab-info-icon">&#128214;</span>
            {ps.vocabEcoreRelPath.split('/').pop()}
          </span>
          <span className="vocab-info-sep">·</span>
          <span className="vocab-info-updated">Updated: {lastUpdated}</span>
          <Button size="small" fillMode="flat" onClick={refreshVocabulary}
            disabled={vocabRefreshing} className="vocab-refresh-btn">
            {vocabRefreshing ? '⏳' : '↺ Refresh'}
          </Button>
          {errCount > 0 && (
            <span className="vocab-info-errors">
              &#9888; {errCount} step{errCount > 1 ? 's have errors' : ' has errors'}
            </span>
          )}
        </div>
      )
    } else if (ps?.ruleProjectDir) {
      vocabBar = (
        <div className="vocab-info-bar vocab-info-bar-empty">
          <span className="vocab-info-icon">&#128214;</span>
          <span>No vocabulary loaded. Click Refresh to enable validation and dropdowns.</span>
          <Button size="small" fillMode="flat" onClick={refreshVocabulary}
            disabled={vocabRefreshing} className="vocab-refresh-btn">
            {vocabRefreshing ? '⏳' : '↺ Refresh'}
          </Button>
        </div>
      )
    } else {
      vocabBar = (
        <div className="vocab-info-bar vocab-info-bar-empty">
          <span className="vocab-info-icon">&#128214;</span>
          <span className="vocab-info-empty-text">Configure Rule Project Directory in Project Properties to enable vocabulary validation and dropdowns.</span>
        </div>
      )
    }

    return (
      <div className="query-definition">
        <div className="query-header-row">
          <div className="query-header-field" style={{ flex: 1 }}>
            <label className="query-field-label">Query Name</label>
            <Input
              value={queryDoc.queryName || ''}
              onChange={(e) => updateQueryName(e.value)}
              style={{ width: '100%', maxWidth: 500 }}
            />
          </div>
        </div>

        {vocabBar}

        {errCount > 0 && (
          <div className="vocab-error-list">
            {Object.entries(stepValidationErrors).flatMap(([stepNo, fields]) =>
              Object.entries(fields).map(([field, message]) => (
                <div key={`${stepNo}-${field}`} className="vocab-error-item">
                  <span className="vocab-error-step">Step {stepNo}</span>
                  <span className="vocab-error-sep">·</span>
                  <span className="vocab-error-field">{field}</span>
                  <span className="vocab-error-sep">—</span>
                  <span className="vocab-error-msg">{message}</span>
                </div>
              ))
            )}
          </div>
        )}

        <div className="query-steps-section">
          <div className="query-steps-scroll-wrap">
          <Grid
            data={gridData}
            dataItemKey="sequenceNo"
            edit={stepEdit}
            editable={{ mode: 'incell' }}
            onEditChange={(e) => setStepEdit(e.edit)}
            onItemChange={handleStepItemChange}
            scrollable="none"
            resizable={true}
            style={{ width: '100%', minWidth: hasSelectSteps ? 1400 : 1200 }}
          >
            <GridToolbar>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Steps</span>
              <Button themeColor="primary" onClick={addStep} style={{ marginLeft: 'auto' }}>+ Add Step</Button>
            </GridToolbar>
            <GridColumn field="sequenceNo" title="Seq #" width={55} editable={false}
              cells={seqNoCells}
            />
            {/* SQL Statement: no width — fills all remaining space after fixed columns */}
            <GridColumn title="SQL Statement"
              width={300}
              editable={false}
              cells={{
                data: (props) => (
                  <td className={`sql-cell${isWriteStep(props.dataItem) ? ' sql-cell-write' : ''}`}>
                    <div className="sql-cell-content">
                      <div className="sql-cell-body">
                        <span className={`step-type-badge${isWriteStep(props.dataItem) ? ' write' : ''}`}>
                          {isWriteStep(props.dataItem)
                            ? (props.dataItem.statementType || '').toUpperCase()
                            : 'SELECT'}
                        </span>
                        <span className="sql-cell-text">
                          {isWriteStep(props.dataItem)
                            ? (props.dataItem.documentUriTemplate || '')
                            : (props.dataItem.statement || '')}
                        </span>
                      </div>
                      <Button
                        className="sql-edit-btn"
                        fillMode="flat"
                        size="small"
                        onClick={() => openSqlEditor(props.dataItem._idx, props.dataItem)}
                        title={isWriteStep(props.dataItem) ? 'Configure Write Step' : 'Edit SQL Statement'}
                      >
                        &#9998;
                      </Button>
                    </div>
                  </td>
                )
              }}
            />
            <GridColumn title="Enabled" width={115}
              editable={false}
              filterable={false}
              cells={{
                data: (props) => (
                  <td style={{ textAlign: 'center' }}>
                    <Switch
                      checked={!!props.dataItem.enable}
                      onChange={(e) => updateStep(props.dataItem._idx, 'enable', e.value)}
                    />
                  </td>
                )
              }}
            />
            {hasSelectSteps && (
              <GridColumn title="Add retrieved data to new Top Level Entity or existing Parent Entity and its Associated Entity Role">
                <GridColumn field="addAsTopLevelEntity" title="Top Level Entity" width={180}
                  cells={selectOnlyCells.addAsTopLevelEntity} />
                <GridColumn field="addToExistingEntity" title="Parent Entity" width={195}
                  cells={alwaysCells.addToExistingEntity} />
                <GridColumn field="roleName" title="Associated Entity Role" width={240}
                  cells={alwaysCells.roleName} />
                <GridColumn field="parentKey" title="Parent Key" width={160}
                  cells={selectOnlyCells.parentKey} />
                <GridColumn field="foreignKey" title="Foreign Key" width={185}
                  cells={selectOnlyCells.foreignKey} />
              </GridColumn>
            )}
            {!hasSelectSteps && (
              <GridColumn title="Write Step — Entity">
                <GridColumn field="addToExistingEntity" title="Parent Entity" width={195}
                  cells={alwaysCells.addToExistingEntity} />
                <GridColumn field="roleName" title="Associated Entity Role" width={240}
                  cells={alwaysCells.roleName} />
              </GridColumn>
            )}
            {hasSelectSteps && (
              <GridColumn field="maxRows" title="Max Rows" width={90} editable={false}
                cells={maxRowsCells}
              />
            )}
            {!hasSelectSteps && (
            <GridColumn field="collections" title="Collections" width={180} editable={false}
              cells={{
                data: (props) => {
                  if (!isWriteStep(props.dataItem)) return <td className="entity-cell-write" />
                  const cols = props.dataItem.collections
                  return (
                    <td style={{ fontSize: 12, padding: '4px 6px' }}>
                      {Array.isArray(cols) && cols.length > 0
                        ? cols.map((c, i) => (
                            <span key={i} className="grid-collection-chip">{c}</span>
                          ))
                        : <span style={{ color: '#999', fontStyle: 'italic' }}>none</span>}
                    </td>
                  )
                }
              }}
            />
            )}
            <GridColumn
              title="Actions"
              width={120}
              filterable={false}
              editable={false}
              cells={{
                data: (props) => (
                  <td style={{ overflow: 'visible', textOverflow: 'clip' }}>
                    <Button
                      themeColor="primary"
                      size="small"
                      onClick={() => removeStep(props.dataItem._idx)}
                    >
                      Delete
                    </Button>
                  </td>
                )
              }}
            />
          </Grid>
          </div>
        </div>

        <div className="query-actions">
          <Button
            themeColor="primary"
            onClick={saveQuery}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {dirty && <span className="unsaved-indicator">Unsaved changes</span>}
        </div>
      </div>
    )
  }

  // --- Render: Test Tab ---
  const renderTestTab = () => {
    if (!queryDoc) {
      return <div className="query-placeholder">Select a query to test.</div>
    }

    const params = extractParameters(queryDoc.steps)

    return (
      <div className="query-test">
        {params.length > 0 && (
          <div className="query-test-params">
            <h4>Parameters</h4>
            <div className="param-grid">
              {params.map(p => (
                <div key={p} className="param-row">
                  <label className="param-label">{`{${p}}`}</label>
                  <Input
                    value={paramValues[p] || ''}
                    onChange={(e) => setParamValues(prev => ({ ...prev, [p]: e.value }))}
                    placeholder={`Enter value for ${p}`}
                    style={{ width: 300 }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {resolvedSteps.length > 0 && (
          <div className="query-test-resolved">
            <h4>Resolved SQL</h4>
            {resolvedSteps.map((rs, idx) => (
              <div key={idx} className="query-resolved-step">
                {resolvedSteps.length > 1 && (
                  <span className="query-resolved-step-label">Step {rs.sequenceNo}</span>
                )}
                <div className="query-resolved-sql-wrap">
                  <pre className="query-resolved-sql">{rs.sql}</pre>
                  <Button
                    fillMode="flat"
                    size="small"
                    className="query-resolved-copy-btn"
                    title="Copy to clipboard"
                    onClick={() => {
                      navigator.clipboard.writeText(rs.sql)
                      setCopiedStepIdx(idx)
                      setTimeout(() => setCopiedStepIdx(null), 2000)
                    }}
                  >
                    {copiedStepIdx === idx ? '✓ Copied' : '📋 Copy'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="query-test-actions">
          <Button
            themeColor="primary"
            onClick={runTest}
            disabled={testLoading}
          >
            {testLoading ? 'Running...' : 'Run Query'}
          </Button>
        </div>

        {testError && (
          <div className="query-test-error">
            <div className="query-error-friendly">
              <span className="query-error-icon">&#9888;</span>
              <span>{testError.friendly}</span>
            </div>
            {testError.technical && (
              <details className="query-error-details">
                <summary>Technical Details</summary>
                <pre>{testError.technical}</pre>
              </details>
            )}
          </div>
        )}

        {testResults && testResults.map((result, idx) => (
          <div key={idx} className="query-test-result">
            <h4>Step {result.sequenceNo}</h4>
            {result.data && result.data.length > 0 ? (
              <Grid
                data={result.data.slice(0, 100)}
                style={{ maxHeight: 400 }}
                resizable={true}
                sortable={true}
              >
                {Object.keys(result.data[0]).map(col => (
                  <GridColumn key={col} field={col} title={col} width="150px" />
                ))}
              </Grid>
            ) : (
              <div className="query-test-no-data">No results returned</div>
            )}
            <div className="query-test-count">
              {result.data ? `${result.data.length} row(s)` : '0 rows'}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // --- Clear status after 5 seconds ---
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage])

  // --- Main render ---
  return (
    <div className="query-maintenance-page">
      {statusMessage && (
        <div className={`query-status-bar ${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}
      <Splitter
        panes={splitterPanes}
        onChange={(e) => setSplitterPanes(e.newState)}
        style={{ height: '100%' }}
      >
        {renderQueryList()}
        <div className="query-detail-panel">
          {selectedProject && !selectedUri ? (
            <div className="project-editor-panel">
              <h3 className="project-editor-title">&#128193; Project Settings</h3>
              <div className="project-editor-field">
                <label className="query-field-label">Project Name</label>
                <div className="project-editor-row">
                  <Input
                    value={projectEditName}
                    onChange={(e) => setProjectEditName(e.value)}
                    style={{ width: 360 }}
                    placeholder="Project name"
                  />
                  <Button
                    themeColor="primary"
                    onClick={renameProject}
                    disabled={projectRenaming || !projectEditName.trim() || projectEditName.trim() === selectedProject}
                  >
                    {projectRenaming ? 'Renaming…' : 'Rename Project'}
                  </Button>
                </div>
                <span className="project-editor-hint">
                  Renaming updates all {queries.filter(q => q.ruleProject === selectedProject).length} query document(s) in MarkLogic
                  — adjusting their <code>ruleProject</code> field and document URI.
                </span>
              </div>

              <div className="project-editor-field">
                <label className="query-field-label">Rule Project Directory</label>
                <Input
                  value={projectSettings[selectedProject]?.ruleProjectDir || ''}
                  onChange={(e) => updateProjectSetting('ruleProjectDir', e.value)}
                  placeholder={`e.g. C:\\Progress\\Corticon Rule Projects\\${selectedProject}`}
                  style={{ width: '100%', maxWidth: 600 }}
                />
                <span className="project-editor-hint">
                  Filesystem path to the Corticon rule project folder. Used to locate the <code>.ecore</code> vocabulary file for validation and dropdowns.
                </span>
                {projectSettings[selectedProject]?.vocabEcoreRelPath && (
                  <div className="project-vocab-file">
                    <span className="project-vocab-file-icon">&#128214;</span>
                    <span className="project-vocab-file-path">{projectSettings[selectedProject].vocabEcoreRelPath}</span>
                    {projectSettings[selectedProject]?.vocabLastModified && (
                      <span className="project-vocab-file-date">
                        {(() => { const d = new Date(projectSettings[selectedProject].vocabLastModified); const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` })()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="project-editor-field">
                <label className="query-field-label">Corticon.js Work Location</label>
                <Input
                  value={projectSettings[selectedProject]?.corticonJsWorkLocation || ''}
                  onChange={(e) => updateProjectSetting('corticonJsWorkLocation', e.value)}
                  placeholder="e.g. C:\Progress\Corticon.js_Work_2.4"
                  style={{ width: '100%', maxWidth: 600 }}
                />
                <span className="project-editor-hint">
                  Used to locate XSLT/CSS for the vocabulary report and the Corticon JRE (<code>…jre\bin\java.exe</code>).
                </span>
              </div>

              <div className="project-editor-row" style={{ marginTop: 12 }}>
                <Button
                  themeColor="primary"
                  onClick={saveProjectSettings}
                  disabled={!projectSettingsDirty}
                >
                  Save Settings
                </Button>
                <Button
                  fillMode="outline"
                  onClick={refreshVocabulary}
                  disabled={vocabRefreshing || !projectSettings[selectedProject]?.ruleProjectDir?.trim()}
                  title="Generate vocabulary manifest for query validation and dropdowns"
                >
                  {vocabRefreshing ? '⏳ Refreshing Vocabulary…' : '↺ Refresh Vocabulary'}
                </Button>
              </div>
            </div>
          ) : (
          <TabStrip selected={tabIndex} onSelect={(e) => setTabIndex(e.selected)}>
            <TabStripTab title="Definition">
              {renderDefinitionTab()}
            </TabStripTab>
            <TabStripTab title="Test Query">
              {renderTestTab()}
            </TabStripTab>
          </TabStrip>
          )}
        </div>
      </Splitter>
      {sqlEditorOpen && (
        <Dialog
          title={isWriteStep({ statementType: sqlEditorStatementType }) ? 'Configure Write Step' : 'Edit SQL Statement'}
          onClose={cancelSqlEditor}
          className="qm-sql-dialog"
          width={700}
          height={550}
        >
          <div className="sql-editor-dialog">
            <div className="sql-editor-type-row">
              <span className="sql-editor-type-label">Statement Type</span>
              <div className="sql-type-selector">
                <button
                  className={`sql-type-btn${sqlEditorStatementType === 'select' ? ' active' : ''}`}
                  onClick={() => setSqlEditorStatementType('select')}
                  type="button"
                  title={writeEditorParentEntity.trim() || writeEditorUriTemplate.trim()
                    ? 'Clear the write configuration (Parent Entity, URI Template) before switching to SELECT'
                    : 'Read data into Corticon working memory'}
                  disabled={!!(writeEditorParentEntity.trim() || writeEditorUriTemplate.trim())}
                >SELECT</button>
                <button
                  className={`sql-type-btn write${sqlEditorStatementType === 'insert' ? ' active' : ''}`}
                  onClick={() => setSqlEditorStatementType('insert')}
                  type="button"
                  title={sqlEditorValue.trim()
                    ? 'Clear the SQL statement before switching to a write type'
                    : 'Create document; error if URI already exists'}
                  disabled={!!sqlEditorValue.trim()}
                >Insert</button>
                <button
                  className={`sql-type-btn write${sqlEditorStatementType === 'update' ? ' active' : ''}`}
                  onClick={() => setSqlEditorStatementType('update')}
                  type="button"
                  title={sqlEditorValue.trim()
                    ? 'Clear the SQL statement before switching to a write type'
                    : 'Merge into existing document; error if URI is absent'}
                  disabled={!!sqlEditorValue.trim()}
                >Update</button>
                <button
                  className={`sql-type-btn write${sqlEditorStatementType === 'upsert' ? ' active' : ''}`}
                  onClick={() => setSqlEditorStatementType('upsert')}
                  type="button"
                  title={sqlEditorValue.trim()
                    ? 'Clear the SQL statement before switching to a write type'
                    : 'Merge if exists, create if not'}
                  disabled={!!sqlEditorValue.trim()}
                >Upsert</button>
              </div>
            </div>
            {isWriteStep({ statementType: sqlEditorStatementType }) ? (
              <div className="write-config-panel">
                <div className="write-config-row">
                  <label className="write-config-label">Parent Entity <span className="write-req">*</span></label>
                  {vocabManifest ? (
                    <ComboBox
                      data={Object.keys(vocabManifest.entities).sort()}
                      value={writeEditorParentEntity}
                      onChange={(e) => {
                        setWriteEditorParentEntity(e.value || '')
                        setWriteEditorRoleName('')  // reset role when entity changes
                      }}
                      allowCustom={true}
                      placeholder="e.g. Products"
                      style={{ width: '100%' }}
                    />
                  ) : (
                    <Input
                      value={writeEditorParentEntity}
                      onChange={(e) => setWriteEditorParentEntity(e.value)}
                      placeholder="e.g. RoutingOutput"
                      style={{ width: '100%' }}
                    />
                  )}
                  <span className="write-config-hint">
                    Required. Anchor entity type to locate in working memory.
                    Write steps <em>read from</em> WM; SELECT steps <em>write into</em> WM.
                  </span>
                </div>
                <div className="write-config-row">
                  <label className="write-config-label">Associated Entity Role</label>
                  {vocabManifest ? (
                    <ComboBox
                      data={(() => {
                        const parentId = resolveEntityId(writeEditorParentEntity, vocabManifest)
                        return parentId ? Object.keys(vocabManifest.entities[parentId].roles).sort() : []
                      })()}
                      value={writeEditorRoleName}
                      onChange={(e) => setWriteEditorRoleName(e.value || '')}
                      allowCustom={true}
                      placeholder="e.g. routingOutput — leave empty to write Parent Entity instances"
                      style={{ width: '100%' }}
                    />
                  ) : (
                    <Input
                      value={writeEditorRoleName}
                      onChange={(e) => setWriteEditorRoleName(e.value)}
                      placeholder="e.g. treatment — leave empty to write Parent Entity instances"
                      style={{ width: '100%' }}
                    />
                  )}
                </div>
                <div className="write-config-row">
                  <label className="write-config-label">Document URI Template <span className="write-req">*</span></label>
                  <div ref={uriTemplateWrapRef} style={{ position: 'relative', width: '100%' }}>
                    <Input
                      value={writeEditorUriTemplate}
                      onChange={handleUriChange}
                      onKeyDown={handleUriKeyDown}
                      placeholder="e.g. /data/Paris/RoutingOutput/{matNr}.json"
                      style={{ width: '100%' }}
                    />
                    {acOpen && acTarget === 'uri' && acSuggestions.length > 0 && (
                      <div className="vocab-ac-popup vocab-ac-popup-input">
                        <input
                          className="vocab-ac-filter"
                          value={acFilter}
                          onChange={e => { setAcFilter(e.target.value); setAcHighlight(0) }}
                          onKeyDown={handleAcFilterKeyDown}
                          placeholder="Filter…"
                          autoComplete="off"
                        />
                        <ul ref={acListRef}>
                          {visibleSuggestions.map((s, i) => (
                            <li key={s} className={i === acHighlight ? 'highlighted' : ''}
                              onMouseDown={(e) => { e.preventDefault(); insertSuggestion(s) }}>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <span className="write-config-hint">
                    Use <code>{'{attributeName}'}</code> to include an entity attribute value in the URI.
                    The placeholder is the <strong>attribute name only</strong> — not the full vocabulary path.
                    Example: <code>/data/Paris/RoutingOutput/{'{matNr}'}.json</code> where <code>matNr</code> is an attribute on the target entity.
                    If no placeholder is provided, a server-generated UUID is appended automatically.
                  </span>
                </div>
                <div className="write-config-row">
                  <label className="write-config-label">Collections</label>
                  <div className="collections-chip-input">
                    {writeEditorCollections.map((col, i) => (
                      <span key={i} className="collection-chip">
                        {col}
                        <button
                          type="button"
                          className="collection-chip-remove"
                          onClick={() => setWriteEditorCollections(prev => prev.filter((_, ci) => ci !== i))}
                          aria-label={`Remove collection ${col}`}
                        >×</button>
                      </span>
                    ))}
                    <input
                      type="text"
                      className="collection-input"
                      value={writeEditorCollInput}
                      onChange={(e) => setWriteEditorCollInput(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ',') && writeEditorCollInput.trim()) {
                          e.preventDefault()
                          setWriteEditorCollections(prev => [...prev, writeEditorCollInput.trim()])
                          setWriteEditorCollInput('')
                        }
                      }}
                      placeholder="Type collection name and press Enter"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="sql-editor-textarea-wrap" ref={sqlEditorWrapRef} style={{ position: 'relative' }}>
                  <TextArea
                    value={sqlEditorValue}
                    onChange={handleSqlChange}
                    onKeyDown={handleSqlKeyDown}
                    rows={10}
                    style={{ width: '100%', fontFamily: "'Consolas', 'Monaco', monospace", fontSize: 13 }}
                    autoFocus
                  />
                  {acOpen && acTarget === 'sql' && acSuggestions.length > 0 && (
                    <div className="vocab-ac-popup">
                      <input
                        className="vocab-ac-filter"
                        value={acFilter}
                        onChange={e => { setAcFilter(e.target.value); setAcHighlight(0) }}
                        onKeyDown={handleAcFilterKeyDown}
                        placeholder="Filter…"
                        autoComplete="off"
                      />
                      <ul ref={acListRef}>
                        {visibleSuggestions.map((s, i) => (
                          <li key={s} className={i === acHighlight ? 'highlighted' : ''}
                            onMouseDown={(e) => { e.preventDefault(); insertSuggestion(s) }}>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {sqlEditorWarnings.length > 0 && (
                  <div className="sql-editor-warnings">
                    <span className="sql-warning-icon">&#9888;</span>
                    <ul>
                      {sqlEditorWarnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogActionsBar>
            <Button onClick={cancelSqlEditor}>Cancel</Button>
            <Button themeColor="primary" onClick={saveSqlEditor}>Save</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </div>
  )
}
