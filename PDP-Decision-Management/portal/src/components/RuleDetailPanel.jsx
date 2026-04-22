// ── RuleDetailPanel helpers ─────────────────────────────────────────────────
// Extract the target attribute path from an action expression.
// e.g. "validation.isMatchOnPackaging" (value=T) → "validation.isMatchOnPackaging"
//      "calculation.nBDiscsPerInterm = calc.rollWidth * ..." (value=X) → "calculation.nBDiscsPerInterm"
// Returns null for entity creations / unsupported patterns.
function extractActionAttrPath(expression, value) {
  let lhs
  if (value === 'X') {
    const eqIdx = expression.indexOf('=')
    lhs = eqIdx >= 0
      ? expression.slice(0, eqIdx).replace(/\s*[+]?\s*$/, '').trim()
      : expression.trim()
  } else {
    lhs = expression.trim()
  }
  // Must contain a dot; must not contain spaces, brackets or parens (those are formula fragments)
  if (!lhs || !lhs.includes('.') || lhs.includes(' ') || lhs.includes('[') || lhs.includes('(')) return null
  return lhs
}

// Navigate the payload item to find the actual value of an attribute.
// aliasEntity: e.g. "Products.validationResults" — first segment is the root entity (=payloadItem)
// attrSubPath: e.g. "isMatchOnPackaging" or "validationResults.isMatchOnPackaging"
function resolvePayloadValue(payloadItem, aliasEntity, attrSubPath) {
  if (!payloadItem || !aliasEntity || !attrSubPath) return undefined
  const entitySegments = aliasEntity.split('.')
  let current = payloadItem
  for (let i = 1; i < entitySegments.length; i++) {
    if (current == null) return undefined
    current = current[entitySegments[i]]
    if (Array.isArray(current)) current = current[0]
  }
  const attrSegments = attrSubPath.split('.')
  for (let i = 0; i < attrSegments.length - 1; i++) {
    if (current == null) return undefined
    current = current[attrSegments[i]]
    if (Array.isArray(current)) current = current[0]
  }
  if (current == null) return undefined
  return current[attrSegments[attrSegments.length - 1]]
}

function formatRespValue(val) {
  if (val === true)  return 'T'
  if (val === false) return 'F'
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

// ── RuleDetailPanel ──────────────────────────────────────────────────────────
// Shown inside expanded rows of the Rule Messages and Rule Trace grids.
// Looks up the rulesheet + rule in the ruleflow JSON doc stored in MarkLogic
// and renders its conditions, actions, and (optionally) rule statements.
//
// rsNameField  — dataItem field holding the rulesheet name:
//   • messages grid : 'ruleSheet'     (already clean, e.g. "Check makeability data retrieval")
//   • trace grid    : 'rulesheetName' (full file URI — stripped internally)
// ruleNumField — dataItem field holding the rule number (e.g. "3", "A0")
// showRuleStatements — false in the messages grid (parent row IS the statement)
// result — full corticon execution result (for Response value(s) section)
// allMsgs — full msgs array (messages grid only); used to determine occurrence index
export function RuleDetailPanel({ dataItem, ruleflowDoc, loading, error, rsNameField, ruleNumField, showRuleStatements, result, allMsgs }) {
  if (loading) {
    return <div style={rdpStyles.wrap}><span style={rdpStyles.muted}>Loading ruleflow documentation…</span></div>
  }
  if (error) {
    return <div style={rdpStyles.wrap}><span style={rdpStyles.errText}>Could not load ruleflow documentation: {error}</span></div>
  }
  if (!ruleflowDoc) {
    return <div style={rdpStyles.wrap}><span style={rdpStyles.muted}>Ruleflow documentation not available for this configuration.</span></div>
  }

  // Normalise rulesheet name: strip "file:/…/" prefix and ".ers" extension
  function normaliseRulesheet(raw) {
    if (!raw) return ''
    return raw.replace(/^file:\/+/i, '').replace(/\\/g, '/').split('/').pop().replace(/\.ers$/i, '')
  }

  const rsRaw      = dataItem[rsNameField] || ''
  const rsName     = rsNameField === 'rulesheetName' ? normaliseRulesheet(rsRaw) : rsRaw
  const ruleNumRaw = String(dataItem[ruleNumField] || '')
  const ruleId     = ruleNumRaw.startsWith('Rule_') ? ruleNumRaw : `Rule_${ruleNumRaw}`

  const rulesheets = ruleflowDoc?.catalog?.rulesheets || []
  const rulesheet  = rulesheets.find(rs => rs.ccName === rsName)
  if (!rulesheet) {
    return (
      <div style={rdpStyles.wrap}>
        <span style={rdpStyles.muted}>Rulesheet <strong>{rsName}</strong> not found in ruleflow documentation.</span>
      </div>
    )
  }
  const rule = rulesheet.rules?.find(r => r.ruleId === ruleId)
  if (!rule) {
    return (
      <div style={rdpStyles.wrap}>
        <span style={rdpStyles.muted}>Rule <strong>{ruleId}</strong> not found in rulesheet <strong>{rsName}</strong>.</span>
      </div>
    )
  }

  const conditions     = rule.conditions     || []
  const actions        = rule.actions        || []
  const rulestatements = rule.rulestatements || []

  // ── Response value(s) ──────────────────────────────────────────────
  // Strategy:
  // • Trace mode  (rsNameField==='rulesheetName'): the dataItem IS the trace entry.
  //   For the attribute this row records, use dataItem.afterValue directly (no ambiguity).
  //   For other action attributes in the same rule, fall back to payload.
  // • Messages mode: rules fire once per entity instance → multiple messages + trace entries
  //   for the same (rulesheet, rule). Determine which occurrence this message is among
  //   all messages with identical (ruleSheet, rule), then pick the Nth trace entry for
  //   each action attribute, ordered by sequence.
  const isTraceMode   = rsNameField === 'rulesheetName'
  const aliases       = rulesheet.aliases || []
  const attrChanges   = result?.corticon?.Metrics?.attributeChanges || []
  const normaliseRS   = (raw) => raw
    ? raw.replace(/^file:\/+/i, '').replace(/\\/g, '/').split('/').pop().replace(/\.ers$/i, '')
    : ''
  // Extract just the attribute name (last segment after alias dot-path)
  const getAttrName   = (attrPath) => attrPath.slice(attrPath.indexOf('.') + 1).split('.').pop()

  const responseValues = []
  const seen = new Set()

  if (isTraceMode) {
    // Trace grid: dataItem.afterValue is already the right value for the recorded attribute.
    // For any other attributes set by the same rule, fall back to payload.
    const payloadItem = result?.payload?.[0] ?? null
    for (const action of actions) {
      const attrPath = extractActionAttrPath(action.expression, action.value)
      if (!attrPath || seen.has(attrPath)) continue
      seen.add(attrPath)
      const attrName = getAttrName(attrPath)
      if (attrName === dataItem.attributeName) {
        // This trace row records exactly this attribute — use it directly
        if (dataItem.afterValue !== undefined && dataItem.afterValue !== null && dataItem.afterValue !== '') {
          responseValues.push({ label: attrPath, value: String(dataItem.afterValue) })
        }
      } else if (payloadItem) {
        const dotIdx = attrPath.indexOf('.')
        const aliasName = attrPath.slice(0, dotIdx)
        const attrSubPath = attrPath.slice(dotIdx + 1)
        const aliasDef = aliases.find(a => a.name === aliasName)
        const entityPath = aliasDef ? aliasDef.entity : aliasName
        const val = resolvePayloadValue(payloadItem, entityPath, attrSubPath)
        if (val !== undefined && val !== null) {
          responseValues.push({ label: attrPath, value: formatRespValue(val) })
        }
      }
    }
  } else {
    // Messages grid: determine which occurrence this message is for (ruleSheet, rule)
    const occurrenceIdx = (allMsgs || [])
      .filter(m => m.ruleSheet === dataItem.ruleSheet && m.rule === dataItem.rule && m._id < dataItem._id)
      .length
    const payloadItem = result?.payload?.[0] ?? null
    for (const action of actions) {
      const attrPath = extractActionAttrPath(action.expression, action.value)
      if (!attrPath || seen.has(attrPath)) continue
      seen.add(attrPath)
      const attrName = getAttrName(attrPath)
      // Find all trace entries for this (rulesheet, ruleNumber, attributeName), sorted by sequence
      const traceMatches = attrChanges
        .filter(t =>
          normaliseRS(t.rulesheetName) === rsName &&
          String(t.ruleNumber) === ruleNumRaw &&
          t.attributeName === attrName
        )
        .sort((a, b) => a.sequence - b.sequence)
      if (traceMatches.length > 0) {
        const entry = traceMatches[occurrenceIdx] ?? traceMatches[traceMatches.length - 1]
        if (entry.afterValue !== undefined && entry.afterValue !== null) {
          responseValues.push({ label: attrPath, value: formatRespValue(entry.afterValue) })
        }
      } else if (payloadItem) {
        // No trace data (rule tracing not enabled) — fall back to payload
        const dotIdx = attrPath.indexOf('.')
        const aliasName = attrPath.slice(0, dotIdx)
        const attrSubPath = attrPath.slice(dotIdx + 1)
        const aliasDef = aliases.find(a => a.name === aliasName)
        const entityPath = aliasDef ? aliasDef.entity : aliasName
        const val = resolvePayloadValue(payloadItem, entityPath, attrSubPath)
        if (val !== undefined && val !== null) {
          responseValues.push({ label: attrPath, value: formatRespValue(val) })
        }
      }
    }
  }

  const severityStyle = (sev) => {
    if (sev === 'Violation') return { color: '#d32f2f', fontWeight: 600 }
    if (sev === 'Warning')   return { color: '#f57c00', fontWeight: 600 }
    return { color: '#1976d2', fontWeight: 600 }
  }

  return (
    <div style={rdpStyles.wrap}>
      <div style={rdpStyles.header}>{rsName} · {ruleId}</div>

      {/* Conditions */}
      <div style={rdpStyles.section}>
        <div style={rdpStyles.sectionLabel}>Conditions</div>
        {conditions.length === 0
          ? <span style={rdpStyles.muted}>Always fires — no conditions</span>
          : (
            <table style={rdpStyles.table}>
              <colgroup><col /><col style={{ width: '200px' }} /></colgroup>
              <thead><tr>
                <th style={rdpStyles.th}>Expression</th>
                <th style={rdpStyles.th}>Value</th>
              </tr></thead>
              <tbody>
                {conditions.map((c, i) => (
                  <tr key={i}>
                    <td style={rdpStyles.td}><code style={rdpStyles.code}>{c.expression}</code></td>
                    <td style={rdpStyles.tdVal}><code style={rdpStyles.code}>{c.value}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      {/* Actions */}
      <div style={rdpStyles.section}>
        <div style={rdpStyles.sectionLabel}>Actions</div>
        <table style={rdpStyles.table}>
          <colgroup><col /><col style={{ width: '200px' }} /></colgroup>
          <thead><tr>
            <th style={rdpStyles.th}>Expression</th>
            <th style={rdpStyles.th}>Value</th>
          </tr></thead>
          <tbody>
            {actions.map((a, i) => (
              <tr key={i}>
                <td style={rdpStyles.td}><code style={rdpStyles.code}>{a.expression}</code></td>
                <td style={rdpStyles.tdVal}><code style={rdpStyles.code}>{a.value}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rule Statements — suppressed for Rule Messages grid (parent IS the statement) */}
      {showRuleStatements && rulestatements.length > 0 && (
        <div style={rdpStyles.section}>
          <div style={rdpStyles.sectionLabel}>Rule Statements</div>
          <table style={rdpStyles.table}>
            <thead><tr>
              <th style={rdpStyles.th}>Severity</th>
              <th style={rdpStyles.th}>Alias</th>
              <th style={rdpStyles.th}>Text</th>
            </tr></thead>
            <tbody>
              {rulestatements.map((s, i) => (
                <tr key={i}>
                  <td style={{ ...rdpStyles.tdVal, ...severityStyle(s.severity) }}>{s.severity}</td>
                  <td style={rdpStyles.tdVal}><code style={rdpStyles.code}>{s.alias}</code></td>
                  <td style={rdpStyles.td}>{s.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Response value(s) */}
      {responseValues.length > 0 && (
        <div style={rdpStyles.section}>
          <div style={rdpStyles.sectionLabel}>Response value(s)</div>
          <table style={rdpStyles.table}>
            <colgroup><col /><col style={{ width: '200px' }} /></colgroup>
            <thead><tr>
              <th style={rdpStyles.th}>Attribute</th>
              <th style={rdpStyles.th}>Value</th>
            </tr></thead>
            <tbody>
              {responseValues.map((rv, i) => (
                <tr key={i}>
                  <td style={rdpStyles.td}><code style={rdpStyles.code}>{rv.label}</code></td>
                  <td style={rdpStyles.tdVal}><code style={rdpStyles.code}>{rv.value}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export const rdpStyles = {
  wrap:         { padding: '10px 16px 10px 48px', background: 'var(--kendo-color-surface, #f9f9f9)' },
  header:       { fontWeight: 700, fontSize: '12px', marginBottom: '10px', color: 'var(--kendo-color-on-app-surface, #333)' },
  section:      { marginBottom: '10px' },
  sectionLabel: { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '4px' },
  muted:        { fontSize: '12px', color: '#888', fontStyle: 'italic' },
  errText:      { fontSize: '12px', color: '#d32f2f' },
  table:        { borderCollapse: 'collapse', fontSize: '12px', width: '100%', maxWidth: '900px' },
  th:           { textAlign: 'left', padding: '3px 10px', borderBottom: '1px solid #ddd', fontWeight: 600, fontSize: '11px', color: '#666' },
  td:           { padding: '3px 10px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top', wordBreak: 'break-word' },
  tdVal:        { padding: '3px 10px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top', whiteSpace: 'nowrap' },
  code:         { fontFamily: 'Consolas, monospace', fontSize: '11px' }
}
