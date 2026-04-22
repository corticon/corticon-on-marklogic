// Express proxy server for MarkLogic REST API
// Handles Digest authentication and forwards ETag/If-Match headers

import express from 'express'
import DigestClient from 'digest-fetch'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { stat, copyFile, mkdir, readFile, writeFile, rm, mkdtemp, readdir } from 'fs/promises'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { XMLParser } from 'fast-xml-parser'
import { patchBundleFile } from './patchBundle.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.resolve('./.env') })

const app = express()
app.use(express.json())
app.use(express.text({ type: 'application/x-www-form-urlencoded' }))

const ML_HOST = process.env.ML_HOST || 'localhost'
const ML_PORT = process.env.ML_PORT || '8000'
const ML_MANAGE_PORT = process.env.ML_MANAGE_PORT || '8002'
const ML_USER = process.env.ML_USER || 'admin'
const ML_PASS = process.env.ML_PASS || 'admin'
const MIDDLE_TIER_PORT = process.env.ML_MIDDLE_TIER_PORT || 4004
const UI_ORIGIN = process.env.UI_ORIGIN || 'http://localhost:5173'
const isWin    = process.platform === 'win32'

const client = new DigestClient(ML_USER, ML_PASS)

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', UI_ORIGIN)
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, If-Match, If-None-Match')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Expose-Headers', 'ETag, Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Proxy route with ETag/If-Match support
app.all('/v1/*', async (req, res) => {
  const url = `http://${ML_HOST}:${ML_PORT}${req.originalUrl}`
  
  const headers = {
    'Content-Type': req.headers['content-type'] || 'application/json',
    'Accept': req.headers['accept'] || 'application/json'
  }

  // Forward If-Match header for optimistic concurrency
  if (req.headers['if-match']) {
    headers['If-Match'] = req.headers['if-match']
  }

  // Forward If-None-Match header for conditional requests
  if (req.headers['if-none-match']) {
    headers['If-None-Match'] = req.headers['if-none-match']
  }

  // Serialize body based on content type
  let body = undefined
  if (req.method !== 'GET' && req.method !== 'DELETE' && req.body) {
    const ct = (req.headers['content-type'] || '').toLowerCase()
    if (ct.includes('x-www-form-urlencoded') && typeof req.body === 'string') {
      body = req.body
    } else if (typeof req.body === 'object') {
      body = JSON.stringify(req.body)
    } else {
      body = req.body
    }
  }

  const options = {
    method: req.method,
    headers,
    body
  }

  // Debug: Log PUT requests that are failing
  if (req.method === 'PUT' && req.originalUrl.includes('Products')) {
    console.log('Backend PUT request for Products:')
    console.log('URL:', url)
    console.log('Body:', req.body)
    console.log('Body stringified:', JSON.stringify(req.body))
    console.log('Headers:', headers)
  }

  try {
    const response = await client.fetch(url, options)
    
    // Forward ETag from MarkLogic response
    const etag = response.headers.get('ETag')
    if (etag) {
      res.setHeader('ETag', etag)
    }

    // Forward Content-Type
    const contentType = response.headers.get('Content-Type')
    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    const data = await response.text()
    console.log(`[Proxy ${new Date().toISOString()}] ${req.method} ${url} => ${response.status}`)
    
    // Debug: Log failed PUT requests
    if (req.method === 'PUT' && !response.ok) {
      console.log('PUT failed - Response body:', data)
    }
    
    res.status(response.status).send(data)
  } catch (err) {
    console.error('[Proxy Error]', err)
    res.status(500).send({ error: err.message })
  }
})

// ── Bundle File Date ────────────────────────────────────────────────────────────
// Returns the last-modified time of the Corticon bundle's local source file.
// MarkLogic's /v1/eval with ?database= requires xdbc-eval-in privilege on the
// app server — reading the local file via fs.stat avoids that constraint.
// The MarkLogic URI /ext/Foo/bundle.js maps to
//   <ML_MODULES_ROOT>/ext/Foo/bundle.js
// where ML_MODULES_ROOT defaults to the sibling mlCorticonProductDataManagement
// Gradle project's ml-modules root.
const ML_MODULES_ROOT = process.env.ML_MODULES_ROOT ||
  path.resolve(__dirname, '../../../mlCorticonProductDataManagement/src/main/ml-modules')

app.get('/bundle-file-date', async (req, res) => {
  const { uri } = req.query
  if (!uri) return res.status(400).json({ error: 'uri is required' })

  // Strip leading slash so path.join works correctly
  const localPath = path.join(ML_MODULES_ROOT, uri.startsWith('/') ? uri.slice(1) : uri)
  try {
    const info = await stat(localPath)
    return res.json({ deployedAt: info.mtime.toISOString() })
  } catch {
    // Local file not found — fall back to checking MarkLogic directly.
    // This handles bundles deployed from another portal or by other means.
  }

  try {
    // uri is like /ext/Foo/bar.js — strip leading /ext since /v1/ext is already the base
    const afterExt = uri.replace(/^\/ext/, '')
    const encodedPath = afterExt.split('/').map(seg => encodeURIComponent(seg)).join('/')
    const mlUrl = `http://${ML_HOST}:${ML_PORT}/v1/ext${encodedPath}`
    const mlRes = await client.fetch(mlUrl, { method: 'GET' })
    if (mlRes.ok) {
      const lastMod = mlRes.headers.get('Last-Modified')
      const deployedAt = lastMod ? new Date(lastMod).toISOString() : null
      return res.json({ deployedAt, exists: true })
    }
    res.json({ deployedAt: null })
  } catch (err) {
    console.warn(`[bundle-file-date] MarkLogic check failed for ${uri}: ${err.message}`)
    res.json({ deployedAt: null })
  }
})

// ── Compile Decision Service ────────────────────────────────────────────────────
// Streams the output of corticonJS.bat as Server-Sent Events, then copies the
// compiled bundle into the ml-modules source tree.
app.get('/compile-decision-service', async (req, res) => {
  const { configUri } = req.query
  if (!configUri) return res.status(400).json({ error: 'configUri is required' })

  const bundleVersionRaw = req.query.bundleVersion
  const bundleVersion = parseInt(bundleVersionRaw, 10)
  if (!bundleVersionRaw || isNaN(bundleVersion) || bundleVersion < 1) {
    return res.status(400).json({ error: 'bundleVersion is required and must be a positive integer ≥ 1' })
  }

  // SSE — CORS headers already set by middleware above
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' })
  res.flushHeaders()

  const send = (obj) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`) }
  const log  = (line, stream = 'info') => send({ line, stream })

  // Keep-alive ping so the browser doesn't drop the connection during long compiles
  const keepalive = setInterval(() => { if (!res.writableEnded) res.write(': keepalive\n\n') }, 15000)

  try {
    log(`Fetching config from MarkLogic: ${configUri}`)
    const mlUrl = `http://${ML_HOST}:${ML_PORT}/v1/documents?uri=${encodeURIComponent(configUri)}&format=json`
    const mlRes = await client.fetch(mlUrl)
    if (!mlRes.ok) throw new Error(`Config fetch failed (HTTP ${mlRes.status})`)
    const config = await mlRes.json()

    const { bundleName, projectName, compilation = {}, deployment = {} } = config
    const { javaHome, platform = 'MarkLogic', dependentJS = [], inputErf, outputDir, corticonHome } = compilation
    const { gradleProjectDir, gradleTask = 'mlLoadModules', additionalGradleArgs = '', bundleUriBase = '/ext' } = deployment

    if (!bundleName)       throw new Error('Config missing bundleName')
    if (!projectName)      throw new Error('Config missing projectName')
    if (!corticonHome)     throw new Error('Config missing compilation.corticonHome')
    if (!inputErf)         throw new Error('Config missing compilation.inputErf')
    if (!outputDir)        throw new Error('Config missing compilation.outputDir')
    if (!gradleProjectDir) throw new Error('Config missing deployment.gradleProjectDir')

    // Bundle URI: {bundleUriBase}/{projectName}/{bundleName}/{version}/decisionServiceBundle.js
    const uriBase = (bundleUriBase || '/ext').replace(/\/+$/, '')
    const bundleUri = `${uriBase}/${projectName}/${bundleName}/${bundleVersion}/decisionServiceBundle.js`

    // Derive CORTICON_WORK from the corticonHome path convention:
    // e.g. C:\Progress\Corticon.js 2.4  →  C:\Progress\Corticon.js_Work_2.4
    const corticonVersion  = path.basename(corticonHome).replace(/^Corticon\.js\s+/i, '')
    const corticonWork     = path.join(path.dirname(corticonHome), `Corticon.js_Work_${corticonVersion}`)
    const resolvedJavaHome = javaHome || path.join(corticonHome, 'jre')
    const javaExe          = path.join(resolvedJavaHome, 'bin', isWin ? 'java.exe' : 'java')

    // Build classpath from the 4 JARs Corticon needs
    const libDir     = path.join(corticonHome, 'Javascript Utilities', 'lib')
    const classpath  = ['CcJSUtilities.jar', 'CcDeploy.jar', 'Corticon_Foundation_API.jar', 'Corticon_Foundation_I18n.jar']
                         .map(j => path.join(libDir, j)).join(path.delimiter)
    const licenseJar = path.join(corticonWork, 'license', 'JSStudio', 'CcLicense.jar')

    log(`Bundle       : ${bundleName}`)
    log(`Platform     : ${platform}`)
    log(`ERF          : ${inputErf}`)
    log(`Output       : ${outputDir}`)
    log(`Corticon Home: ${corticonHome}`)
    log(`Corticon Work: ${corticonWork}`)
    log(`Java         : ${javaExe}`)

    // Assemble java args — Node passes each element as a separate argv entry
    // so no manual cmd.exe quoting is needed regardless of spaces in paths
    const javaArgs = [
      '-cp', classpath,
      `-DCORTICON_SETTING=UTL`,
      `-DCORTICON_HOME=${corticonHome}`,
      `-DCORTICON_WORK_DIR=${corticonWork}`,
      `-DCORTICON_LICENSE=${licenseJar}`,
      'com.corticon.management.CorticonJS',
      '-c',
      '-b', bundleName,
    ]
    const djsList = dependentJS.filter(Boolean)
    if (djsList.length > 0) javaArgs.push('-djs', ...djsList)
    javaArgs.push('-i', inputErf, '-o', outputDir, '-p', platform)

    log(`> java ${javaArgs.join(' ')}`, 'cmd')

    const env = { ...process.env, JAVA_HOME: resolvedJavaHome }
    env.PATH = path.join(resolvedJavaHome, 'bin') + path.delimiter + (process.env.PATH || '')

    // Spawn java directly — no shell wrapper needed
    const child = spawn(javaExe, javaArgs, { env })
    child.stdout.on('data', d => d.toString().split(/\r?\n/).filter(l => l.trim()).forEach(l => log(l, 'stdout')))
    child.stderr.on('data', d => d.toString().split(/\r?\n/).filter(l => l.trim()).forEach(l => log(l, 'stderr')))

    await new Promise((resolve, reject) => {
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`Corticon compiler exited with code ${code}`)))
      child.on('error', reject)
    })

    log('Compilation successful.')

    // Copy compiled bundle into ml-modules source tree
    // Destination mirrors the bundle URI path under ML_MODULES_ROOT
    const bundleSource = path.join(outputDir, bundleName, 'markLogic', 'decisionServiceBundle.js')
    const uriRelative  = bundleUri.replace(/^\//, '')  // strip leading slash
    const bundleDest   = path.join(ML_MODULES_ROOT, uriRelative)

    log(`Copying bundle to ml-modules...`)
    log(`  From: ${bundleSource}`)
    log(`  To  : ${bundleDest}`)
    log(`  URI : ${bundleUri}`)
    await mkdir(path.dirname(bundleDest), { recursive: true })
    await copyFile(bundleSource, bundleDest)
    log('Bundle copied to ml-modules source folder.')

    // ── Check for 0 KB bundle (compilation produced no output) ─────────
    const bundleStat = await stat(bundleDest)
    if (bundleStat.size === 0) {
      log('')
      log('ERROR: The compiled bundle is 0 KB — the compilation produced an empty file.', 'error')
      log('Deployment skipped — an empty bundle cannot be deployed.', 'error')
      log('')
      log('The Corticon JS compilation utility does not generate a log file, so the root cause is not visible here.', 'error')
      log('To debug this issue:', 'error')
      log('  1. Open the Ruleflow (.erf) in Corticon Studio', 'error')
      log('  2. Compile it manually (Package > Decision Service > JavaScript)', 'error')
      log('  3. Check the Corticon Studio log file (Help > Corticon Log File) for compilation errors', 'error')
      send({ done: true, success: false, error: 'Bundle is 0 KB — compilation produced an empty file. Deployment skipped.' })
      return
    }

    // ── Patch: fix Corticon generator bug (mismatched branch container call sites) ──
    const patchReport = await patchBundleFile(bundleDest)
    if (patchReport.patched) {
      log(`[patchBundle] Applied ${patchReport.fixes.length} branch container fix(es):`)
      for (const { broken, correct } of patchReport.fixes) {
        log(`  ${broken.trim()} → ${correct.trim()}`)
      }
    } else {
      log('[patchBundle] Bundle is clean — no fixes needed.')
    }

    // ── Generate ruleflow JSON (corticonJS -g) and store in MarkLogic ──────────
    const ruleflowName = path.basename(inputErf, '.erf')
    const ruleflowUri  = `/rules/${projectName}/${ruleflowName}/${bundleVersion}.json`
    const genJsonOut   = path.join(tmpdir(), `corticon-genjson-${Date.now()}.json`)

    log('')
    log(`Exporting ruleflow details to ${ruleflowUri}...`)

    const genJsonArgs = [
      '-cp', classpath,
      `-DCORTICON_SETTING=UTL`,
      `-DCORTICON_HOME=${corticonHome}`,
      `-DCORTICON_WORK_DIR=${corticonWork}`,
      `-DCORTICON_LICENSE=${licenseJar}`,
      'com.corticon.management.CorticonJS',
      '-g',
      '-i', inputErf,
      '-o', genJsonOut
    ]
    log(`> java ${genJsonArgs.join(' ')}`, 'cmd')

    const genJsonChild = spawn(javaExe, genJsonArgs, { env })
    genJsonChild.stdout.on('data', d => d.toString().split(/\r?\n/).filter(l => l.trim()).forEach(l => log(l, 'stdout')))
    genJsonChild.stderr.on('data', d => d.toString().split(/\r?\n/).filter(l => l.trim()).forEach(l => log(l, 'stderr')))

    const genJsonCode = await new Promise((resolve, reject) => {
      genJsonChild.on('close', resolve)
      genJsonChild.on('error', reject)
    })

    if (genJsonCode !== 0) {
      throw new Error(
        `corticonJS -g (genJson) exited with code ${genJsonCode}. ` +
        `The ruleflow JSON could not be exported — check the log above for details. ` +
        `Deployment is aborted to keep the stored ruleflow details in sync with the deployed bundle.`
      )
    }

    const genJsonContent = await readFile(genJsonOut, 'utf8')
    const mlPutUrl = `http://${ML_HOST}:${ML_PORT}/v1/documents` +
      `?uri=${encodeURIComponent(ruleflowUri)}&format=json&collection=RuleflowDetails`
    const mlPutRes = await client.fetch(mlPutUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: genJsonContent
    })
    if (!mlPutRes.ok) {
      const errText = await mlPutRes.text()
      throw new Error(
        `Failed to store ruleflow details at ${ruleflowUri} in MarkLogic (HTTP ${mlPutRes.status}): ${errText}. ` +
        `Deployment is aborted to keep the stored ruleflow details in sync with the deployed bundle.`
      )
    }
    log(`Ruleflow details stored at ${ruleflowUri}.`)
    // Clean up temp file (best-effort)
    rm(genJsonOut).catch(() => {})

    // Append this version to the deployedVersions array in the single DeploymentConfig doc.
    // One doc per bundle — no per-version documents.
    const existingVersions = Array.isArray(config.deployedVersions) ? config.deployedVersions : []
    const versionEntry = { version: bundleVersion, bundleUri, ruleflowUri, deployedAt: new Date().toISOString() }
    const updatedVersions = [...existingVersions.filter(v => v.version !== bundleVersion), versionEntry]
      .sort((a, b) => a.version - b.version)
    // Build updated config: strip legacy top-level version fields, add deployedVersions
    const { bundleVersion: _bv, bundleUri: _bu, ruleflowUri: _rf, ...configBase } = config
    const updatedConfig = { ...configBase, deployedVersions: updatedVersions }
    const cfgPutUrl = `http://${ML_HOST}:${ML_PORT}/v1/documents` +
      `?uri=${encodeURIComponent(configUri)}&format=json&collection=DeploymentConfigs`
    const cfgPutRes = await client.fetch(cfgPutUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedConfig)
    })
    if (!cfgPutRes.ok) {
      const errText = await cfgPutRes.text()
      throw new Error(`Failed to update DeploymentConfig at ${configUri} (HTTP ${cfgPutRes.status}): ${errText}`)
    }
    log(`DeploymentConfig updated at ${configUri} — v${bundleVersion} added to deployedVersions.`)

    // Deploy to MarkLogic via Gradle
    send({ phase: 'deploying' })
    log('')
    log('Deploying to MarkLogic via Gradle...')
    const gradlewLocal = path.join(gradleProjectDir, isWin ? 'gradlew.bat' : 'gradlew')
    let gradleExe
    try { await stat(gradlewLocal); gradleExe = gradlewLocal } catch { gradleExe = 'gradle' }
    const gradleTaskArgs = [gradleTask, ...((additionalGradleArgs || '').trim().split(/\s+/).filter(Boolean))]
    const qg = (s) => s.includes(' ') ? `"${s}"` : s
    const gradleCmdLine = [qg(gradleExe), ...gradleTaskArgs].join(' ')
    log(`> ${gradleCmdLine}`, 'cmd')
    log(`  (cwd: ${gradleProjectDir})`)

    const gradleChild = isWin
      ? spawn('cmd.exe', ['/c', `"${gradleCmdLine}"`], { cwd: gradleProjectDir, env: process.env, windowsVerbatimArguments: true })
      : spawn(gradleExe, gradleTaskArgs, { cwd: gradleProjectDir, env: process.env })
    gradleChild.stdout.on('data', d => d.toString().split(/\r?\n/).filter(l => l.trim()).forEach(l => log(l, 'stdout')))
    gradleChild.stderr.on('data', d => d.toString().split(/\r?\n/).filter(l => l.trim()).forEach(l => log(l, 'stderr')))

    await new Promise((resolve, reject) => {
      gradleChild.on('close', code => code === 0 ? resolve() : reject(new Error(`Gradle ${gradleTask} failed with exit code ${code}`)))
      gradleChild.on('error', reject)
    })
    log(`Gradle ${gradleTask} completed successfully.`)

    send({ done: true, success: true, bundleVersion, bundleUri, configUri })
  } catch (err) {
    log(`ERROR: ${err.message}`, 'error')
    send({ done: true, success: false, error: err.message })
    console.error('[compile-decision-service]', err)
  } finally {
    clearInterval(keepalive)
    res.end()
  }
})

// ── Decision Service Test ─────────────────────────────────────────────────────
// Invokes a deployed Corticon decision service bundle on MarkLogic via /v1/eval
// without persisting any documents. bundleUri comes from the deployment config.
app.post('/test-decision-service', async (req, res) => {
  const { bundleUri, payload, debugEngine, ruleTracing } = req.body

  if (!bundleUri) {
    return res.status(400).json({ error: 'bundleUri is required' })
  }
  if (!payload || !Array.isArray(payload)) {
    return res.status(400).json({ error: 'payload must be a JSON array' })
  }

  // Build the Server-Side JavaScript that MarkLogic will eval.
  // Mirrors productsTrigger.sjs but returns the result directly — no doc writes.
  // declareUpdate() must come first: with logLevel > 0 (debug mode) Corticon calls
  // xdmp.log() via logFunction before invoking the SCO, which locks the transaction
  // as query-only. After that, the SCO's own declareUpdate() throws
  // "Operation not allowed on the currently executing transaction".
  // Declaring update here upgrades the transaction before any xdmp.log() fires.
  const logLevel = debugEngine ? 1 : 0
  const jsCode = [
    `declareUpdate();`,
    `var bundle = require(${JSON.stringify(bundleUri)});`,
    `var configuration = {`,
    `  logLevel: ${logLevel},`,
    `  logFunction: function(msg) {`,
    `    xdmp.log('[DSTest] ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)), 'info');`,
    `  },`,
    `  executionMetrics: ${ruleTracing ? 'true' : 'false'}`,
    `};`,
    `var inputPayload = ${JSON.stringify(payload)};`,
    `bundle.execute(inputPayload, configuration);`
  ].join('\n')

  const evalUrl = `http://${ML_HOST}:${ML_PORT}/v1/eval`

  try {
    const mlResponse = await client.fetch(evalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'multipart/mixed'
      },
      body: 'javascript=' + encodeURIComponent(jsCode)
    })

    const responseText = await mlResponse.text()
    console.log(`[test-decision-service ${new Date().toISOString()}] bundleUri=${bundleUri} => ${mlResponse.status}`)

    if (!mlResponse.ok) {
      return res.status(mlResponse.status).json({
        error: `MarkLogic eval failed (HTTP ${mlResponse.status})`,
        detail: responseText
      })
    }

    // Parse the first JSON part of the multipart/mixed eval response
    const contentType = mlResponse.headers.get('Content-Type') || ''
    const result = parseFirstMultipartPart(contentType, responseText)
    sanitizeDecimalsInResult(result)

    res.json({ success: true, result, bundleUri })
  } catch (err) {
    console.error('[test-decision-service] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── Evaluate Product (decision service enrichment for Products grid) ─────────
// Called before persisting a product record. Runs the Corticon decision service
// and returns the enriched product with makeableCheck / routingCheck / bomCheck.
const PRODUCT_PROJECT_NAME = 'Product Manufacturing Configuration'
const PRODUCT_BUNDLE_NAME  = 'Process Products'

async function resolveLatestProductBundleUri() {
  const searchUrl = `http://${ML_HOST}:${ML_PORT}/v1/search` +
    `?format=json&pageLength=500&options=corticonml-options&start=1`
  const searchRes = await client.fetch(searchUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { 'collection-query': { uri: ['DeploymentConfigs'] } } })
  })
  if (!searchRes.ok) throw new Error(`DeploymentConfigs search failed (HTTP ${searchRes.status})`)
  const searchData = await searchRes.json()
  for (const r of (searchData.results || [])) {
    const c = r.extracted?.content?.[0] || {}
    if (c.projectName !== PRODUCT_PROJECT_NAME || c.bundleName !== PRODUCT_BUNDLE_NAME) continue
    // New format: deployedVersions array — pick highest version
    if (Array.isArray(c.deployedVersions) && c.deployedVersions.length > 0) {
      const latest = c.deployedVersions.reduce((best, v) => v.version > (best?.version ?? 0) ? v : best, null)
      if (latest?.bundleUri) return latest.bundleUri
    }
    // Legacy fallback: bundleUri field directly on doc
    if (c.bundleUri) return c.bundleUri
  }
  throw new Error(
    `No deployed bundle found for ${PRODUCT_PROJECT_NAME} / ${PRODUCT_BUNDLE_NAME}. ` +
    `Compile and deploy first.`
  )
}

app.post('/evaluate-product', async (req, res) => {
  const { product } = req.body
  if (!product || typeof product !== 'object' || Array.isArray(product)) {
    return res.status(400).json({ error: 'product must be a JSON object' })
  }

  console.log(`[evaluate-product] Received request for payload: ${JSON.stringify(product)}`)

  const evalUrl = `http://${ML_HOST}:${ML_PORT}/v1/eval`
  try {
    const productBundleUri = await resolveLatestProductBundleUri()
    console.log(`[evaluate-product] Resolved bundle URI: ${productBundleUri}`)

    const payload = [{ ...product }]
    const jsCode = [
      `var bundle = require(${JSON.stringify(productBundleUri)});`,
      `var configuration = { logLevel: 0, executionMetrics: false };`,
      `var inputPayload = ${JSON.stringify(payload)};`,
      `bundle.execute(inputPayload, configuration);`
    ].join('\n')

    const mlResponse = await client.fetch(evalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'multipart/mixed'
      },
      body: 'javascript=' + encodeURIComponent(jsCode)
    })

    const responseText = await mlResponse.text()
    console.log(`[evaluate-product ${new Date().toISOString()}] => ${mlResponse.status}`)

    if (!mlResponse.ok) {
      return res.status(mlResponse.status).json({
        error: `Decision service eval failed (HTTP ${mlResponse.status})`,
        detail: responseText.substring(0, 500)
      })
    }

    const contentType = mlResponse.headers.get('Content-Type') || ''
    const result = parseFirstMultipartPart(contentType, responseText)
    sanitizeDecimalsInResult(result)

    // Corticon-level error (HTTP 200 but engine reported error)
    if (result?.corticon?.status === 'error') {
      const raw = result.corticon.description || 'Decision service returned an error'
      // Corticon prefixes its own messages with "Error: " — strip it to avoid "Error: Error: …"
      const msg = raw.replace(/^Error:\s*/i, '')
      return res.json({ success: false, error: msg })
    }

    // Extract the enriched first item from the payload
    const enriched = result?.payload?.[0] ?? result?.[0] ?? null
    console.log(`[evaluate-product] Decision service returned enriched: ${JSON.stringify(enriched)}`)

    res.json({ success: true, enriched })
  } catch (err) {
    console.error('[evaluate-product] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Detect a Decimal.js instance that MarkLogic's SpiderMonkey has already serialised
// to a plain JSON object — it has own numeric s/e/d fields plus string-valued method keys.
function isSerializedDecimal(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) &&
         typeof v.s === 'number' && typeof v.e === 'number' && Array.isArray(v.d)
}

// Reconstruct the numeric value from the serialised Decimal internals {s, e, d}.
// Decimal.js stores digits in base-10^7 chunks; e is the 0-based exponent of the
// most-significant digit (so e=1 means tens, e=2 means hundreds, etc.)
function convertSerializedDecimal(v) {
  try {
    const sign = v.s < 0 ? -1 : 1
    const digits = v.d.map((chunk, i) =>
      i === 0 ? String(chunk) : String(chunk).padStart(7, '0')
    ).join('')
    const intLen = v.e + 1
    let numStr
    if (intLen >= digits.length) {
      numStr = digits + '0'.repeat(intLen - digits.length)
    } else {
      numStr = digits.slice(0, intLen) + '.' + digits.slice(intLen)
    }
    const n = sign * parseFloat(numStr)
    return isNaN(n) ? 0 : n
  } catch (e) {
    return 0
  }
}

// Walk the Corticon Metrics block in the eval result and replace any serialised
// Decimal.js objects in afterValue / beforeValue with plain numbers.
function sanitizeDecimalsInResult(result) {
  if (!result) return
  const metrics = (result.corticon && result.corticon.Metrics) || result.Metrics
  if (!metrics) return
  const fixRow = (r) => {
    ;['afterValue', 'beforeValue'].forEach(field => {
      if (isSerializedDecimal(r[field])) {
        r[field] = convertSerializedDecimal(r[field])
      }
    })
  }
  ;(metrics.attributeChanges   || []).forEach(fixRow)
  ;(metrics.associationChanges || []).forEach(fixRow)
  ;(metrics.entityChanges      || []).forEach(fixRow)
}

// Extract the first JSON part from a MarkLogic multipart/mixed eval response
function parseFirstMultipartPart(contentTypeHeader, body) {
  const boundaryMatch = contentTypeHeader.match(/boundary=([^\s;,]+)/i)
  if (!boundaryMatch) {
    try { return JSON.parse(body) } catch { return { raw: body } }
  }
  const boundary = '--' + boundaryMatch[1].replace(/"/g, '')
  const parts = body.split(boundary)
  for (const part of parts) {
    if (!part.trim() || part.trim() === '--') continue
    const sep = part.indexOf('\r\n\r\n')
    if (sep === -1) continue
    const partBody = part.substring(sep + 4).replace(/\r\n$/, '').trim()
    if (partBody) {
      try { return JSON.parse(partBody) } catch { return { raw: partBody } }
    }
  }
  return null
}

// ── MarkLogic Log Lines by time window ──────────────────────────────────────
// Fetches ErrorLog lines from the MarkLogic Management REST API (port 8002).
// Uses the app-server-specific log file (e.g. 8004_ErrorLog.txt).
//
// KEY: MarkLogic log entries use LOCAL server time (e.g. "2026-03-06 15:29:45").
// corticon.timestamp is UTC (e.g. "2026-03-06T14:29:45Z").
// The Management API's start/end parameters filter against LOCAL timestamps,
// so passing UTC values produces a timezone-shifted mismatch.
//
// Solution: build a `regex` from Node.js LOCAL time values, which match the log
// format exactly (Node.js and MarkLogic run on the same host → same timezone).
// This completely avoids the UTC/local ambiguity.

app.get('/ml-logs', async (req, res) => {
  const { around, durationMs: durationParam } = req.query
  if (!around) return res.status(400).json({ error: '"around" timestamp is required', lines: [] })

  const aroundMs = Date.parse(around)
  if (isNaN(aroundMs)) return res.status(400).json({ error: 'Invalid "around" timestamp', lines: [] })

  // "around" is corticon.timestamp = ML server-side execution END time (UTC).
  // Window: from (end - duration - 2s buffer) to (end + 1s buffer).
  const durationMs = Math.max(parseInt(durationParam) || 0, 0)
  const startMs = aroundMs - durationMs - 2000
  const endMs   = aroundMs + 1000

  // MarkLogic log entries use LOCAL server time (e.g. "2026-04-09 14:39:59.781").
  // The Manage API start/end params are interpreted as local time too — sending UTC
  // ISO strings with a \"Z\" suffix causes a timezone mismatch and returns 0 entries.
  // Build plain local-time strings (no timezone designator) to match ML's expectation.
  const padN = n => String(n).padStart(2, '0')
  const toLocalDT = d =>
    `${d.getFullYear()}-${padN(d.getMonth()+1)}-${padN(d.getDate())}T` +
    `${padN(d.getHours())}:${padN(d.getMinutes())}:${padN(d.getSeconds())}`
  const startLocal = toLocalDT(new Date(startMs))
  const endLocal   = toLocalDT(new Date(endMs))
  // Labels for the dialog header (same local-time strings, used for display)
  const startLabel = startLocal.replace('T', ' ')
  const endLabel   = endLocal.replace('T', ' ')
  const logFilename = `${ML_PORT}_ErrorLog.txt`

  try {
    const logsUrl = `http://${ML_HOST}:${ML_MANAGE_PORT}/manage/v2/logs` +
      `?filename=${encodeURIComponent(logFilename)}&format=json` +
      `&start=${encodeURIComponent(startLocal)}&end=${encodeURIComponent(endLocal)}`
    const mlResponse = await client.fetch(logsUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
    const responseText = await mlResponse.text()

    if (!mlResponse.ok) {
      return res.status(mlResponse.status).json({
        error: `MarkLogic Management API failed (HTTP ${mlResponse.status}). ` +
          `Ensure port ${ML_MANAGE_PORT} is reachable and the user has the manage-user role.`,
        lines: []
      })
    }

    let lines = []
    try {
      const data = JSON.parse(responseText)
      // ML Management API v2 JSON format: { logfile: { log: [ {timestamp, level, message} ] } }
      const entries = data?.logfile?.log
      if (Array.isArray(entries) && entries.length > 0) {
        lines = entries.map(e => `${e.timestamp || ''} ${e.level || 'info'}: ${e.message || ''}`)
      } else if (typeof entries === 'string') {
        lines = [entries]
      }
    } catch {
      lines = responseText.split('\n').filter(l => l.trim())
    }

    console.log(`[ml-logs] ${logFilename} ${startLabel}→${endLabel} => ${lines.length} line(s)`)
    res.json({ start: startLabel, end: endLabel, logFilename, lines })
  } catch (err) {
    console.error('[ml-logs]', err)
    res.status(500).json({ error: err.message, lines: [] })
  }
})

// Health endpoint
app.get('/health', (req, res) => res.json({ ok: true }))

// ── Remove product triggers from MarkLogic ────────────────────────────────────
// Deletes the two productsTrigger documents (create + modify) from the
// MarkLogic triggers database via the Management API (port 8002).
const ML_TRIGGERS_DATABASE = process.env.ML_TRIGGERS_DATABASE || 'corticonml-triggers'
const PRODUCT_TRIGGER_NAMES = ['productsTrigger-create', 'productsTrigger-modify']

app.delete('/product-triggers', async (req, res) => {
  const results = []
  for (const name of PRODUCT_TRIGGER_NAMES) {
    const url = `http://${ML_HOST}:${ML_MANAGE_PORT}/manage/v2/databases/${encodeURIComponent(ML_TRIGGERS_DATABASE)}/triggers/${encodeURIComponent(name)}`
    try {
      const r = await client.fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } })
      const body = await r.text()
      if (r.status === 204 || r.status === 200) {
        results.push({ name, status: 'deleted' })
      } else if (r.status === 404) {
        results.push({ name, status: 'not_found' })
      } else {
        results.push({ name, status: 'error', detail: body.substring(0, 300) })
      }
    } catch (err) {
      results.push({ name, status: 'error', detail: err.message })
    }
  }
  const allOk = results.every(r => r.status === 'deleted' || r.status === 'not_found')
  res.status(allOk ? 200 : 500).json({ results })
})

// ── Product Input History endpoints ──────────────────────────────────────────
const HISTORY_FILE = path.resolve(__dirname, '../history/productInput.json')

app.get('/product-history', async (req, res) => {
  try {
    const raw = await readFile(HISTORY_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    // Always return an array — guard against single-object files (e.g. written by PowerShell)
    res.json(Array.isArray(parsed) ? parsed : [parsed])
  } catch (err) {
    if (err.code === 'ENOENT') return res.json([])
    res.status(500).json({ error: err.message })
  }
})

app.post('/product-history', async (req, res) => {
  try {
    const entry = req.body  // { label, form, timestamp }
    let history = []
    try {
      const raw = await readFile(HISTORY_FILE, 'utf8')
      history = JSON.parse(raw)
    } catch { /* file may not exist yet */ }
    // Remove any existing entry with identical form data, then prepend new one; cap at 50
    const formKey = (e) => JSON.stringify(Object.keys(e.form).sort().reduce((a, k) => { a[k] = e.form[k]; return a }, {}))
    const newKey = formKey(entry)
    history = [entry, ...history.filter(e => formKey(e) !== newKey)].slice(0, 50)
    await mkdir(path.dirname(HISTORY_FILE), { recursive: true })
    await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Vocabulary Manifest Generation ───────────────────────────────────────────
// Runs the Corticon.js vocabulary report utility, parses the output XML, and
// returns a compact JSON manifest for client-side query validation.
// POST body: { ruleProjectDir, corticonJsWorkLocation }

/** Walk a directory tree (max depth 3) to find the first *.ecore file. */
async function findEcoreFile(dir, depth = 0) {
  if (depth > 3) return null
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return null }
  for (const entry of entries) {
    if (!entry.isDirectory() && entry.name.endsWith('.ecore')) return path.join(dir, entry.name)
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const found = await findEcoreFile(path.join(dir, entry.name), depth + 1)
      if (found) return found
    }
  }
  return null
}

/** Parse a Corticon Basic Vocabulary XML report into a compact JSON manifest. */
function parseVocabularyXml(xmlString) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['Entity', 'Attribute', 'AssociationRole'].includes(name)
  })
  const root = parser.parse(xmlString)
  const vocabNode = root?.Vocabulary
  if (!vocabNode) throw new Error('[parseVocabularyXml] No <Vocabulary> root element found in XML')
  const manifest = { entities: {}, entityIndex: {} }
  const entities = Array.isArray(vocabNode.Entity) ? vocabNode.Entity
    : (vocabNode.Entity ? [vocabNode.Entity] : [])
  for (const entity of entities) {
    const id = entity['@_id'] ||
      (typeof entity.name === 'string' ? entity.name : entity.name?.['#text']) || ''
    if (!id) continue
    const bareName = id.split('.').pop()
    const attrList = Array.isArray(entity.Attribute) ? entity.Attribute
      : (entity.Attribute ? [entity.Attribute] : [])
    const attributes = attrList
      .map(a => (typeof a.name === 'string' ? a.name : a.name?.['#text'] || ''))
      .filter(Boolean)
    const roleList = Array.isArray(entity.AssociationRole) ? entity.AssociationRole
      : (entity.AssociationRole ? [entity.AssociationRole] : [])
    const roles = {}
    for (const role of roleList) {
      const rName = typeof role.name === 'string' ? role.name : role.name?.['#text'] || ''
      const target = typeof role.targetEntity === 'string' ? role.targetEntity
        : role.targetEntity?.['#text'] || ''
      const card = typeof role.cardinalities === 'string' ? role.cardinalities
        : role.cardinalities?.['#text'] || ''
      if (rName && target) roles[rName] = { target, cardinality: card }
    }
    manifest.entities[id] = { qualifiedName: id, attributes, roles }
    manifest.entityIndex[bareName.toLowerCase()] = id
    manifest.entityIndex[id.toLowerCase()] = id
  }
  return manifest
}

app.post('/generate-vocabulary-report', async (req, res) => {
  const { ruleProjectDir, corticonJsWorkLocation } = req.body
  if (!ruleProjectDir)
    return res.status(400).json({ error: '[generate-vocabulary-report] ruleProjectDir is required' })
  if (!corticonJsWorkLocation)
    return res.status(400).json({ error: '[generate-vocabulary-report] corticonJsWorkLocation is required' })

  let tempDir = null
  try {
    console.log(`[generate-vocabulary-report] ruleProjectDir=${ruleProjectDir}`)
    console.log(`[generate-vocabulary-report] corticonJsWorkLocation=${corticonJsWorkLocation}`)

    // 1. Find the .ecore vocabulary file
    const ecoreFilePath = await findEcoreFile(ruleProjectDir)
    if (!ecoreFilePath)
      return res.status(404).json({
        error: `No .ecore file found under "${ruleProjectDir}". Ensure Rule Project Directory is correct.`
      })
    console.log(`[generate-vocabulary-report] .ecore found: ${ecoreFilePath}`)

    // 2. Resolve utility paths
    // corticonJsWorkLocation e.g. C:\Progress\Corticon.js_Work_2.4
    // → corticonHome = C:\Progress\Corticon.js 2.4  (reverse the _Work_ → space convention)
    const workBase = path.basename(corticonJsWorkLocation)          // Corticon.js_Work_2.4
    const version  = workBase.replace(/^Corticon\.js_Work_/i, '')    // 2.4
    const corticonHome = path.join(path.dirname(corticonJsWorkLocation), `Corticon.js ${version}`)

    // Resolve java executable — check candidate paths in priority order:
    //   1. <corticonHome>/jre/bin/java[.exe]          (older Corticon.js installs with bundled JRE)
    //   2. <corticonHome>/Javascript Studio/JRE/bin/java[.exe]  (Corticon.js 2.4+)
    //   3. JAVA_HOME env var                         (system-wide override)
    //   4. plain 'java' on PATH                      (last resort)
    const { access } = await import('fs/promises')
    const javaExeSuffix = isWin ? 'java.exe' : 'java'
    const jreCandidates = [
      path.join(corticonHome, 'jre', 'bin', javaExeSuffix),
      path.join(corticonHome, 'Javascript Studio', 'JRE', 'bin', javaExeSuffix),
      ...(process.env.JAVA_HOME ? [path.join(process.env.JAVA_HOME, 'bin', javaExeSuffix)] : []),
    ]
    let javaExe = 'java'
    for (const candidate of jreCandidates) {
      if (await access(candidate).then(() => true).catch(() => false)) {
        javaExe = candidate
        break
      }
    }
    console.log(`[generate-vocabulary-report] Using java: ${javaExe}`)

    const libDir   = path.join(corticonHome, 'Javascript Utilities', 'lib')
    const classpath = ['CcJSUtilities.jar', 'CcDeploy.jar', 'Corticon_Foundation_API.jar', 'Corticon_Foundation_I18n.jar']
      .map(j => path.join(libDir, j)).join(path.delimiter)
    const licenseJar = path.join(corticonJsWorkLocation, 'license', 'JSStudio', 'CcLicense.jar')
    const xsltFile   = path.join(corticonJsWorkLocation, 'Reports', 'XSLT', 'Vocabulary', 'Basic Vocabulary.xslt')
    const cssFile    = path.join(corticonJsWorkLocation, 'Reports', 'CSS', 'Corticon Blue.css')

    console.log(`[generate-vocabulary-report] corticonHome=${corticonHome}`)
    console.log(`[generate-vocabulary-report] javaExe=${javaExe}`)
    console.log(`[generate-vocabulary-report] xsltFile=${xsltFile}`)

    // 3. Create temp directory
    tempDir = await mkdtemp(path.join(tmpdir(), 'corticon-vocab-'))
    console.log(`[generate-vocabulary-report] tempDir=${tempDir}`)

    // 4. Spawn the Corticon.js report utility  (-r = report, not -c = compile)
    const javaArgs = [
      '-cp', classpath,
      `-DCORTICON_SETTING=UTL`,
      `-DCORTICON_HOME=${corticonHome}`,
      `-DCORTICON_WORK_DIR=${corticonJsWorkLocation}`,
      `-DCORTICON_LICENSE=${licenseJar}`,
      'com.corticon.management.CorticonJS',
      '-r',
      '-i', ecoreFilePath,
      '-o', tempDir,
      '-x', xsltFile,
      '-c', cssFile,
    ]
    console.log(`[generate-vocabulary-report] Spawning: java ${javaArgs.join(' ')}`)

    // Build env: don't override JAVA_HOME with a non-existent path
    const env = { ...process.env }
    if (javaExe !== 'java') {
      const jreDir = path.dirname(path.dirname(javaExe)) // …/jre or …/jdk-x
      env.JAVA_HOME = jreDir
      env.PATH = path.dirname(javaExe) + path.delimiter + (process.env.PATH || '')
    }

    const stderrLines = []
    await new Promise((resolve, reject) => {
      const child = spawn(javaExe, javaArgs, { env })
      child.stdout.on('data', d => d.toString().split(/\r?\n/).filter(l => l.trim()).forEach(l =>
        console.log(`[VocabJava stdout] ${l}`)))
      child.stderr.on('data', d => d.toString().split(/\r?\n/).filter(l => l.trim()).forEach(l => {
        stderrLines.push(l); console.log(`[VocabJava stderr] ${l}`)
      }))
      child.on('close', code =>
        code === 0 ? resolve()
          : reject(new Error(`Vocabulary report utility exited with code ${code}.${stderrLines.length ? ' stderr: ' + stderrLines.join(' | ') : ''}`)))
      child.on('error', err => reject(new Error(`Failed to launch java at "${javaExe}": ${err.message}. Is Corticon.js properly installed?`)))
    })

    // 5. Find the XML output file
    const tempEntries = await readdir(tempDir)
    const xmlFile = tempEntries.find(f => f.endsWith('.xml') && f.startsWith('Vocabulary_'))
    if (!xmlFile)
      throw new Error(`Vocabulary report utility ran but produced no XML output. Files found: [${tempEntries.join(', ')}]`)
    const xmlPath = path.join(tempDir, xmlFile)
    console.log(`[generate-vocabulary-report] XML output: ${xmlPath}`)

    // 6. Parse XML → JSON manifest
    const xmlString = await readFile(xmlPath, 'utf8')
    const manifest = parseVocabularyXml(xmlString)
    const entityCount = Object.keys(manifest.entities).length
    if (entityCount === 0)
      throw new Error('Vocabulary manifest is empty — no entities found in XML. Check the .ecore file.')
    console.log(`[generate-vocabulary-report] Parsed ${entityCount} entities`)

    // 7. .ecore file mtime and paths
    const eCoreStat = await stat(ecoreFilePath)
    const vocabEcoreRelPath = path.relative(ruleProjectDir, ecoreFilePath).replace(/\\/g, '/')
    const vocabName = path.basename(ecoreFilePath)

    res.json({ manifest, vocabName, vocabEcoreRelPath, ecoreLastModified: eCoreStat.mtime.toISOString() })
  } catch (err) {
    console.error('[generate-vocabulary-report] ERROR:', err.message)
    res.status(500).json({ error: err.message })
  } finally {
    // 8. Clean up temp dir (always, even on error)
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true })
        console.log(`[generate-vocabulary-report] Cleaned up tempDir ${tempDir}`)
      } catch (cleanErr) {
        console.warn(`[generate-vocabulary-report] Could not clean up tempDir ${tempDir}: ${cleanErr.message}`)
      }
    }
  }
})

app.listen(MIDDLE_TIER_PORT, () => {
  console.log(`Proxy running at http://localhost:${MIDDLE_TIER_PORT} -> ${ML_HOST}:${ML_PORT}`)
})
