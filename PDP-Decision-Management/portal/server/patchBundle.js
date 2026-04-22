/**
 * patchBundle.js
 *
 * Post-compilation fix for a Corticon.js generator bug (v2.4.x):
 *
 * The generator occasionally emits a branch container CALL SITE using:
 *   this.addBranchContainer_js_<name>(n, t)
 * while the METHOD DEFINITION uses:
 *   addBranchContainerWrapper_js_<name><timestamp>(e, t)
 *
 * These names do not match, so the bundle throws immediately:
 *   TypeError: this.addBranchContainer_js_<name> is not a function
 *
 * This module scans a compiled decisionServiceBundle.js for all such mismatches
 * and rewrites the call sites to use the correct definition names.
 * It is idempotent — if the bundle is already correct, it is not modified.
 *
 * Usage (standalone):
 *   node patchBundle.js <path/to/decisionServiceBundle.js>
 *
 * Usage (programmatic):
 *   import { patchBundleFile } from './patchBundle.js'
 *   const report = await patchBundleFile('/absolute/path/to/decisionServiceBundle.js')
 *   // report: { patched: boolean, fixes: Array<{ broken, correct }> }
 */

import { readFile, writeFile } from 'fs/promises'

/**
 * Scan `source` (string) for mismatched branch container call sites and
 * return a list of { broken, correct } replacement pairs.
 *
 * The bug pattern:
 *   CALL SITE  : this.addBranchContainer_js_<name>(
 *   DEFINITION : addBranchContainerWrapper_js_<name><digits>(e,t){
 *
 * A call site is "broken" when there is no corresponding method definition
 * with the exact same short name (no Wrapper, no timestamp).
 */
export function findBrokenCallSites(source) {
  // Collect all call sites of the form:  this.addBranchContainer_js_<name>(
  // — but NOT addBranchContainerWrapper_js_... (those are the correct definitions)
  const callSiteRe = /this\.(addBranchContainer_js_[A-Za-z0-9_]+)\(/g
  const wrapperDefRe = /\b(addBranchContainerWrapper_js_([A-Za-z0-9_]+?)(\d+))\s*\(/g

  // Build a map:  shortName → correct full wrapper name
  // e.g.  "Calculate32operations32data32and32operation32details" → "addBranchContainerWrapper_js_Calculate32...1774536575644"
  const wrapperMap = new Map()
  for (const m of source.matchAll(wrapperDefRe)) {
    const [, fullName, shortName] = m
    // Only record if it looks like a method definition (followed by (e,t) or similar)
    if (!wrapperMap.has(shortName)) {
      wrapperMap.set(shortName, fullName)
    }
  }

  const fixes = []
  const seen = new Set()

  for (const m of source.matchAll(callSiteRe)) {
    const brokenMethod = m[1]                        // addBranchContainer_js_<name>
    const shortName = brokenMethod.replace(/^addBranchContainer_js_/, '')

    // Only broken if there is NO definition with this exact name
    const definitionExists = source.includes(`${brokenMethod}(e,t)`) ||
                             source.includes(`${brokenMethod}(e, t)`)
    if (definitionExists) continue

    // Look for a corresponding Wrapper definition
    const correctFullName = wrapperMap.get(shortName)
    if (!correctFullName) continue

    const key = brokenMethod
    if (seen.has(key)) continue
    seen.add(key)

    fixes.push({
      broken:  `this.${brokenMethod}(`,
      correct: `this.${correctFullName}(`
    })
  }

  return fixes
}

/**
 * Apply fixes to `source` string and return the patched string.
 */
export function applyFixes(source, fixes) {
  let result = source
  for (const { broken, correct } of fixes) {
    result = result.split(broken).join(correct)
  }
  return result
}

/**
 * Read a bundle file, detect and fix all broken call sites, write back if needed.
 * Returns a report object: { patched: boolean, fixes: Array<{ broken, correct }> }
 */
export async function patchBundleFile(bundlePath) {
  const source = await readFile(bundlePath, 'utf8')
  const fixes = findBrokenCallSites(source)

  if (fixes.length === 0) {
    return { patched: false, fixes: [] }
  }

  const patched = applyFixes(source, fixes)
  await writeFile(bundlePath, patched, 'utf8')
  return { patched: true, fixes }
}

// ── CLI usage ──────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('patchBundle.js')) {
  const bundlePath = process.argv[2]
  if (!bundlePath) {
    console.error('Usage: node patchBundle.js <path/to/decisionServiceBundle.js>')
    process.exit(1)
  }
  patchBundleFile(bundlePath).then(({ patched, fixes }) => {
    if (!patched) {
      console.log('[patchBundle] Bundle is clean — no fixes needed.')
    } else {
      console.log(`[patchBundle] Applied ${fixes.length} fix(es):`)
      for (const { broken, correct } of fixes) {
        console.log(`  BROKEN : ${broken}`)
        console.log(`  CORRECT: ${correct}`)
      }
    }
  }).catch(err => {
    console.error('[patchBundle] Error:', err.message)
    process.exit(1)
  })
}
