import { useState, useEffect, useCallback } from 'react'
import { Splitter } from '@progress/kendo-react-layout'
import { TabStrip, TabStripTab } from '@progress/kendo-react-layout'
import { TreeView } from '@progress/kendo-react-treeview'
import { Button } from '@progress/kendo-react-buttons'
import { Input, NumericTextBox } from '@progress/kendo-react-inputs'
import { DropDownList } from '@progress/kendo-react-dropdowns'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import './DeploymentConfigPage.css'

const PROXY_BASE = import.meta.env.VITE_ML_SCHEME + '://' +
  import.meta.env.VITE_ML_HOST + ':' + import.meta.env.VITE_ML_PORT +
  (import.meta.env.VITE_ML_BASE_PATH || '')

const AUTH_HEADER = 'Basic ' + btoa(
  import.meta.env.VITE_ML_USERNAME + ':' + import.meta.env.VITE_ML_PASSWORD
)

const COLLECTION = 'DeploymentConfigs'

// Reuse the mlFetch helper pattern from QueryMaintenancePage
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

// Default document structure for a new deployment config
function createDefaultConfig(projectName, bundleName) {
  return {
    projectName,
    bundleName,
    compilation: {
      javaHome: import.meta.env.VITE_DEFAULT_JAVA_HOME || '',
      platform: 'MarkLogic',
      dependentJS: [
        ''
      ],
      inputErf: '',
      outputDir: '',
      corticonHome: ''
    },
    deployment: {
      bundleUriBase: '/ext',
      mlAppName: 'corticonml',
      mlHost: import.meta.env.VITE_ML_HOST || '',
      mlRestPort: parseInt(import.meta.env.VITE_ML_REST_PORT) || null,
      mlRestAuthentication: 'digest',
      mlUsername: import.meta.env.VITE_ML_USERNAME || '',
      mlPassword: '',
      modulesDatabase: '',

      gradleProjectDir: '',
      additionalGradleArgs: ''
    }
  }
}

const AUTH_OPTIONS = ['digest', 'basic', 'certificate']

// ── One-time migration: collapses all old-format docs to single-doc-per-bundle ──
// Handles three legacy patterns:
//   /deployment/{proj}/{bundle}.json           (old template location)
//   /DeploymentConfigs/{proj}/{N}/{bundle}.json (versioned new)
//   /DeploymentConfigs/{proj}/{bundle}/v{N}.json (versioned even older)
// Target format: /DeploymentConfigs/{proj}/{bundle}.json with deployedVersions array.
// Returns true if any doc was migrated (caller should re-fetch).
async function migrateLegacyConfigDocs(list) {
  const targetMap = {}   // `${proj}/${bundle}` → existing target URI
  const toMigrate = []   // docs that need consolidation

  for (const c of list) {
    const segs = c.uri.split('/').filter(Boolean)
    if (segs[0] === 'deployment' && segs.length === 3) {
      toMigrate.push({ uri: c.uri, proj: segs[1], bundle: segs[2].replace('.json', ''), type: 'template' })
    } else if (segs[0] === 'DeploymentConfigs' && segs.length === 4) {
      if (/^\d+$/.test(segs[2])) {
        // /DeploymentConfigs/{proj}/{N}/{bundle}.json
        toMigrate.push({ uri: c.uri, proj: segs[1], bundle: segs[3].replace('.json', ''), type: 'versioned', version: parseInt(segs[2], 10) })
      } else if (/^v\d+\.json$/.test(segs[3])) {
        // /DeploymentConfigs/{proj}/{bundle}/v{N}.json
        toMigrate.push({ uri: c.uri, proj: segs[1], bundle: segs[2], type: 'versioned', version: parseInt(segs[3].slice(1).replace('.json', ''), 10) })
      }
    } else if (segs[0] === 'DeploymentConfigs' && segs.length === 3) {
      targetMap[`${segs[1]}/${segs[2].replace('.json', '')}`] = c.uri
    }
  }

  if (toMigrate.length === 0) return false

  const groups = {}
  for (const m of toMigrate) {
    const key = `${m.proj}/${m.bundle}`
    if (!groups[key]) groups[key] = { proj: m.proj, bundle: m.bundle, templates: [], versioned: [] }
    if (m.type === 'template') groups[key].templates.push(m)
    else groups[key].versioned.push(m)
  }

  let migrated = false
  for (const key of Object.keys(groups)) {
    const { proj, bundle, templates, versioned } = groups[key]
    const targetUri = `/DeploymentConfigs/${proj}/${bundle}.json`

    // Fetch existing target or build from template
    let targetDoc = null
    if (targetMap[key]) {
      try { const r = await mlFetch(`/v1/documents?uri=${encodeURIComponent(targetMap[key])}&format=json`); if (r.ok) targetDoc = await r.json() } catch {}
    }
    if (!targetDoc && templates.length > 0) {
      try { const r = await mlFetch(`/v1/documents?uri=${encodeURIComponent(templates[0].uri)}&format=json`); if (r.ok) targetDoc = await r.json() } catch {}
    }
    if (!targetDoc) targetDoc = { projectName: proj, bundleName: bundle }
    if (!Array.isArray(targetDoc.deployedVersions)) targetDoc.deployedVersions = []
    // Strip legacy top-level version fields
    delete targetDoc.bundleVersion; delete targetDoc.bundleUri; delete targetDoc.ruleflowUri

    // Merge version entries from versioned docs
    const existing = new Set(targetDoc.deployedVersions.map(v => v.version))
    for (const v of versioned) {
      if (existing.has(v.version)) continue
      try {
        const r = await mlFetch(`/v1/documents?uri=${encodeURIComponent(v.uri)}&format=json`)
        if (!r.ok) continue
        const vDoc = await r.json()
        targetDoc.deployedVersions.push({
          version: v.version,
          bundleUri: vDoc.bundleUri || `/ext/${proj}/${bundle}/${v.version}/decisionServiceBundle.js`,
          ruleflowUri: vDoc.ruleflowUri || null,
          deployedAt: vDoc.deployedAt || new Date().toISOString()
        })
        existing.add(v.version)
      } catch {}
    }
    targetDoc.deployedVersions.sort((a, b) => a.version - b.version)

    try {
      const putRes = await mlFetch(
        `/v1/documents?uri=${encodeURIComponent(targetUri)}&format=json&collection=${COLLECTION}`,
        { method: 'PUT', body: JSON.stringify(targetDoc) }
      )
      if (!putRes.ok) { console.warn(`[migration] Failed to write ${targetUri}`); continue }

      for (const t of templates) {
        if (t.uri !== targetUri) await mlFetch(`/v1/documents?uri=${encodeURIComponent(t.uri)}`, { method: 'DELETE' }).catch(() => {})
      }
      for (const v of versioned) {
        await mlFetch(`/v1/documents?uri=${encodeURIComponent(v.uri)}`, { method: 'DELETE' }).catch(() => {})
      }
      migrated = true
      console.log(`[DeploymentConfigPage] Migrated ${key} → ${targetUri}`)
    } catch (err) { console.warn(`[migration] Error for ${key}:`, err) }
  }
  return migrated
}

export default function DeploymentConfigPage() {
  // --- State ---
  const [configs, setConfigs] = useState([])
  const [projects, setProjects] = useState([])
  const [treeData, setTreeData] = useState([])
  const [selectedUri, setSelectedUri] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [configDoc, setConfigDoc] = useState(null)
  const [configEtag, setConfigEtag] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tabIndex, setTabIndex] = useState(0)
  const [splitterPanes, setSplitterPanes] = useState([
    { size: '380px', min: '260px', max: '600px', collapsible: true, resizable: true },
    { min: '400px' }
  ])

  // Status message
  const [statusMessage, setStatusMessage] = useState(null)

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Project rename
  const [projectEditName, setProjectEditName] = useState('')
  const [projectRenaming, setProjectRenaming] = useState(false)

  // --- Load config list from MarkLogic ---
  const loadConfigList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await mlFetch(
        '/v1/search?format=json&pageLength=500&options=corticonml-options&start=1',
        {
          method: 'POST',
          body: JSON.stringify({
            query: {
              'collection-query': { uri: [COLLECTION] }
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
          projectName: content.projectName || 'Unassigned',
          bundleName: content.bundleName || r.uri.split('/').pop().replace('.json', '')
        }
      })
      list.sort((a, b) => {
        const projCmp = a.projectName.localeCompare(b.projectName)
        if (projCmp !== 0) return projCmp
        return a.bundleName.localeCompare(b.bundleName)
      })

      // Auto-migrate legacy doc formats to single-doc-per-bundle
      const needsReload = await migrateLegacyConfigDocs(list)
      if (needsReload) return loadConfigList()

      setConfigs(list)

      // Derive unique projects
      const projs = [...new Set(list.map(c => c.projectName))].sort()
      setProjects(projs)
    } catch (err) {
      console.error('Failed to load deployment configs:', err)
      setStatusMessage({ type: 'error', text: 'Failed to load configurations: ' + err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfigList()
  }, [loadConfigList])

  // --- Build tree data when configs change ---
  useEffect(() => {
    const projectMap = {}
    configs.forEach(c => {
      const proj = c.projectName || 'Unassigned'
      if (!projectMap[proj]) projectMap[proj] = []
      projectMap[proj].push(c)
    })
    // Include projects created locally that have no configs yet
    projects.forEach(proj => {
      if (!projectMap[proj]) projectMap[proj] = []
    })
    const tree = Object.keys(projectMap).sort().map(proj => ({
      text: proj,
      isProject: true,
      expanded: proj === selectedProject || (selectedUri && projectMap[proj].some(c => c.uri === selectedUri)),
      items: projectMap[proj].map(c => ({
        text: c.bundleName,
        uri: c.uri,
        projectName: c.projectName,
        selected: c.uri === selectedUri
      }))
    }))
    setTreeData(tree)
  }, [configs, selectedUri, selectedProject, projects])

  // --- Load selected config document ---
  const loadConfig = useCallback(async (uri) => {
    if (!uri) return
    setLoading(true)
    try {
      const res = await mlFetch(`/v1/documents?uri=${encodeURIComponent(uri)}&format=json`)
      if (!res.ok) throw new Error(`Load failed: ${res.status}`)
      const etag = res.headers.get('ETag')
      const doc = await res.json()
      setConfigDoc(doc)
      setConfigEtag(etag)
      setDirty(false)
    } catch (err) {
      console.error('Failed to load config:', err)
      setStatusMessage({ type: 'error', text: 'Failed to load configuration: ' + err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedUri) loadConfig(selectedUri)
  }, [selectedUri, loadConfig])

  // --- Save config document ---
  const saveConfig = useCallback(async () => {
    if (!configDoc || !selectedUri) return
    setSaving(true)
    try {
      const headers = {}
      if (configEtag) headers['If-Match'] = configEtag
      const res = await mlFetch(
        `/v1/documents?uri=${encodeURIComponent(selectedUri)}&format=json&collection=${COLLECTION}`,
        { method: 'PUT', body: JSON.stringify(configDoc), headers }
      )
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Save failed (${res.status}): ${errText}`)
      }
      const newEtag = res.headers.get('ETag')
      if (newEtag) setConfigEtag(newEtag)
      setDirty(false)
      setStatusMessage({ type: 'success', text: 'Configuration saved successfully' })
      loadConfigList()
    } catch (err) {
      console.error('Failed to save config:', err)
      setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }, [configDoc, selectedUri, configEtag, loadConfigList])

  // --- Create new project ---
  const createProject = useCallback(() => {
    const name = prompt('Enter Project name:')
    if (!name || !name.trim()) return
    const trimmed = name.trim()
    if (projects.includes(trimmed)) {
      setStatusMessage({ type: 'error', text: `Project "${trimmed}" already exists` })
      return
    }
    setProjects(prev => [...prev, trimmed].sort())
    setSelectedProject(trimmed)
    setStatusMessage({ type: 'success', text: `Project "${trimmed}" created. Now add a configuration to it.` })
  }, [projects])

  // --- Create new config ---
  const createConfig = useCallback(async () => {
    let targetProject = selectedProject
    if (!targetProject && selectedUri) {
      targetProject = configs.find(c => c.uri === selectedUri)?.projectName
    }
    if (!targetProject || targetProject === 'Unassigned') {
      if (projects.filter(p => p !== 'Unassigned').length === 0) {
        setStatusMessage({ type: 'error', text: 'Please create a Project first' })
        return
      }
      targetProject = projects.find(p => p !== 'Unassigned') || projects[0]
    }

    const name = prompt(`Enter Bundle name (Project: ${targetProject}):`)
    if (!name || !name.trim()) return
    const bundleName = name.trim()

    const uri = `/DeploymentConfigs/${targetProject}/${bundleName}.json`
    const newDoc = createDefaultConfig(targetProject, bundleName)

    try {
      const res = await mlFetch(
        `/v1/documents?uri=${encodeURIComponent(uri)}&format=json&collection=${COLLECTION}`,
        { method: 'PUT', body: JSON.stringify(newDoc) }
      )
      if (!res.ok) throw new Error(`Create failed: ${res.status}`)
      setStatusMessage({ type: 'success', text: `Configuration "${bundleName}" created in "${targetProject}"` })
      setSelectedProject(targetProject)
      await loadConfigList()
      setSelectedUri(uri)
    } catch (err) {
      console.error('Failed to create config:', err)
      setStatusMessage({ type: 'error', text: 'Failed to create configuration: ' + err.message })
    }
  }, [loadConfigList, selectedProject, selectedUri, configs, projects])

  // --- Copy entire project (all its configs) to a new project name ---
  const copyProject = useCallback(async () => {
    if (!selectedProject) return
    const sourceConfigs = configs.filter(c => c.projectName === selectedProject)
    if (sourceConfigs.length === 0) {
      setStatusMessage({ type: 'error', text: `Project "${selectedProject}" has no configurations to copy.` })
      return
    }
    const newName = prompt(
      `Copy project "${selectedProject}" to a new project.\n\nEnter the new project name:`
    )
    if (!newName || !newName.trim()) return
    const trimmed = newName.trim()
    if (projects.includes(trimmed)) {
      setStatusMessage({ type: 'error', text: `Project "${trimmed}" already exists. Choose a different name.` })
      return
    }
    try {
      for (const c of sourceConfigs) {
        // Fetch the full document from MarkLogic
        const res = await mlFetch(`/v1/documents?uri=${encodeURIComponent(c.uri)}&format=json`)
        if (!res.ok) throw new Error(`Failed to read "${c.bundleName}": ${res.status}`)
        const doc = await res.json()

        // Build the copied document with the new project name; clear inputErf (ruleflow), outputDir and deployedVersions
        const { deployedVersions: _dv, ...docWithoutVersions } = doc
        const copiedDoc = {
          ...docWithoutVersions,
          projectName: trimmed,
          deployedVersions: [],
          compilation: {
            ...doc.compilation,
            inputErf: '',
            outputDir: ''
          }
        }

        // Write to MarkLogic under the new project path
        const newUri = `/DeploymentConfigs/${trimmed}/${c.bundleName}.json`
        const putRes = await mlFetch(
          `/v1/documents?uri=${encodeURIComponent(newUri)}&format=json&collection=${COLLECTION}`,
          { method: 'PUT', body: JSON.stringify(copiedDoc) }
        )
        if (!putRes.ok) throw new Error(`Failed to save copy of "${c.bundleName}": ${putRes.status}`)
      }
      setStatusMessage({
        type: 'success',
        text: `Project "${selectedProject}" copied to "${trimmed}" (${sourceConfigs.length} configuration${sourceConfigs.length === 1 ? '' : 's'} copied).`
      })
      await loadConfigList()
      setSelectedProject(trimmed)
      setSelectedUri(null)
      setConfigDoc(null)
    } catch (err) {
      console.error('Failed to copy project:', err)
      setStatusMessage({ type: 'error', text: 'Copy failed: ' + err.message })
    }
  }, [selectedProject, configs, projects, loadConfigList])

  // --- Copy a single bundle to a new bundle name within the same project ---
  const copyBundle = useCallback(async () => {
    if (!selectedUri) return
    const source = configs.find(c => c.uri === selectedUri)
    if (!source) return
    const { projectName, bundleName } = source
    const newName = prompt(
      `Copy bundle "${bundleName}" to a new bundle within project "${projectName}".\n\nEnter the new bundle name:`
    )
    if (!newName || !newName.trim()) return
    const trimmed = newName.trim()
    // Check for name collision within the same project
    const conflict = configs.find(c => c.projectName === projectName && c.bundleName === trimmed)
    if (conflict) {
      setStatusMessage({ type: 'error', text: `A bundle named "${trimmed}" already exists in project "${projectName}". Choose a different name.` })
      return
    }
    try {
      // Fetch the source bundle document
      const res = await mlFetch(`/v1/documents?uri=${encodeURIComponent(selectedUri)}&format=json`)
      if (!res.ok) throw new Error(`Failed to read "${bundleName}": ${res.status}`)
      const doc = await res.json()

      // Build copied document — clear inputErf and deployedVersions; keep everything else
      const { deployedVersions: _dv, ...docWithoutVersions } = doc
      const copiedDoc = {
        ...docWithoutVersions,
        bundleName: trimmed,
        deployedVersions: [],
        compilation: {
          ...doc.compilation,
          inputErf: ''
        }
      }

      // Write to MarkLogic under the new bundle path
      const newUri = `/DeploymentConfigs/${projectName}/${trimmed}.json`
      const putRes = await mlFetch(
        `/v1/documents?uri=${encodeURIComponent(newUri)}&format=json&collection=${COLLECTION}`,
        { method: 'PUT', body: JSON.stringify(copiedDoc) }
      )
      if (!putRes.ok) throw new Error(`Failed to save copied bundle: ${putRes.status}`)

      setStatusMessage({ type: 'success', text: `Bundle "${bundleName}" copied to "${trimmed}" in project "${projectName}".` })
      await loadConfigList()
      setSelectedUri(newUri)
      setSelectedProject(projectName)
    } catch (err) {
      console.error('Failed to copy bundle:', err)
      setStatusMessage({ type: 'error', text: 'Copy bundle failed: ' + err.message })
    }
  }, [selectedUri, configs, loadConfigList])

  // --- Delete entire project (all its configs) ---
  const deleteProject = useCallback(async () => {
    if (!selectedProject) return
    const projectConfigs = configs.filter(c => c.projectName === selectedProject)
    const hasConfigs = projectConfigs.length > 0
    const warning = hasConfigs
      ? `Delete project "${selectedProject}" and its ${projectConfigs.length} deployment configuration${projectConfigs.length === 1 ? '' : 's'}?\n\n⚠️ Deleting this project will remove all its deployment configurations. This action cannot be undone.`
      : `Delete empty project "${selectedProject}"?`
    if (!confirm(warning)) return
    try {
      for (const c of projectConfigs) {
        const res = await mlFetch(
          `/v1/documents?uri=${encodeURIComponent(c.uri)}`,
          { method: 'DELETE' }
        )
        if (!res.ok) throw new Error(`Delete failed for "${c.bundleName}": ${res.status}`)
      }
      setStatusMessage({ type: 'success', text: `Project "${selectedProject}" deleted (${projectConfigs.length} configuration${projectConfigs.length === 1 ? '' : 's'} removed)` })
      setSelectedProject(null)
      setSelectedUri(null)
      setConfigDoc(null)
      await loadConfigList()
    } catch (err) {
      console.error('Failed to delete project:', err)
      setStatusMessage({ type: 'error', text: 'Failed to delete project: ' + err.message })
    }
  }, [selectedProject, configs, loadConfigList])

  // --- Delete config ---
  const deleteConfig = useCallback(async () => {
    if (!selectedUri) return
    setDeleteDialogOpen(false)
    try {
      const res = await mlFetch(
        `/v1/documents?uri=${encodeURIComponent(selectedUri)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
      const bundleName = configs.find(c => c.uri === selectedUri)?.bundleName || selectedUri
      setStatusMessage({ type: 'success', text: `Configuration "${bundleName}" deleted` })
      setSelectedUri(null)
      setConfigDoc(null)
      await loadConfigList()
    } catch (err) {
      console.error('Failed to delete config:', err)
      setStatusMessage({ type: 'error', text: 'Failed to delete configuration: ' + err.message })
    }
  }, [selectedUri, configs, loadConfigList])

  // --- Rename project: updates projectName field + URI for all child configs ---
  const renameProject = useCallback(async () => {
    const newName = projectEditName.trim()
    if (!newName || newName === selectedProject) return
    const childConfigs = configs.filter(c => c.projectName === selectedProject)
    if (childConfigs.length === 0) {
      // No documents — just update local state
      setSelectedProject(newName)
      setProjectEditName(newName)
      await loadConfigList()
      return
    }
    if (!window.confirm(
      `Rename project "${selectedProject}" to "${newName}"?\n\n` +
      `This will update ${childConfigs.length} configuration document(s) in MarkLogic.`
    )) return
    setProjectRenaming(true)
    try {
      for (const c of childConfigs) {
        const getRes = await mlFetch(`/v1/documents?uri=${encodeURIComponent(c.uri)}&format=json`)
        if (!getRes.ok) throw new Error(`Failed to load "${c.bundleName}": ${getRes.status}`)
        const doc = await getRes.json()
        const newDoc = { ...doc, projectName: newName }
        const newUri = `/DeploymentConfigs/${newName}/${c.bundleName}.json`
        const putRes = await mlFetch(
          `/v1/documents?uri=${encodeURIComponent(newUri)}&format=json&collection=${COLLECTION}`,
          { method: 'PUT', body: JSON.stringify(newDoc) }
        )
        if (!putRes.ok) throw new Error(`Failed to save "${c.bundleName}": ${putRes.status}`)
        await mlFetch(`/v1/documents?uri=${encodeURIComponent(c.uri)}`, { method: 'DELETE' })
      }
      setSelectedProject(newName)
      setSelectedUri(null)
      setConfigDoc(null)
      await loadConfigList()
      setStatusMessage({ type: 'success', text: `Project renamed to "${newName}" — ${childConfigs.length} configuration(s) updated.` })
    } catch (err) {
      console.error('Rename project failed:', err)
      setStatusMessage({ type: 'error', text: 'Rename failed: ' + err.message })
    } finally {
      setProjectRenaming(false)
    }
  }, [projectEditName, selectedProject, configs, loadConfigList])

  // --- Generic field updaters ---
  const updateTopLevel = (field, value) => {
    setConfigDoc(prev => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  const updateCompilation = (field, value) => {
    setConfigDoc(prev => ({
      ...prev,
      compilation: { ...prev.compilation, [field]: value }
    }))
    setDirty(true)
  }

  const updateDeployment = (field, value) => {
    setConfigDoc(prev => ({
      ...prev,
      deployment: { ...prev.deployment, [field]: value }
    }))
    setDirty(true)
  }

  // Dependent JS array management
  const addDependentJS = () => {
    setConfigDoc(prev => ({
      ...prev,
      compilation: {
        ...prev.compilation,
        dependentJS: [...(prev.compilation.dependentJS || []), '']
      }
    }))
    setDirty(true)
  }

  const removeDependentJS = (index) => {
    setConfigDoc(prev => ({
      ...prev,
      compilation: {
        ...prev.compilation,
        dependentJS: prev.compilation.dependentJS.filter((_, i) => i !== index)
      }
    }))
    setDirty(true)
  }

  const updateDependentJS = (index, value) => {
    setConfigDoc(prev => {
      const deps = [...prev.compilation.dependentJS]
      deps[index] = value
      return {
        ...prev,
        compilation: { ...prev.compilation, dependentJS: deps }
      }
    })
    setDirty(true)
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
      if (dirty && selectedUri && !confirm('Unsaved changes will be lost. Continue?')) return
      setSelectedProject(item.text)
      setProjectEditName(item.text)
      setSelectedUri(null)
      setConfigDoc(null)
      setDirty(false)
    } else if (item.uri) {
      if (dirty && !confirm('Unsaved changes will be lost. Continue?')) return
      setSelectedUri(item.uri)
      setSelectedProject(item.projectName)
      setTabIndex(0)
    }
  }

  // --- Clear status after 5 seconds ---
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage])

  // --- Render: Left Panel (TreeView) ---
  const renderConfigList = () => (
    <div className="dc-list-panel">
      <div className="dc-list-toolbar">
        <h3>Configurations</h3>
        <div className="dc-list-actions">
          <Button themeColor="info" onClick={createProject} title="New Project">+ Project</Button>
          <Button themeColor="primary" onClick={createConfig} title="New Configuration">+ Config</Button>
          <Button themeColor="base" onClick={copyProject} disabled={!selectedProject || !!selectedUri} title="Copy this project and all its configurations to a new project">Copy Project</Button>
          <Button themeColor="base" onClick={copyBundle} disabled={!selectedUri} title="Copy this bundle to a new bundle name within the same project">Copy Bundle</Button>
          <Button themeColor="error" onClick={() => setDeleteDialogOpen(true)} disabled={!selectedUri} title="Delete selected configuration">Delete Config</Button>
          <Button themeColor="error" onClick={deleteProject} disabled={!selectedProject || !!selectedUri} title="Delete entire project and all its configurations">Delete Project</Button>
        </div>
      </div>
      <div className="dc-list-items">
        {loading && configs.length === 0 && <div className="dc-list-loading">Loading...</div>}
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
                <span className={`tree-config-node ${item.uri === selectedUri ? 'selected' : ''}`}>
                  {item.text}
                </span>
              )
            }}
          />
        ) : (
          !loading && <div className="dc-list-empty">No configurations found. Click "+ Project" to start.</div>
        )}
      </div>
    </div>
  )

  // --- Render: Compilation Configuration Tab ---
  const renderCompilationTab = () => {
    if (!configDoc) {
      return <div className="dc-placeholder">Select a configuration from the list, or create a new one.</div>
    }

    const comp = configDoc.compilation || {}

    return (
      <div className="dc-form">
        <div className="dc-form-section">
          <h4 className="dc-section-title">General</h4>
          <div className="dc-form-row">
            <div className="dc-form-field">
              <label className="dc-field-label">Bundle Name</label>
              <Input
                value={configDoc.bundleName || ''}
                onChange={(e) => updateTopLevel('bundleName', e.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        <div className="dc-form-section">
          <h4 className="dc-section-title">Java Configuration</h4>
          <div className="dc-form-row">
            <div className="dc-form-field dc-form-field-wide">
              <label className="dc-field-label">JAVA_HOME Path</label>
              <Input
                value={comp.javaHome || ''}
                onChange={(e) => updateCompilation('javaHome', e.value)}
                style={{ width: '100%' }}
                placeholder="e.g. C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot"
              />
            </div>
          </div>
        </div>

        <div className="dc-form-section">
          <h4 className="dc-section-title">Corticon Compiler Settings</h4>
          <div className="dc-form-row">
            <div className="dc-form-field dc-form-field-wide">
              <label className="dc-field-label">Corticon.js Home Location</label>
              <Input
                value={comp.corticonHome || ''}
                onChange={(e) => updateCompilation('corticonHome', e.value)}
                style={{ width: '100%' }}
                placeholder="e.g. C:\Progress\Corticon.js 2.4"
              />
            </div>
          </div>
          <div className="dc-form-row">
            <div className="dc-form-field dc-form-field-wide">
              <label className="dc-field-label">Input Rule Flow (.erf)</label>
              <Input
                value={comp.inputErf || ''}
                onChange={(e) => updateCompilation('inputErf', e.value)}
                style={{ width: '100%' }}
                placeholder="Full path to the .erf ruleflow file"
              />
            </div>
          </div>
          <div className="dc-form-row">
            <div className="dc-form-field dc-form-field-wide">
              <label className="dc-field-label">Output Directory</label>
              <Input
                value={comp.outputDir || ''}
                onChange={(e) => updateCompilation('outputDir', e.value)}
                style={{ width: '100%' }}
                placeholder="Directory where compiled bundle.js will be placed"
              />
            </div>
          </div>
        </div>

        <div className="dc-form-section">
          <h4 className="dc-section-title">
            Dependent JavaScript Files
            <Button
              themeColor="primary"
              size="small"
              onClick={addDependentJS}
              style={{ marginLeft: 12 }}
            >
              + Add File
            </Button>
          </h4>
          <div className="dc-dependent-js-list">
            {(comp.dependentJS || []).map((jsPath, idx) => (
              <div key={idx} className="dc-dependent-js-row">
                <span className="dc-dependent-js-index">{idx + 1}</span>
                <Input
                  value={jsPath}
                  onChange={(e) => updateDependentJS(idx, e.value)}
                  style={{ flex: 1 }}
                  placeholder="Full path to dependent .js file"
                />
                <Button
                  themeColor="error"
                  fillMode="flat"
                  size="small"
                  onClick={() => removeDependentJS(idx)}
                  title="Remove"
                >
                  &#10005;
                </Button>
              </div>
            ))}
            {(!comp.dependentJS || comp.dependentJS.length === 0) && (
              <div className="dc-dependent-js-empty">No dependent JS files configured.</div>
            )}
          </div>
        </div>

        <div className="dc-form-actions">
          <Button
            themeColor="primary"
            onClick={saveConfig}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {dirty && <span className="dc-unsaved-indicator">Unsaved changes</span>}
        </div>
      </div>
    )
  }

  // --- Render: Deployment Configuration Tab ---
  const renderDeploymentTab = () => {
    if (!configDoc) {
      return <div className="dc-placeholder">Select a configuration from the list, or create a new one.</div>
    }

    const dep = configDoc.deployment || {}

    return (
      <div className="dc-form">
        <div className="dc-form-section">
          <h4 className="dc-section-title">MarkLogic Connection</h4>
          <div className="dc-form-row">
            <div className="dc-form-field">
              <label className="dc-field-label">Application Name</label>
              <Input
                value={dep.mlAppName || ''}
                onChange={(e) => updateDeployment('mlAppName', e.value)}
                style={{ width: '100%' }}
                placeholder="e.g. corticonml"
              />
            </div>
            <div className="dc-form-field">
              <label className="dc-field-label">Host</label>
              <Input
                value={dep.mlHost || ''}
                onChange={(e) => updateDeployment('mlHost', e.value)}
                style={{ width: '100%' }}
                placeholder="e.g. localhost"
              />
            </div>
            <div className="dc-form-field">
              <label className="dc-field-label">REST Port</label>
              <NumericTextBox
                value={dep.mlRestPort || null}
                onChange={(e) => updateDeployment('mlRestPort', e.value)}
                style={{ width: '100%' }}
                min={1}
                max={65535}
                format="#"
                spinners={false}
              />
            </div>
          </div>
          <div className="dc-form-row">
            <div className="dc-form-field">
              <label className="dc-field-label">Authentication</label>
              <DropDownList
                data={AUTH_OPTIONS}
                value={dep.mlRestAuthentication || 'digest'}
                onChange={(e) => updateDeployment('mlRestAuthentication', e.value)}
                style={{ width: '100%' }}
                popupSettings={{ popupClass: 'dc-dropdown-popup' }}
              />
            </div>
            <div className="dc-form-field">
              <label className="dc-field-label">Username</label>
              <Input
                value={dep.mlUsername || ''}
                onChange={(e) => updateDeployment('mlUsername', e.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="dc-form-field">
              <label className="dc-field-label">Password</label>
              <Input
                type="password"
                value={dep.mlPassword || ''}
                onChange={(e) => updateDeployment('mlPassword', e.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div className="dc-form-row">
            <div className="dc-form-field dc-form-field-wide">
              <label className="dc-field-label">Modules Database</label>
              <Input
                value={dep.modulesDatabase || ''}
                onChange={(e) => updateDeployment('modulesDatabase', e.value)}
                style={{ width: '100%' }}
                placeholder={`${dep.mlAppName || 'corticonml'}-modules — MarkLogic database in which the rule bundle will be placed`}
              />
            </div>
          </div>
        </div>

        <div className="dc-form-section">
          <h4 className="dc-section-title">Bundle Deployment</h4>
          <div className="dc-form-row">
            <div className="dc-form-field dc-form-field-wide">
              <label className="dc-field-label">Bundle Target URI (in MarkLogic)</label>
              <div className="dc-bundle-uri-row">
                <Input
                  value={dep.bundleUriBase ?? '/ext'}
                  onChange={(e) => updateDeployment('bundleUriBase', e.value || '/ext')}
                  style={{ width: 160, flexShrink: 0 }}
                  placeholder="/ext"
                  title="Base path in the MarkLogic modules database (e.g. /ext)"
                />
                <span className="dc-bundle-uri-suffix">
                  {configDoc.projectName && configDoc.bundleName ? (
                    <>/{configDoc.projectName}/{configDoc.bundleName}/<em style={{color:'#888'}}>&#123;version&#125;</em>/decisionServiceBundle.js</>
                  ) : (
                    <em className="dc-field-derived-empty">/{'{'}ruleProject{'}'}/{'{'}bundleName{'}'}/{'{'}version{'}'}/decisionServiceBundle.js</em>
                  )}
                </span>
              </div>
              <span className="dc-field-derived-hint" style={{fontSize:'11px',color:'#888',marginTop:4,display:'block'}}>
                Only the base path is configurable. The remainder is derived automatically from Project Name, Bundle Name and version.
              </span>
            </div>
          </div>
          {Array.isArray(configDoc.deployedVersions) && configDoc.deployedVersions.length > 0 && (
            <div className="dc-form-row">
              <div className="dc-form-field dc-form-field-wide">
                <label className="dc-field-label">Deployed Versions</label>
                <div className="dc-deployed-versions">
                  {[...configDoc.deployedVersions].sort((a, b) => b.version - a.version).map(v => {
                    let dateStr = ''
                    if (v.deployedAt) {
                      const d = new Date(v.deployedAt)
                      const pad = n => String(n).padStart(2, '0')
                      const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds()
                      dateStr = `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(h)}:${pad(m)}:${pad(s)}`
                    }
                    return (
                      <div key={v.version} className="dc-deployed-version-row">
                        <span className="dc-version-badge">v{v.version}</span>
                        <code className="dc-version-uri">{v.bundleUri}</code>
                        {dateStr && <span className="dc-version-date">{dateStr}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="dc-form-section">
          <h4 className="dc-section-title">Gradle Configuration</h4>
          <div className="dc-form-row">
            <div className="dc-form-field dc-form-field-wide">
              <label className="dc-field-label">Gradle Project Directory</label>
              <Input
                value={dep.gradleProjectDir || ''}
                onChange={(e) => updateDeployment('gradleProjectDir', e.value)}
                style={{ width: '100%' }}
                placeholder="Root directory of the ml-gradle project"
              />
            </div>
          </div>
          <div className="dc-form-row">
            <div className="dc-form-field dc-form-field-wide">
              <label className="dc-field-label">Additional Gradle Arguments</label>
              <Input
                value={dep.additionalGradleArgs || ''}
                onChange={(e) => updateDeployment('additionalGradleArgs', e.value)}
                style={{ width: '100%' }}
                placeholder="e.g. -PmlHost=production-server"
              />
            </div>
          </div>
        </div>

        <div className="dc-form-actions">
          <Button
            themeColor="primary"
            onClick={saveConfig}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {dirty && <span className="dc-unsaved-indicator">Unsaved changes</span>}
        </div>
      </div>
    )
  }

  // --- Main render ---
  return (
    <div className="dc-page">
      {statusMessage && (
        <div className={`dc-status-bar ${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}
      <Splitter
        panes={splitterPanes}
        onChange={(e) => setSplitterPanes(e.newState)}
        style={{ height: '100%' }}
      >
        {renderConfigList()}
        <div className="dc-detail-panel">
          {selectedProject && !selectedUri ? (
            <div className="dc-project-editor-panel">
              <h3 className="dc-project-editor-title">&#128193; Project Settings</h3>
              <div className="dc-project-editor-field">
                <label className="dc-field-label">Project Name</label>
                <div className="dc-project-editor-row">
                  <Input
                    value={projectEditName}
                    onChange={(e) => setProjectEditName(e.value)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    themeColor="primary"
                    onClick={renameProject}
                    disabled={projectRenaming || !projectEditName.trim() || projectEditName.trim() === selectedProject}
                  >
                    {projectRenaming ? 'Renaming…' : 'Rename Project'}
                  </Button>
                </div>
                <span className="dc-project-editor-hint">
                  Renaming updates all configuration documents in MarkLogic and changes their URI paths.
                </span>
              </div>
            </div>
          ) : (
            <TabStrip selected={tabIndex} onSelect={(e) => setTabIndex(e.selected)}>
              <TabStripTab title="Compilation Configuration">
                {renderCompilationTab()}
              </TabStripTab>
              <TabStripTab title="Deployment Configuration">
                {renderDeploymentTab()}
              </TabStripTab>
            </TabStrip>
          )}
        </div>
      </Splitter>
      {deleteDialogOpen && (() => {
        const cfg = configs.find(c => c.uri === selectedUri)
        return (
          <Dialog
            title="Confirm Delete Configuration"
            onClose={() => setDeleteDialogOpen(false)}
            className="dc-confirm-dialog"
            width={440}
          >
            <p>You are about to permanently delete the deployment configuration <strong>"{cfg?.bundleName}"</strong>{cfg?.projectName ? ` (project: "${cfg.projectName}")` : ''}.</p>
            <p>Only this configuration will be deleted — the project will remain.</p>
            <p>⚠️ This action cannot be undone. Are you sure you want to proceed?</p>
            <DialogActionsBar>
              <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button themeColor="error" onClick={deleteConfig}>Delete</Button>
            </DialogActionsBar>
          </Dialog>
        )
      })()}
    </div>
  )
}
