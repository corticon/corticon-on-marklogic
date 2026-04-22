import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Splitter, TabStrip, TabStripTab } from '@progress/kendo-react-layout'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import JsonExplorer from '../components/JsonExplorer'
import { TreeView } from '@progress/kendo-react-treeview'
import { Button } from '@progress/kendo-react-buttons'
import { DropDownList } from '@progress/kendo-react-dropdowns'
import { TextArea, NumericTextBox } from '@progress/kendo-react-inputs'
import { Grid, GridColumn } from '@progress/kendo-react-grid'
import { orderBy, filterBy } from '@progress/kendo-data-query'
import './DecisionServiceTestPage.css'
import { RuleDetailPanel, rdpStyles } from '../components/RuleDetailPanel'

const PROXY_BASE = import.meta.env.VITE_ML_SCHEME + '://' +
  import.meta.env.VITE_ML_HOST + ':' + import.meta.env.VITE_ML_PORT +
  (import.meta.env.VITE_ML_BASE_PATH || '')

const AUTH_HEADER = 'Basic ' + btoa(
  import.meta.env.VITE_ML_USERNAME + ':' + import.meta.env.VITE_ML_PASSWORD
)

const COLLECTION = 'DeploymentConfigs'

const STORAGE_PREFIX = 'dst-input-json:'
const HISTORY_KEY    = 'dst-request-history'

// Derive a human-readable label from a stored JSON payload string.
// Tries to extract plant/className/shape/subshape/mfgDesign from the first item,
// falling back to bundleName if none of those fields are present.
function deriveHistoryLabel(jsonStr, bundleName) {
  try {
    const parsed = JSON.parse(jsonStr)
    const item = Array.isArray(parsed) ? parsed[0] : parsed
    if (item && typeof item === 'object') {
      const parts = [item.matnr, item.plant, item.className, item.shape, item.subshape, item.mfgDesign]
        .filter(v => v != null && v !== '')
      if (parts.length > 0) return parts.join(' / ')
    }
  } catch {}
  return bundleName || 'unknown'
}

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

export default function DecisionServiceTestPage() {
  // ── Config selection state ──────────────────────────────────────────
  const [configs, setConfigs] = useState([])
  const [treeData, setTreeData] = useState([])
  const [selectedUri, setSelectedUri] = useState(null)
  const [selectedConfig, setSelectedConfig] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [splitterPanes, setSplitterPanes] = useState([
    { size: '320px', min: '220px', max: '520px', collapsible: true, resizable: true },
    { min: '500px' }
  ])

  // ── Test execution state ────────────────────────────────────────────
  const [inputJson, setInputJson] = useState('')
  const [inputError, setInputError] = useState(null)

  // ── Persist inputJson to sessionStorage per config URI ──────────────
  useEffect(() => {
    if (selectedUri) {
      sessionStorage.setItem(STORAGE_PREFIX + selectedUri, inputJson)
    }
  }, [inputJson, selectedUri])
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState(null)
  const [resultError, setResultError] = useState(null)
  const [statusMessage, setStatusMessage] = useState(null)
  const [showCorticon, setShowCorticon] = useState(false)
  const [processingTime, setProcessingTime] = useState(null)   // ms
  const [lastExecution, setLastExecution] = useState(null)     // timestamp from Corticon response (ML server clock)
  const [debugEngine, setDebugEngine] = useState(false)        // logLevel 1 when true
  const [ruleTracing, setRuleTracing] = useState(false)        // executionMetrics when true
  const [logRows, setLogRows] = useState([])                  // parsed log rows for the grid
  const [logDialogOpen, setLogDialogOpen] = useState(false)
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState(null)
  const [logWindowInfo, setLogWindowInfo] = useState(null)     // { start, end } shown in dialog header
  const [logSort, setLogSort] = useState([])
  const [logFilter, setLogFilter] = useState(null)
  const [inputTab, setInputTab] = useState(0)                  // 0=Raw JSON, 1=Explorer
  const [outputTab, setOutputTab] = useState(0)                // 0=Raw JSON, 1=Explorer
  const [copiedResult, setCopiedResult] = useState(false)
  const [copiedLog, setCopiedLog] = useState(false)
  const [bundleDeployedAt, setBundleDeployedAt] = useState(null) // datetime of bundle file in MarkLogic
  const [bundleExists,     setBundleExists]     = useState(false) // bundle confirmed present in MarkLogic

  // ── Request history (persisted to localStorage) ─────────────────────
  const [history, setHistory] = useState(() => {
    try {
      const pad = n => String(n).padStart(2, '0')
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').map(e => {
        if (!e.timestamp) return e
        const d = new Date(e.timestamp)
        if (isNaN(d)) return e
        const dateStr = `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        const dataLabel = deriveHistoryLabel(e.json, e.bundleName)
        return { ...e, label: `${dataLabel} — ${dateStr}` }
      })
    } catch { return [] }
  })
  const [selectedHistory, setSelectedHistory] = useState(null)

  // ── Main tabs (Test / Rule Messages / Rule Trace) ──────────────────
  const [mainTab,     setMainTab]     = useState(0)

  // ── Analysis grids (Rule Messages / Rule Trace) ────────────────────
  const [msgSort,     setMsgSort]       = useState([])
  const [msgFilter,   setMsgFilter]     = useState(null)
  const [traceSort,   setTraceSort]     = useState([{ field: 'sequence', dir: 'asc' }])
  const [traceFilter, setTraceFilter]   = useState(null)

  // ── Ruleflow documentation (fetched lazily on first row expand) ─────
  const [ruleflowDoc,        setRuleflowDoc]        = useState(null)
  const [ruleflowDocLoading, setRuleflowDocLoading] = useState(false)
  const [ruleflowDocError,   setRuleflowDocError]   = useState(null)
  const ruleflowCacheRef = useRef({})   // keyed by selectedUri

  // ── Rule expand state ───────────────────────────────────────────────
  const [msgExpanded,   setMsgExpanded]   = useState({})
  const [traceExpanded, setTraceExpanded] = useState({})

  // ── Compilation state ───────────────────────────────────────────────
  const [compiling, setCompiling]     = useState(false)
  const [compilePhase, setCompilePhase] = useState('compiling') // 'compiling' | 'deploying'
  const [compileLog, setCompileLog]   = useState([])             // [{line, stream}]
  const [compileDone, setCompileDone] = useState(null)           // null | 'success' | 'error'
  const [deployVersion, setDeployVersion] = useState(1)          // version number to deploy as
  const [maxDeployedVersion, setMaxDeployedVersion] = useState(0) // highest version already deployed
  const logBodyRef = useRef(null)
  const esRef      = useRef(null)   // active EventSource

  // ── Load deployment configs from MarkLogic ──────────────────────────
  const loadConfigs = useCallback(async () => {
    setLoadingConfigs(true)
    try {
      const res = await mlFetch(
        '/v1/search?format=json&pageLength=500&options=corticonml-options&start=1',
        {
          method: 'POST',
          body: JSON.stringify({
            query: { 'collection-query': { uri: [COLLECTION] } }
          })
        }
      )
      if (!res.ok) throw new Error(`Search failed: ${res.status}`)
      const data = await res.json()
      const list = (data.results || []).map(r => {
        const content = r.extracted?.content?.[0] || {}
        // New format: deployedVersions array in single doc per bundle
        const deployedVersions = Array.isArray(content.deployedVersions) ? content.deployedVersions : []
        const latestVersion = deployedVersions.length > 0
          ? deployedVersions.reduce((best, v) => v.version > best.version ? v : best)
          : null
        // Fall back to legacy top-level fields (backward compat with old versioned docs)
        const bundleVersion = latestVersion?.version ?? (content.bundleVersion != null ? parseInt(content.bundleVersion, 10) : null)
        const bundleUri = latestVersion?.bundleUri || content.bundleUri || (
          (content.projectName && content.bundleName && bundleVersion != null)
            ? `/ext/${content.projectName}/${content.bundleName}/${bundleVersion}/decisionServiceBundle.js`
            : ''
        )
        const ruleflowUri = latestVersion?.ruleflowUri || content.ruleflowUri || null
        return {
          uri: r.uri,
          projectName: content.projectName || 'Unassigned',
          bundleName: content.bundleName || r.uri.split('/').pop().replace('.json', ''),
          bundleVersion,
          bundleUri,
          ruleflowUri,
          deployedVersions,
          mlHost: content.deployment?.mlHost || null,
          mlRestPort: content.deployment?.mlRestPort || null,
          mlAppName: content.deployment?.mlAppName || ''
        }
      })
      // Only show target-format docs (/DeploymentConfigs/{proj}/{bundle}.json) in the tree —
      // skip any lingering legacy versioned docs that DeploymentConfigPage hasn't migrated yet.
      const filtered = list.filter(c => {
        const segs = c.uri.split('/').filter(Boolean)
        return !(segs[0] === 'DeploymentConfigs' && segs.length === 4) &&
               !(segs[0] === 'deployment')
      })
      filtered.sort((a, b) => {
        const p = a.projectName.localeCompare(b.projectName)
        if (p !== 0) return p
        return a.bundleName.localeCompare(b.bundleName)
      })
      setConfigs(filtered)
    } catch (err) {
      console.error('Failed to load configs:', err)
      setStatusMessage({ type: 'error', text: 'Failed to load configurations: ' + err.message })
    } finally {
      setLoadingConfigs(false)
    }
  }, [])

  useEffect(() => { loadConfigs() }, [loadConfigs])

  // ── Derive bundle deploy info from selectedConfig (already loaded from MarkLogic) ───
  useEffect(() => {
    if (!selectedConfig?.bundleUri) { setBundleDeployedAt(null); setBundleExists(false); return }
    const versions = selectedConfig.deployedVersions || []
    const match = versions.find(v => v.bundleUri === selectedConfig.bundleUri)
    const latest = versions.length > 0 ? versions.reduce((best, v) => v.version > best.version ? v : best) : null
    const entry = match || latest
    setBundleDeployedAt(entry?.deployedAt || null)
    setBundleExists(!!entry)
  }, [selectedConfig?.bundleUri, selectedConfig?.deployedVersions])

  // ── Keep selectedConfig in sync when configs list refreshes ─────────
  // After loadConfigs() returns fresh data (e.g. post-deploy), this ensures the
  // bundle bar and version picker reflect the latest stored doc for the selected URI.
  useEffect(() => {
    if (!selectedUri) return
    const found = configs.find(c => c.uri === selectedUri)
    if (found) setSelectedConfig(found)
  }, [selectedUri, configs])

  // ── Compute max deployed version for the selected bundle ─────────────
  useEffect(() => {
    if (!selectedConfig) { setMaxDeployedVersion(0); setDeployVersion(1); return }
    const versions = selectedConfig.deployedVersions || []
    const maxV = versions.reduce((m, v) => Math.max(m, v.version ?? 0), 0)
    setMaxDeployedVersion(maxV)
    setDeployVersion(maxV > 0 ? maxV : 1)
  }, [selectedConfig])

  // ── Build TreeView from configs ─────────────────────────────────────
  useEffect(() => {
    const projectMap = {}
    configs.forEach(c => {
      const proj = c.projectName || 'Unassigned'
      if (!projectMap[proj]) projectMap[proj] = []
      projectMap[proj].push(c)
    })
    const tree = Object.keys(projectMap).sort().map(proj => ({
      text: proj,
      isProject: true,
      expanded: proj === selectedProject || (selectedUri && projectMap[proj].some(c => c.uri === selectedUri)),
      items: projectMap[proj].map(c => ({
        text: c.bundleVersion != null ? `${c.bundleName} (v${c.bundleVersion})` : c.bundleName,
        uri: c.uri,
        selected: c.uri === selectedUri
      }))
    }))
    setTreeData(tree)
  }, [configs, selectedUri, selectedProject])

  // ── TreeView handlers ───────────────────────────────────────────────
  const handleTreeExpandChange = (event) => {
    setTreeData(prev => prev.map(node =>
      node.text === event.item.text && node.isProject
        ? { ...node, expanded: !node.expanded }
        : node
    ))
  }

  const handleTreeItemClick = (event) => {
    const item = event.item
    if (item.isProject) {
      setSelectedProject(item.text)
      setSelectedUri(null)
      setSelectedConfig(null)
    } else if (item.uri) {
      setSelectedUri(item.uri)
      const cfg = configs.find(c => c.uri === item.uri)
      setSelectedConfig(cfg || null)
      setSelectedProject(cfg?.projectName || null)
      // Restore saved payload for this config
      const saved = sessionStorage.getItem(STORAGE_PREFIX + item.uri) || ''
      setInputJson(saved)
      setInputError(null)
      if (saved) validateInput(saved)
      setResult(null)
      setResultError(null)
      setStatusMessage(null)
      setProcessingTime(null)
      setLastExecution(null)
      setLogRows([])
      setLogWindowInfo(null)
      setLogError(null)
      // Reset ruleflow doc and expand state for the new config
      setRuleflowDoc(ruleflowCacheRef.current[item.uri] || null)
      setRuleflowDocLoading(false)
      setRuleflowDocError(null)
      setMsgExpanded({})
      setTraceExpanded({})
    }
  }

  // ── Lazily load the ruleflow doc for the selected config ─────────────
  // Called when the user first expands a row in the Rule Messages or Rule Trace grid.
  // Fetches the full deployment config doc to extract compilation.inputErf, derives
  // the ruleflow URI (/rules/{projectName}/{ruleflowName}.json), then fetches that doc.
  // Result is cached by selectedUri so repeated expansions don't re-fetch.
  const loadRuleflowDocIfNeeded = useCallback(async () => {
    if (!selectedConfig?.uri) return
    const cacheKey = selectedConfig.uri
    if (ruleflowCacheRef.current[cacheKey] || ruleflowDocLoading) return
    setRuleflowDocLoading(true)
    setRuleflowDocError(null)
    try {
      let ruleflowUri = selectedConfig.ruleflowUri || null
      if (!ruleflowUri) {
        // Fallback: fetch full config doc to derive ruleflow URI from compilation.inputErf
        const cfgRes = await mlFetch(`/v1/documents?uri=${encodeURIComponent(cacheKey)}&format=json`)
        if (!cfgRes.ok) throw new Error(`Config fetch failed (HTTP ${cfgRes.status})`)
        const cfgDoc = await cfgRes.json()
        const inputErf = cfgDoc?.compilation?.inputErf
        if (!inputErf) throw new Error('No compilation.inputErf in deployment config.')
        const ruleflowName = inputErf.replace(/\\/g, '/').split('/').pop().replace(/\.erf$/i, '')
        const projectName  = selectedConfig.projectName || cfgDoc.projectName || ''
        ruleflowUri = `/rules/${projectName}/${ruleflowName}.json`
      }
      const rfRes = await mlFetch(`/v1/documents?uri=${encodeURIComponent(ruleflowUri)}&format=json`)
      if (!rfRes.ok) throw new Error(`Ruleflow doc not found at ${ruleflowUri} (HTTP ${rfRes.status}). Compile the rules first.`)
      const rfDoc = await rfRes.json()
      ruleflowCacheRef.current[cacheKey] = rfDoc
      setRuleflowDoc(rfDoc)
    } catch (err) {
      setRuleflowDocError(err.message)
    } finally {
      setRuleflowDocLoading(false)
    }
  }, [selectedConfig, ruleflowDocLoading])

  // ── Auto-clear status after 6 seconds ──────────────────────────────
  useEffect(() => {
    if (statusMessage) {
      const t = setTimeout(() => setStatusMessage(null), 6000)
      return () => clearTimeout(t)
    }
  }, [statusMessage])

  // ── Recursively reorder keys: primitives alphabetically first, then
  // complex (object/array) values alphabetically — matches JsonExplorer.
  const sortKeysDeep = (value) => {
    if (Array.isArray(value)) return value.map(sortKeysDeep)
    if (value !== null && typeof value === 'object') {
      const isComplex = (v) => v !== null && (typeof v === 'object' || Array.isArray(v))
      const primitives = Object.keys(value).filter(k => !isComplex(value[k])).sort()
      const complex    = Object.keys(value).filter(k =>  isComplex(value[k])).sort()
      return [...primitives, ...complex].reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key])
        return acc
      }, {})
    }
    return value
  }

  // ── JSON validation ─────────────────────────────────────────────────
  const validateInput = (value) => {
    if (!value || !value.trim()) {
      setInputError(null)
      return null
    }
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        setInputError('Payload must be a JSON array  —  e.g. [ { "ID": "...", ... } ]')
        return null
      }
      setInputError(null)
      return parsed
    } catch (e) {
      setInputError('Invalid JSON: ' + e.message)
      return null
    }
  }

  const handleInputChange = (e) => {
    let val = e.value
    // Auto-wrap + sort keys: if user pastes valid JSON, normalise it
    if (val && val.trim()) {
      try {
        let parsed = JSON.parse(val)
        if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed !== null) {
          parsed = [parsed]
        }
        if (Array.isArray(parsed)) {
          val = JSON.stringify(sortKeysDeep(parsed), null, 2)
        }
      } catch {
        // not valid JSON yet — let the user keep typing
      }
    }
    setInputJson(val)
    validateInput(val)
  }

  const clearInput = () => {
    setInputJson('')
    setInputError(null)
  }

  // ── Compile decision service (streams corticonJS.bat output via SSE) ──
  const startCompile = useCallback(() => {
    if (!selectedConfig?.uri) return
    if (!deployVersion || deployVersion < 1) {
      setStatusMessage({ type: 'error', text: 'Enter a valid bundle version number (≥ 1) before compiling.' })
      return
    }
    if (esRef.current) esRef.current.close()
    setCompileLog([])
    setCompileDone(null)
    setCompilePhase('compiling')
    setCompiling(true)

    const url = `${PROXY_BASE}/compile-decision-service?configUri=${encodeURIComponent(selectedConfig.uri)}&bundleVersion=${deployVersion}`
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.phase) {
          setCompilePhase(msg.phase)
        } else if (msg.done) {
          setCompiling(false)
          setCompileDone(msg.success ? 'success' : 'error')
          es.close()
          if (msg.success) {
            // loadConfigs() reloads the config doc which contains the updated deployedAt
            loadConfigs()
          }
        } else if (msg.line !== undefined) {
          setCompileLog(prev => [...prev, { line: msg.line, stream: msg.stream || 'info' }])
          if (msg.line.includes('Exporting ruleflow details to')) {
            console.log(`[DecisionServiceTestPage] ${msg.line}`)
          }
        }
      } catch {}
    }
    es.onerror = () => {
      setCompiling(false)
      setCompileDone('error')
      setCompileLog(prev => [...prev, { line: 'Connection to compilation server lost.', stream: 'error' }])
      es.close()
    }
  }, [selectedConfig, deployVersion, maxDeployedVersion, loadConfigs])

  // Auto-scroll compile log
  useEffect(() => {
    if (logBodyRef.current) logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight
  }, [compileLog])

  // Clean up EventSource on unmount
  useEffect(() => () => { if (esRef.current) esRef.current.close() }, [])

  // ── Save current JSON payload to history ──────────────────────────────────
  const saveToHistory = useCallback((jsonStr, cfg) => {
    if (!jsonStr || !jsonStr.trim()) return
    const ts = new Date().toISOString()
    const d  = new Date(ts)
    const pad = n => String(n).padStart(2, '0')
    const dateStr = `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    const bundleName = cfg?.bundleName || 'unknown'
    const dataLabel = deriveHistoryLabel(jsonStr, bundleName)
    const entry = { label: `${dataLabel} — ${dateStr}`, json: jsonStr, bundleName, timestamp: ts }
    setHistory(prev => {
      const deduped = prev.filter(e => e.json !== jsonStr)
      const next = [entry, ...deduped].slice(0, 50)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // ── Recall a history entry ────────────────────────────────────────────────
  const recallHistory = useCallback((item) => {
    if (!item?.json) return
    setSelectedHistory(item)
    setInputJson(item.json)
    validateInput(item.json)
    setResult(null)
    setResultError(null)
    setStatusMessage({ type: 'success', text: `Recalled: "${item.label}"` })
  }, [])

  const historyItems = useMemo(() => [
    { label: '— Recall a previous request —', json: null, timestamp: '__placeholder' },
    ...history
  ], [history])

  // ── Execute decision service ────────────────────────────────────────
  const executeTest = useCallback(async () => {
    if (!selectedConfig) {
      setStatusMessage({ type: 'error', text: 'Select a Decision Service configuration first.' })
      return
    }
    if (!selectedConfig.bundleUri) {
      setStatusMessage({ type: 'error', text: 'The selected configuration has no Bundle URI — ensure Project Name and Bundle Name are set.' })
      return
    }

    const payload = validateInput(inputJson)
    if (!payload) return

    setExecuting(true)
    setResult(null)
    setResultError(null)
    setStatusMessage(null)
    setProcessingTime(null)

    const t0 = Date.now()

    try {
      const res = await fetch(`${PROXY_BASE}/test-decision-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_HEADER
        },
        body: JSON.stringify({
          bundleUri: selectedConfig.bundleUri,
          payload,
          debugEngine,
          ruleTracing
        })
      })

      // Safely parse response — guard against HTML error pages (e.g. server not restarted)
      const rawText = await res.text()
      // Capture client-side response time immediately — used as log anchor fallback
      // when the Corticon engine returns an error and corticon.timestamp is absent.
      const responseReceivedAt = new Date().toISOString()
      setProcessingTime(Date.now() - t0)
      let data
      try {
        data = JSON.parse(rawText)
      } catch {
        const hint = rawText.includes('<!DOCTYPE') || rawText.includes('<html')
          ? 'The middle-tier server returned an HTML page instead of JSON. ' +
            'Make sure the Express server has been restarted after the latest code change.'
          : 'Unexpected non-JSON response from server.'
        setResultError({ message: hint, detail: rawText.substring(0, 500) })
        setStatusMessage({ type: 'error', text: 'Server response could not be parsed — see error output' })
        setLastExecution(responseReceivedAt)
        return
      }

      if (!res.ok || data.error) {
        const msg = data.error || `Execution failed (HTTP ${res.status})`
        const detail = data.detail || ''
        setResultError({ message: msg, detail })
        setStatusMessage({ type: 'error', text: 'Execution failed — see error output below' })
        setLastExecution(responseReceivedAt)
        return
      }

      setResult(data.result)
      // Extract execution timestamp from Corticon metadata; fall back to client time
      const corticonMeta = data.result?.corticon || {}
      const ts = corticonMeta.timestamp
        || corticonMeta.executionTimestamp
        || corticonMeta['__timestamp']
        || responseReceivedAt
      setLastExecution(ts)
      setLogRows([])
      setLogWindowInfo(null)
      setLogError(null)
      setStatusMessage({ type: 'success', text: 'Decision service executed successfully.' })
      saveToHistory(inputJson, selectedConfig)
    } catch (err) {
      setResultError({ message: err.message, detail: '' })
      setStatusMessage({ type: 'error', text: 'Request failed: ' + err.message })
      saveToHistory(inputJson, selectedConfig)
    } finally {
      setExecuting(false)
    }
  }, [selectedConfig, inputJson, debugEngine, ruleTracing, saveToHistory])

  const clearAll = () => {
    setInputJson('')
    setInputError(null)
    if (selectedUri) sessionStorage.removeItem(STORAGE_PREFIX + selectedUri)
    setResult(null)
    setResultError(null)
    setStatusMessage(null)
    setProcessingTime(null)
    setLastExecution(null)
    setLogRows([])
    setLogSort([])
    setLogFilter(null)
    setLogDialogOpen(false)
    setLogWindowInfo(null)
    setLogError(null)
    setMsgSort([])
    setMsgFilter(null)
    setTraceSort([{ field: 'sequence', dir: 'asc' }])
    setTraceFilter(null)
    setMsgExpanded({})
    setTraceExpanded({})
  }

  // ── Fetch MarkLogic log lines for the current execution timestamp ────────
  const fetchAndShowLogs = useCallback(async () => {
    // Use corticon.timestamp (ML server clock) as the end time of execution.
    // processingTime (client round-trip ms) is an upper bound on server execution duration.
    const around = lastExecution || new Date().toISOString()
    setLogLoading(true)
    setLogRows([])
    setLogWindowInfo(null)
    setLogError(null)
    setLogSort([])
    setLogFilter(null)
    setLogDialogOpen(true)
    try {
      const url = `${PROXY_BASE}/ml-logs?around=${encodeURIComponent(around)}` +
        (processingTime ? `&durationMs=${processingTime}` : '')
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok || data.error) {
        setLogError(data.error || `Request failed (HTTP ${res.status})`)
      } else {
        setLogRows(parseLogEntries(data.lines || []))
        setLogWindowInfo({ start: data.start, end: data.end, logFilename: data.logFilename })
      }
    } catch (err) {
      setLogError(err.message)
    } finally {
      setLogLoading(false)
    }
  }, [lastExecution, processingTime])

  // ── Parsed input (for Explorer tab) ────────────────────────────────
  const parsedInput = useMemo(() => {
    try { return JSON.parse(inputJson) } catch { return null }
  }, [inputJson])

  // ── Format JSON for display ─────────────────────────────────────────
  const formatJson = (obj) => JSON.stringify(obj, null, 2)

  // ── Trim leading/trailing whitespace from all string filter values ──
  // Prevents invisible trailing spaces (e.g. from copy-paste) causing
  // contains-filter to return zero rows even when the value is present.
  const trimFilter = (f) => {
    if (!f) return f
    if (Array.isArray(f.filters)) return { ...f, filters: f.filters.map(trimFilter) }
    return typeof f.value === 'string' ? { ...f, value: f.value.trim() } : f
  }

  // ── Shorten rulesheetName to last 3 path segments ──────────────────
  // "file:/C:/.../Product Config DB/Rulesheets/Define ML data query.ers"
  // → "Product Config DB/Rulesheets/Define ML data query.ers"
  function shortenRulesheet(name) {
    if (!name) return ''
    const parts = name.replace(/^file:\/+/i, '').replace(/\\/g, '/').split('/')
    return parts.length >= 3 ? parts.slice(-3).join('/') : name
  }

  // ── Derived rule messages and trace rows ────────────────────────────
  // Messages and Metrics live inside result.corticon (the Corticon metadata block)
  // _id added to each message row so KendoReact Grid can use it as dataItemKey for expand.
  const msgs = useMemo(() => {
    const src = result?.corticon ?? result
    return (src?.messages?.message || []).map((m, i) => ({ ...m, _id: i }))
  }, [result])

  const traceRows = useMemo(() => {
    const src = result?.corticon ?? result
    const metrics = src?.Metrics
    if (!metrics) return []
    const formatAfter = (v) => {
      if (v === true)  return 'T'
      if (v === false) return 'F'
      if (v === null || v === undefined) return ''
      if (typeof v === 'object') return JSON.stringify(v)
      return String(v)
    }
    const attrChanges = (metrics.attributeChanges || []).map(r => ({
      ...r,
      type: 'Attribute',
      propertyName: r.attributeName,
      beforeValue: formatAfter(r.beforeValue),
      afterValue: formatAfter(r.afterValue),
      rulesheetShort: shortenRulesheet(r.rulesheetName)
    }))
    const assocChanges = (metrics.associationChanges || []).map(r => ({
      ...r,
      type: 'Association',
      entityName: r.sourceEntityName,
      propertyName: r.associationRoleName,
      rulesheetShort: shortenRulesheet(r.rulesheetName)
    }))
    const entChanges = (metrics.entityChanges || []).map(r => ({
      ...r,
      type: 'Entity',
      propertyName: '',
      rulesheetShort: shortenRulesheet(r.rulesheetName)
    }))
    return [...attrChanges, ...assocChanges, ...entChanges]
  }, [result])

  // ── Parse raw ML log entry strings into structured grid rows ────────
  // Each entry from server: "2026-03-06T14:59:17.090+01:00 info: <message>"
  // message is either a JSON object or a plain string (possibly starting with [Tag])
  function parseLogEntries(lines) {
    return lines.map((line, idx) => {
      // line format: "TIMESTAMP LEVEL: MESSAGE"
      const m = line.match(/^(\S+)\s+(\w+):\s?(.*)$/s)
      const timestamp = m ? m[1] : ''
      const level     = m ? m[2] : ''
      const rawMsg    = m ? m[3] : line

      // Time display: extract HH:MM:SS.mmm from ISO timestamp
      let time = timestamp
      const tMatch = timestamp.match(/T(\d{2}:\d{2}:\d{2}\.\d+)/)
      if (tMatch) time = tMatch[1]

      let source = '', traceId = '', message = rawMsg, data = ''

      // Try to parse message as JSON (ADC structured log)
      try {
        const parsed = JSON.parse(rawMsg)
        source  = parsed.prefix  || ''
        traceId = parsed.traceId || ''
        message = parsed.message || rawMsg
        data    = parsed.data ? JSON.stringify(parsed.data) : ''
      } catch {
        // Plain text — extract [Tag] prefix
        const tagMatch = rawMsg.match(/^\[([^\]]+)\]\s*(.*)/s)
        if (tagMatch) {
          const tag = tagMatch[1]
          // Distinguish trace IDs (adc-...) from source tags ([DSTest], [MarkLogic...])
          if (/^adc-/.test(tag)) {
            traceId = tag
          } else {
            source = tag
          }
          message = tagMatch[2]
        }
      }

      return { id: idx, time, level, source, traceId, message, data }
    })
  }

  // ── Custom cell for log level badge ───────────────────────────────
  const LogLevelCell = ({ field, dataItem, tdProps }) => {
    const val = dataItem[field]
    const cls = 'dst-log-level-badge dst-log-level-' + (val || '').toLowerCase()
    return <td {...tdProps}><span className={cls}>{val}</span></td>
  }

  // ── Custom cell to wrap long message text ─────────────────────────
  const LogMsgCell = ({ field, dataItem, tdProps }) => (
    <td {...tdProps} title={dataItem[field]} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {dataItem[field]}
    </td>
  )

  // ── Custom cell for data column (monospace, truncated, full in tooltip) ──
  const LogDataCell = ({ field, dataItem, tdProps }) => (
    <td {...tdProps} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', verticalAlign: 'top' }}>
      {dataItem[field]}
    </td>
  )

  // ── Custom cell renderer for type badge in Rule Trace grid ────────
  const TraceTypeCell = (props) => {
    const { field, dataItem } = props;
    if (field === 'type') {
      const type = dataItem[field];
      let badgeClass = 'dst-type-badge';
      if (type === 'Attribute') badgeClass += ' dst-type-attribute';
      else if (type === 'Entity') badgeClass += ' dst-type-entity';
      else if (type === 'Association') badgeClass += ' dst-type-association';
      return (
        <td {...props.tdProps} style={{ ...props.tdProps?.style, textOverflow: 'clip', overflow: 'hidden' }}>
          <span className={badgeClass}>{type}</span>
        </td>
      );
    }
    const raw = dataItem[field]
    const display = raw === null || raw === undefined ? '' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
    return (
      <td {...props.tdProps}>
        {display}
      </td>
    );
  };

  // ── Custom cell renderer for severity badge in Rule Messages grid ─
  const MsgSeverityCell = (props) => {
    const { field, dataItem } = props;
    if (field === 'severity') {
      const severity = dataItem[field];
      let badgeClass = 'dst-severity-badge';
      if (severity === 'Info') badgeClass += ' dst-severity-info';
      else if (severity === 'Warning') badgeClass += ' dst-severity-warning';
      else if (severity === 'Violation') badgeClass += ' dst-severity-violation';
      return (
        <td {...props.tdProps} style={{ ...props.tdProps?.style, textOverflow: 'clip', overflow: 'hidden' }}>
          <span className={badgeClass}>{severity}</span>
        </td>
      );
    }
    return (
      <td {...props.tdProps}>
        {dataItem[field]}
      </td>
    );
  };

  // ── Left panel: config tree ─────────────────────────────────────────
  const renderConfigList = () => (
    <div className="dst-list-panel">
      <div className="dst-list-toolbar">
        <h3>Configurations</h3>
        <Button
          fillMode="flat"
          size="small"
          onClick={loadConfigs}
          title="Refresh"
          disabled={loadingConfigs}
        >
          ↻
        </Button>
      </div>

      {loadingConfigs && configs.length === 0 && (
        <div className="dst-list-loading">Loading...</div>
      )}

      {treeData.length > 0 ? (
        <div className="dst-list-items">
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
                  <span className={`dst-tree-project${isSelected ? ' selected' : ''}`}>
                    <span className="dst-tree-project-icon">&#128193;</span>
                    <span className="dst-tree-project-text">{item.text}</span>
                    <span className="dst-tree-project-count">{item.items?.length || 0}</span>
                  </span>
                )
              }
              return (
                <span className={`dst-tree-item ${item.uri === selectedUri ? 'selected' : ''}`}>
                  <span className="dst-tree-item-icon">&#9102;</span>
                  <span>{item.text}</span>
                </span>
              )
            }}
          />
        </div>
      ) : (
        !loadingConfigs && (
          <div className="dst-empty-list">
            No Decision Service configurations found.
            Create configurations in <em>Decision Service Configuration</em>.
          </div>
        )
      )}
    </div>
  )

  // ── Right panel: test area ──────────────────────────────────────────
  const renderTestPanel = () => (
    <div className="dst-test-panel">

      {/* ── Top-level 3-tab strip ─────────────────────────────────────── */}
      <TabStrip
        selected={mainTab}
        onSelect={(e) => setMainTab(e.selected)}
        className="dst-main-tabs"
        animation={false}
        tabContentStyle={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
      >

        {/* ══ TAB 1: Test ══════════════════════════════════════════════ */}
        <TabStripTab title="Test">
          <div className="dst-tab-content">

            {/* Bundle info bar — Bundle URI, Date deployed, timing, logs */}
            <div className="dst-bundle-bar">
              {selectedConfig ? (
                <>
                  <div className="dst-bundle-info dst-bundle-info-uri">
                    <span className="dst-bundle-label">Bundle URI</span>
                    <span className="dst-bundle-uri" title={selectedConfig.bundleUri}>
                      {selectedConfig.bundleUri || <em className="dst-bundle-missing">Not configured</em>}
                    </span>
                  </div>
                  <div className="dst-bundle-separator" />
                  <div className="dst-bundle-info">
                    <span className="dst-bundle-label">Date/Time Deployed</span>
                    <span className="dst-bundle-value dst-bundle-ts">
                      {bundleDeployedAt
                        ? (() => {
                            const normalised = bundleDeployedAt.replace(/(\.\d{3})\d+/, '$1')
                            const d = new Date(normalised)
                            if (isNaN(d)) return bundleDeployedAt
                            const p2 = n => String(n).padStart(2, '0')
                            return `${d.getFullYear()}/${p2(d.getMonth()+1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
                          })()
                        : <em className="dst-bundle-missing">—</em>}
                    </span>
                  </div>
                  <div className="dst-bundle-separator" />
                  <div className="dst-bundle-info">
                    <span className="dst-bundle-label">Processing time</span>
                    <span className="dst-bundle-value dst-bundle-perf">
                      {processingTime !== null ? `${processingTime} ms` : '—'}
                    </span>
                  </div>
                  <div className="dst-bundle-separator" />
                  <div className="dst-bundle-info">
                    <span className="dst-bundle-label">Last execution</span>
                    <span className="dst-bundle-value dst-bundle-ts">
                      {(() => {
                        const d = lastExecution ? new Date(lastExecution) : (processingTime !== null ? new Date() : null)
                        if (!d) return '—'
                        const p = n => String(n).padStart(2, '0')
                        return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
                      })()}
                    </span>
                  </div>
                  {processingTime !== null && (
                    <>
                      <div className="dst-bundle-separator" />
                      <div className="dst-bundle-info dst-bundle-info-logbtn">
                        <span className="dst-bundle-label">&nbsp;</span>
                        <Button
                          size="small"
                          fillMode="outline"
                          themeColor="info"
                          onClick={fetchAndShowLogs}
                          disabled={logLoading}
                          title="Fetch MarkLogic ErrorLog lines for this execution (±5 seconds around execution time)"
                        >
                          {logLoading ? '⟳ Loading…' : '📋 View ML Logs'}
                        </Button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <span className="dst-bundle-placeholder">
                  Select a Decision Service configuration from the left panel to begin testing.
                </span>
              )}
            </div>

            {/* Action toolbar */}
            <div className="dst-toolbar">
              {selectedConfig && (
                <div className="dst-version-picker" title="Bundle version to deploy as">
                  <span className="dst-version-label">
                    {maxDeployedVersion > 0 ? `Latest: v${maxDeployedVersion} →` : 'First deploy →'}
                  </span>
                  <NumericTextBox
                    value={deployVersion}
                    onChange={e => setDeployVersion(e.value)}
                    min={1}
                    step={1}
                    format="n0"
                    style={{ width: 64 }}
                    disabled={compiling}
                    spinners={true}
                  />
                </div>
              )}
              <Button
                fillMode="solid"
                themeColor="primary"
                onClick={startCompile}
                disabled={compiling || executing || !selectedConfig}
                title="Compile the ruleflow and copy the bundle to ml-modules"
              >
                {compiling ? (compilePhase === 'deploying' ? '⟳ Deploying to MarkLogic…' : '⟳ Compiling…') : '⚙ Compile & Deploy'}
              </Button>
              <Button
                themeColor="primary"
                onClick={executeTest}
                disabled={executing || !!inputError || !selectedConfig || !bundleExists}
                title={
                  !selectedConfig
                    ? 'Select a Decision Service configuration from the left panel first'
                    : !bundleExists
                      ? 'Bundle has not been deployed to MarkLogic yet — compile and deploy first'
                      : inputError
                        ? 'Fix the JSON validation error before executing'
                        : undefined
                }
              >
                {executing ? 'Executing…' : '▶ Execute Decision Service'}
              </Button>
              <label className="dst-debug-toggle" title="When checked, Corticon engine debug messages (logLevel 1) are written to the MarkLogic log">
                <input
                  type="checkbox"
                  checked={debugEngine}
                  onChange={(e) => setDebugEngine(e.target.checked)}
                  disabled={executing || compiling}
                />
                Debug Corticon engine
              </label>
              <label className="dst-debug-toggle" title="When checked, the decision service runs with rule tracing enabled (executionMetrics), capturing attribute, association and entity changes visible in the Rule Trace tab">
                <input
                  type="checkbox"
                  checked={ruleTracing}
                  onChange={(e) => setRuleTracing(e.target.checked)}
                  disabled={executing || compiling}
                />
                Rule tracing
              </label>
              <Button
                fillMode="outline"
                onClick={clearAll}
                disabled={executing || compiling}
              >
                Reset
              </Button>
            </div>

            {/* Status bar */}
            {statusMessage && (
              <div className={`dst-status-bar ${statusMessage.type}`}>
                {statusMessage.text}
              </div>
            )}

            {/* Inline hint when JSON is ready but no config is selected */}
            {!selectedConfig && inputJson.trim() && !statusMessage && (
              <div className="dst-status-bar info">
                ℹ Select a Decision Service configuration from the left panel to enable execution.
              </div>
            )}

            {/* History recall bar */}
            <div className="dst-history-bar">
              <label className="dst-history-label">&#128338; Recall previous request</label>
              <DropDownList
                data={historyItems}
                textField="label"
                dataItemKey="timestamp"
                value={selectedHistory}
                onChange={e => recallHistory(e.value?.json ? e.value : null)}
                style={{ flex: 1 }}
                popupSettings={{ popupClass: 'pc-dropdown-popup' }}
                disabled={history.length === 0 || executing}
              />
            </div>

            {/* Request / Output side by side — full remaining height */}
            <div className="dst-content">

              {/* Input column */}
              <div className="dst-column">
                <div className="dst-column-header">
                  <span className="dst-column-title">Decision Service Request</span>
                  <span className="dst-column-hint">JSON array — mirrors the document structure that triggers the decision service</span>
                </div>

                <TabStrip
                  selected={inputTab}
                  onSelect={(e) => setInputTab(e.selected)}
                  className="dst-pane-tabs"
                  animation={false}
                  tabContentStyle={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
                >
                  <TabStripTab title="Raw JSON">
                    <div className="dst-editor-wrap">
                      <TextArea
                        className="dst-json-editor"
                        value={inputJson}
                        onChange={handleInputChange}
                        placeholder='Paste your JSON request here.&#10;&#10;Example:&#10;[&#10;  {&#10;    "ID": "001",&#10;    "className": "MyEntity"&#10;  }&#10;]&#10;&#10;If pasted JSON is an object (not an array), brackets will be added automatically.'
                        style={{ width: '100%', flex: 1, minHeight: 0, fontFamily: 'monospace', fontSize: '12px' }}
                        disabled={executing}
                      />
                      {inputJson && (
                        <Button
                          className="dst-clear-btn"
                          fillMode="flat"
                          size="small"
                          onClick={clearInput}
                          title="Clear request JSON"
                          disabled={executing}
                        >
                          ✕ Clear
                        </Button>
                      )}
                      {inputError && (
                        <div className="dst-validation-error">{inputError}</div>
                      )}
                    </div>
                  </TabStripTab>
                  <TabStripTab title="Explorer">
                    <JsonExplorer
                      data={parsedInput}
                      emptyMessage={inputError ? 'Invalid JSON — fix in the Raw JSON tab first.' : 'No data to display.'}
                    />
                  </TabStripTab>
                </TabStrip>
              </div>

              {/* Output column */}
              <div className="dst-column">
                <div className="dst-column-header">
                  <span className="dst-column-title">Decision Output</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {result && outputTab === 0 && (
                      <label className="dst-toggle">
                        <input
                          type="checkbox"
                          checked={showCorticon}
                          onChange={(e) => setShowCorticon(e.target.checked)}
                        />
                        Show Corticon metadata
                      </label>
                    )}
                    {result && (
                      <button
                        className="dst-copy-btn"
                        title="Copy response as JSON"
                        onClick={() => {
                          const text = JSON.stringify(
                            showCorticon ? result : (result?.payload ?? result),
                            null, 2
                          )
                          navigator.clipboard.writeText(text).then(() => {
                            setCopiedResult(true)
                            setTimeout(() => setCopiedResult(false), 2000)
                          })
                        }}
                      >
                        {copiedResult ? '✓ Copied' : '⧉ Copy JSON'}
                      </button>
                    )}
                  </div>
                </div>

                <TabStrip
                  selected={outputTab}
                  onSelect={(e) => setOutputTab(e.selected)}
                  className="dst-pane-tabs"
                  animation={false}
                  tabContentStyle={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
                >
                  <TabStripTab title="Raw JSON">
                    <div className="dst-output-wrap">
                      {executing && (
                        <div className="dst-executing-overlay">
                          <div className="dst-spinner" />
                          <span>Invoking decision service on MarkLogic…</span>
                        </div>
                      )}
                      {!executing && !result && !resultError && (
                        <div className="dst-output-empty">
                          Execute the decision service to see the response here.
                        </div>
                      )}
                      {!executing && resultError && (
                        <div className="dst-error-block">
                          <div className="dst-error-title">Execution Error</div>
                          <div className="dst-error-message">{resultError.message}</div>
                          {resultError.detail && (
                            <pre className="dst-error-detail">{resultError.detail}</pre>
                          )}
                        </div>
                      )}
                      {!executing && result && !resultError && (
                        <div className="dst-result-sections">
                          <div className="dst-result-section">
                            <div className="dst-result-section-header">
                              <span className="dst-result-section-title">
                                {showCorticon ? 'Full Response (Payload + Corticon Metadata)' : 'Payload (Decision Result)'}
                              </span>
                              <span className="dst-result-section-count">
                                {!showCorticon && Array.isArray(result?.payload) ? `${result.payload.length} item(s)` : ''}
                              </span>
                            </div>
                            <pre className="dst-json-output">
                              {showCorticon ? formatJson(result) : formatJson(result?.payload ?? result)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabStripTab>
                  <TabStripTab title="Explorer">
                    <JsonExplorer
                      data={result?.payload ?? result}
                      emptyMessage="Execute the decision service to explore the response here."
                    />
                  </TabStripTab>
                </TabStrip>
              </div>
            </div>

            {/* Compilation log panel */}
            {(compiling || compileDone) && (
              <div className={`dst-compile-log ${compileDone === 'success' ? 'dst-compile-log--success' : compileDone === 'error' ? 'dst-compile-log--error' : ''}`}>
                <div className="dst-compile-log-header">
                  <span className="dst-compile-log-title">
                    {compiling
                      ? (compilePhase === 'deploying' ? '⟳ Deploying to MarkLogic…' : '⟳ Compiling…')
                      : compileDone === 'success'
                        ? '✓ Rules compilation complete — Rules bundle copied to MarkLogic ml-modules database!'
                        : '✗ Compilation failed'}
                  </span>
                  {!compiling && (
                    <button className="dst-compile-log-close" onClick={() => { setCompileDone(null); setCompileLog([]) }}>✕ Close</button>
                  )}
                </div>
                {compileDone === 'error' && compileLog.some(e => e.line && e.line.includes('0 KB')) && (
                  <div className="dst-compile-log-advice">
                    <strong>⚠ Empty bundle detected.</strong> The Corticon JS compilation utility does not produce a log file.
                    To diagnose the problem, open the Ruleflow (.erf) in <em>Corticon Studio</em>, compile it manually
                    via <strong>Package &gt; Decision Service &gt; JavaScript</strong>, and check the Studio log file
                    (<strong>Help &gt; Corticon Log File</strong>) for errors.
                  </div>
                )}
                <div className="dst-compile-log-body" ref={logBodyRef}>
                  {compileLog.map((entry, i) => (
                    <div key={i} className={`dst-log-line dst-log-${entry.stream}`}>{entry.line}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabStripTab>

        {/* ══ TAB 2: Rule Messages ═════════════════════════════════════ */}
        <TabStripTab title={`Rule Messages${msgs.length > 0 ? ` (${msgs.length})` : ''}`}>
          <div className="dst-tab-content">
            {msgs.length > 0 ? (
              <div className="dst-grid-wrap">
                <Grid
                  data={orderBy(filterBy(msgs, msgFilter), msgSort)}
                  sortable
                  filterable
                  scrollable="scrollable"
                  sort={msgSort}
                  onSortChange={(e) => setMsgSort(e.sort)}
                  filter={msgFilter}
                  onFilterChange={(e) => setMsgFilter(trimFilter(e.filter))}
                  className="dst-analysis-grid"
                  style={{ height: '100%' }}
                  cells={{ data: MsgSeverityCell }}
                  dataItemKey="_id"
                  detail={(props) => (
                    <RuleDetailPanel
                      dataItem={props.dataItem}
                      ruleflowDoc={ruleflowDoc}
                      loading={ruleflowDocLoading}
                      error={ruleflowDocError}
                      rsNameField="ruleSheet"
                      ruleNumField="rule"
                      showRuleStatements={false}
                      result={result}
                      allMsgs={msgs}
                    />
                  )}
                  detailExpand={msgExpanded}
                  onDetailExpandChange={(e) => { loadRuleflowDocIfNeeded(); setMsgExpanded(e.detailExpand) }}
                >
                  <GridColumn field="severity"  title="Severity"    width={100} filter="text" />
                  <GridColumn field="text"      title="Message"               filter="text" />
                  <GridColumn field="ruleSheet" title="Rule Sheet"  width={220} filter="text" />
                  <GridColumn field="rule"      title="Rule"        width={70}  filter="text" />
                </Grid>
              </div>
            ) : (
              <div className="dst-analysis-empty">
                Execute the decision service to see rule messages here.
              </div>
            )}
          </div>
        </TabStripTab>

        {/* ══ TAB 3: Rule Trace ════════════════════════════════════════ */}
        <TabStripTab title={`Rule Trace${traceRows.length > 0 ? ` (${traceRows.length})` : ''}`}>
          <div className="dst-tab-content">
            {traceRows.length > 0 ? (
              <div className="dst-grid-wrap">
                <Grid
                  data={orderBy(filterBy(traceRows, traceFilter), traceSort)}
                  sortable
                  filterable
                  scrollable="scrollable"
                  sort={traceSort}
                  onSortChange={(e) => setTraceSort(e.sort)}
                  filter={traceFilter}
                  onFilterChange={(e) => setTraceFilter(trimFilter(e.filter))}
                  className="dst-analysis-grid"
                  style={{ height: '100%' }}
                  cells={{ data: TraceTypeCell }}
                  dataItemKey="sequence"
                  detail={(props) => (
                    <RuleDetailPanel
                      dataItem={props.dataItem}
                      ruleflowDoc={ruleflowDoc}
                      loading={ruleflowDocLoading}
                      error={ruleflowDocError}
                      rsNameField="rulesheetName"
                      ruleNumField="ruleNumber"
                      showRuleStatements={true}
                      result={result}
                    />
                  )}
                  detailExpand={traceExpanded}
                  onDetailExpandChange={(e) => { loadRuleflowDocIfNeeded(); setTraceExpanded(e.detailExpand) }}
                >
                  <GridColumn field="type"           title="Type"        width={120} filter="text" />
                  <GridColumn field="sequence"       title="Seq"         width={60}  filter="numeric" />
                  <GridColumn field="rulesheetShort" title="Rule Sheet"             filter="text" />
                  <GridColumn field="ruleNumber"     title="Rule"        width={65}  filter="text" />
                  <GridColumn field="entityName"     title="Entity"      width={140} filter="text" />
                  <GridColumn field="propertyName"   title="Attribute / Association" width={180} filter="text" />
                  <GridColumn field="beforeValue"    title="Before"      width={120} filter="text" />
                  <GridColumn field="afterValue"     title="After"       width={120} filter="text" />
                  <GridColumn field="action"         title="Action"      width={80}  filter="text" />
                </Grid>
              </div>
            ) : (
              <div className="dst-analysis-empty">
                Execute the decision service to see the rule trace here.
              </div>
            )}
          </div>
        </TabStripTab>

      </TabStrip>

      {/* ── MarkLogic Log Lines dialog ─────────────────────────────────── */}
      {logDialogOpen && (
        <Dialog
          title={logWindowInfo
            ? `${logWindowInfo.logFilename} — ${logWindowInfo.start} → ${logWindowInfo.end}`
            : 'MarkLogic ErrorLog — fetching…'}
          onClose={() => setLogDialogOpen(false)}
          className="dst-log-dialog-root"
          width={1200}
          height={620}
          contentStyle={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
        >
          <div className="dst-log-dialog-content">
            {logLoading && (
              <div className="dst-log-dialog-status">⟳ Fetching log lines from MarkLogic…</div>
            )}
            {!logLoading && logError && (
              <div className="dst-log-dialog-error">
                <strong>Error:</strong> {logError}
              </div>
            )}
            {!logLoading && !logError && logRows.length === 0 && (
              <div className="dst-log-dialog-status">
                No log lines found in{logWindowInfo ? ` ${logWindowInfo.logFilename}` : ' the app server log'} for the execution time window.<br /><br />
                Check that the MarkLogic Management API (port <code>ML_MANAGE_PORT</code>, default 8002) is
                accessible and the user has the <code>manage-user</code> role.
              </div>
            )}
            {!logLoading && logRows.length > 0 && (
              <div className="dst-log-grid-wrap">
                <Grid
                  data={orderBy(filterBy(logRows, logFilter), logSort)}
                  sortable
                  filterable
                  scrollable="scrollable"
                  sort={logSort}
                  onSortChange={(e) => setLogSort(e.sort)}
                  filter={logFilter}
                  onFilterChange={(e) => setLogFilter(trimFilter(e.filter))}
                  className="dst-log-grid"
                  style={{ height: '100%' }}
                  cells={{ data: (props) => {
                    if (props.field === 'level')   return <LogLevelCell {...props} />
                    if (props.field === 'message') return <LogMsgCell   {...props} />
                    if (props.field === 'data')    return <LogDataCell  {...props} />
                    return <td {...props.tdProps}>{props.dataItem[props.field]}</td>
                  }}}
                >
                  <GridColumn field="time"    title="Time"      width={120}  filter="text" />
                  <GridColumn field="level"   title="Level"     width={80}   filter="text" />
                  <GridColumn field="source"  title="Source"    width={160}  filter="text" />
                  <GridColumn field="traceId" title="Trace ID"  width={210}  filter="text" />
                  <GridColumn field="message" title="Message"               filter="text" />
                  <GridColumn field="data"    title="Data"                   filter="text" />
                </Grid>
              </div>
            )}
          </div>
          <DialogActionsBar layout="end">
            <span className="dst-log-dialog-count">{logRows.length} entr{logRows.length === 1 ? 'y' : 'ies'}</span>
            {logRows.length > 0 && (
              <Button
                onClick={() => {
                  const displayed = orderBy(filterBy(logRows, logFilter), logSort)
                  const header = `${logWindowInfo ? logWindowInfo.logFilename + ' — ' + logWindowInfo.start + ' → ' + logWindowInfo.end : 'MarkLogic ErrorLog'}\n${'─'.repeat(80)}\n`
                  const body = displayed.map(r =>
                    `[${r.time}] [${r.level}] ${r.source ? r.source + ' ' : ''}${r.traceId ? '(' + r.traceId + ') ' : ''}${r.message || ''}${r.data ? '\n  DATA: ' + (typeof r.data === 'object' ? JSON.stringify(r.data) : r.data) : ''}`
                  ).join('\n')
                  navigator.clipboard.writeText(header + body).then(() => {
                    setCopiedLog(true)
                    setTimeout(() => setCopiedLog(false), 2500)
                  })
                }}
              >
                {copiedLog ? '✓ Copied' : '⧉ Copy Log'}
              </Button>
            )}
            <Button onClick={() => setLogDialogOpen(false)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </div>
  )

  return (
    <div className="dst-page">
      <Splitter
        panes={splitterPanes}
        onChange={(e) => setSplitterPanes(e.newState)}
        style={{ height: '100%' }}
      >
        {renderConfigList()}
        {renderTestPanel()}
      </Splitter>
    </div>
  )
}
