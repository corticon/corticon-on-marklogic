/*
 * Copyright (c) 2024 MarkLogic
 * Apache 2.0
 */

'use strict';

const express = require('express');
const http = require('http');
const cors = require('cors');
const fetch = require("node-fetch");
const { AbortController } = require("abort-controller");
// Load environment variables if a .env file is present
try { require('dotenv').config(); } catch {}

// Constants
const PORT = 4001;
const HOST = '0.0.0.0';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: 'application/sql' }));

app.use(
  cors({
    exposedHeaders: ['X-Analytics-Duration', 'X-Cache', 'X-Analytics-Source'],
  })
);

const mlHost = process.env.ML_HOST || 'localhost';
const mlRestPort = process.env.ML_REST_PORT || 8004;
// Default to admin/password unless overridden by env vars
const mlUser = process.env.ML_USER || 'admin';
const mlPass = process.env.ML_PASS || 'password';

app.get("/api/analytics", async (req, res) => {
  const { type, householdId } = req.query;

  // NOTE: In MarkLogic SQL, it's safer to compare booleans explicitly like `col = true`
  // or use them in CASE statements without relying on implicit casting in all contexts.
  const queries = {
    // Matches the working TDE: avoid = true/false; use NOT for booleans
    programEligibilityStats: `
      SELECT
          coa.name AS Program_Name,
          COUNT(DISTINCT i.ssn) AS Total_Evaluated,
          SUM(CASE WHEN NOT coa.incomeTestPassed THEN 1 ELSE 0 END) AS Failed_Income_Test,
          SUM(CASE WHEN NOT coa.resourceTestPassed THEN 1 ELSE 0 END) AS Failed_Resource_Test
      FROM household.classOfAssistance AS coa
      JOIN household.individual AS i ON coa.individual_ssn = i.ssn AND coa.householdId = i.householdId
      GROUP BY coa.name
      ORDER BY Total_Evaluated DESC
    `,
    // Near-miss income analysis (use correct column names + NOT boolean)
    nearMissIncomeStats: `
      SELECT
          h.householdId AS householdId,
          h.familySize   AS familySize,
          h.householdPercentFPL AS householdPercentFPL,
          coa.name       AS Program_Denied_Income,
          h.monthlyIncome AS monthlyIncome
      FROM household.household AS h
      JOIN household.classOfAssistance AS coa ON h.householdId = coa.householdId
      WHERE NOT coa.incomeTestPassed
        AND h.householdPercentFPL BETWEEN 0.80 AND 3.00
      ORDER BY h.householdPercentFPL ASC
      LIMIT 50
    `,
    // Global rule firing frequency from attributeChanges
    ruleFiringStats: `
      SELECT
          ac.rulesheetName AS rulesheetName,
          ac.entityName    AS entityName,
          ac.attributeName AS attributeName,
          COUNT(*) AS Firing_Count
      FROM household.attributeChanges AS ac
      GROUP BY ac.rulesheetName, ac.entityName, ac.attributeName
      ORDER BY Firing_Count DESC
      LIMIT 50
    `,
    // Demographic trends with GROUP BY via subquery; do not rely on alias in GROUP BY
    demographicTrends: `
      SELECT
          Demographic_Group,
          Program,
          COUNT(DISTINCT ssn) AS Enrollment_Count
      FROM (
          SELECT
              i.ssn,
              coa.name AS Program,
              CASE
                  WHEN i.age >= 65 THEN 'Senior (65+)'
                  WHEN i.isPregnant THEN 'Pregnant'
                  WHEN i.isBlind OR i.isDisabled THEN 'Disabled/Blind'
                  ELSE 'Other Adult/Child'
              END AS Demographic_Group
          FROM household.individual AS i
          JOIN household.classOfAssistance AS coa ON i.ssn = coa.individual_ssn AND i.householdId = coa.householdId
      ) AS subquery
      GROUP BY Demographic_Group, Program
      ORDER BY Demographic_Group, Enrollment_Count DESC
    `,
    // Rules firing most frequently for households near FPL (100%-138%)
    ruleFiringNearFPL: `
      SELECT
          ac.rulesheetName AS rulesheetName,
          ac.ruleNumber    AS ruleNumber,
          COUNT(*) AS Firing_Count
      FROM household.attributeChanges AS ac
      JOIN household.household AS h ON ac.householdId = h.householdId
      WHERE h.householdPercentFPL BETWEEN 1.00 AND 1.38
      GROUP BY ac.rulesheetName, ac.ruleNumber
      ORDER BY Firing_Count DESC
      LIMIT 50
    `,
    // Near-miss relative to each program's income threshold (returns many rows)
    nearMissByThreshold: `
      SELECT
        h.householdId      AS householdId,
        h.familySize       AS familySize,
        h.annualIncome     AS annualIncome,
        coa.name           AS Program,
        coa.incomeThreshold AS incomeThreshold,
        (h.annualIncome / coa.incomeThreshold) AS incomeToThreshold
      FROM household.household AS h
      JOIN household.classOfAssistance AS coa ON h.householdId = coa.householdId
      WHERE coa.incomeThreshold IS NOT NULL
        AND h.annualIncome IS NOT NULL
        AND (h.annualIncome / coa.incomeThreshold) BETWEEN 1.00 AND 1.05
      ORDER BY incomeToThreshold ASC
      LIMIT 100
    `,
    // Pathways: financial pass candidates for Pathways program
    pathwaysFinancialPass: `
      SELECT
        i.ssn   AS ssn,
        i.first AS first,
        i.last  AS last,
        i.age   AS age,
        coa.name AS Program
      FROM household.individual AS i
      JOIN household.classOfAssistance AS coa
        ON i.ssn = coa.individual_ssn AND i.householdId = coa.householdId
      WHERE coa.name LIKE '%Pathways%'
        AND coa.incomeTestPassed
        AND (coa.resourceTestPassed OR coa.resourceTestPassed IS NULL)
      LIMIT 100
    `,
    // Pathways: under-hours (<80) among financial-pass candidates
    pathwaysUnderHours: `
      SELECT
        i.ssn   AS ssn,
        i.first AS first,
        i.last  AS last,
        SUM(qa.hrsPerMonth) AS totalHrs
      FROM household.individual AS i
      JOIN household.qualifyingActivity AS qa
        ON i.ssn = qa.individual_ssn AND i.householdId = qa.householdId
      JOIN household.classOfAssistance AS coa
        ON i.ssn = coa.individual_ssn AND i.householdId = coa.householdId
      WHERE coa.name LIKE '%Pathways%'
        AND coa.incomeTestPassed
        AND (coa.resourceTestPassed OR coa.resourceTestPassed IS NULL)
      GROUP BY i.ssn, i.first, i.last
      HAVING SUM(qa.hrsPerMonth) < 80
      ORDER BY totalHrs ASC
      LIMIT 100
    `,
    // Adults 19–64 not enrolled in Pathways
    pathwaysNotEnrolledAdults: `
      SELECT i.ssn AS ssn, i.first AS first, i.last AS last, i.age AS age
      FROM household.individual AS i
      WHERE (i.enrolledInPathwaysProgram = 0 OR NOT i.enrolledInPathwaysProgram)
        AND i.age BETWEEN 19 AND 64
      LIMIT 100
    `,
    // Churn risk: FPL volatility
    churnRisk: `
      SELECT
        ac.householdId AS householdId,
        COUNT(*) AS FPL_Change_Events
      FROM household.attributeChanges AS ac
      WHERE ac.attributeName = 'householdPercentFPL'
      GROUP BY ac.householdId
      HAVING COUNT(*) >= 1
      ORDER BY FPL_Change_Events DESC
      LIMIT 50
    `,
    // Least-fired rules across the corpus
    leastFiredRules: `
      SELECT
        ac.rulesheetName AS rulesheetName,
        ac.ruleNumber    AS ruleNumber,
        COUNT(*) AS Firing_Count
      FROM household.attributeChanges AS ac
      GROUP BY ac.rulesheetName, ac.ruleNumber
      ORDER BY Firing_Count ASC
      LIMIT 50
    `,
    // Procedural denial root causes (non-financial flags)
    proceduralRootCauses: `
      SELECT
        ac.attributeName AS attributeName,
        COUNT(*) AS Firing_Count
      FROM household.attributeChanges AS ac
      WHERE ac.attributeName IN ('isResidentGA','hasValidSSN','isCitizenOrQualifiedResident')
      GROUP BY ac.attributeName
      ORDER BY Firing_Count DESC
    `,
    // ABD savings penalty proxy: income pass + resource fail among seniors/disabled/blind
    abdSavingsPenalty: `
      SELECT
        i.ssn AS ssn, i.first AS first, i.last AS last, i.age AS age,
        coa.name AS Program, coa.resourceThreshold AS resourceThreshold
      FROM household.individual AS i
      JOIN household.classOfAssistance AS coa
        ON i.ssn = coa.individual_ssn AND i.householdId = coa.householdId
      WHERE (i.age >= 65 OR i.isBlind OR i.isDisabled)
        AND coa.incomeTestPassed
        AND (coa.resourceTestPassed IS FALSE OR coa.resourceTestPassed IS NULL)
      LIMIT 100
    `,
    // Maternal continuity candidates (loosened to return more data)
    maternalContinuityCandidates: `
      SELECT
        i.ssn, i.first, i.last, i.age,
        coa.name AS Program, coa.incomeTestPassed, coa.resourceTestPassed
      FROM household.individual AS i
      JOIN household.classOfAssistance AS coa
        ON i.ssn = coa.individual_ssn AND i.householdId = coa.householdId
      WHERE (NOT i.isPregnant) AND i.pregnantWithinLast12Months
      ORDER BY i.last, i.first
      LIMIT 100
    `
  };

  if (type === 'ruleLineage') {
    const hh = req.query.householdId;
    if (!hh) return res.status(400).json({ error: 'householdId required' });
    // Ensure householdId is treated safely, likely a string in your TDE
    queries.ruleLineage = `
      SELECT rulesheetName, ruleNumber, entityName, attributeName, afterValue, sequence
      FROM household.attributeChanges
      WHERE householdId = '${hh}'
      ORDER BY sequence
    `;
  }

  // Optional: decision path by SSN combining notes and rule firings; return a unified timeline
  if (type === 'decisionPathBySSN') {
    const ssn = req.query.ssn;
    if (!ssn) return res.status(400).json({ error: 'ssn required' });
    // Use UNION ALL on three aligned columns; do not add ORDER BY here
    queries.decisionPathBySSN = `
      SELECT 'Note' AS Type, 0 AS Sequence, text AS Details
      FROM household.eligibilityNote
      WHERE individual_ssn = '${ssn}'
      UNION ALL
      SELECT 'Rule Firing' AS Type, sequence AS Sequence,
             'Rule ' || ruleNumber || ' in ' || rulesheetName || ' changed ' || entityName || '.' || attributeName || ' to ' || afterValue AS Details
      FROM household.attributeChanges
      WHERE householdId = (
        SELECT householdId FROM household.individual WHERE ssn = '${ssn}' LIMIT 1
      )
    `;
  }

  let sql = queries[type];
  if (!sql) return res.status(400).json({ error: `Invalid analytics type: ${type}` });

  try {
    const startedAt = Date.now();
    console.log(`🔍 Executing SQL for [${type}]...`);
    // Helpful for debugging: show a short SQL preview and the target host/port
    const preview = (queries[type] || '').toString().replace(/\s+/g, ' ').trim().slice(0, 220);
    console.log(`ℹ️ ML target ${mlHost}:${mlRestPort} | SQL preview: ${preview}${queries[type] && queries[type].length > 220 ? ' …' : ''}`);
    if (type === 'nearMissIncomeStats') {
      const oneLine = (queries[type] || '').toString().replace(/\s+/g, ' ').trim();
      console.log(`🧪 Full SQL [nearMissIncomeStats]: ${oneLine}`);
    }
    const url = `http://${mlHost}:${mlRestPort}/v1/rows?format=json`;
    // Use a slightly longer timeout for analytical queries
    const controller = new AbortController();
    // Shorter timeout for faster feedback/logging on search
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/sql",
        "Accept": "application/json; charset=utf-8",
        Authorization: "Basic " + Buffer.from(`${mlUser}:${mlPass}`).toString("base64"),
      },
      body: sql,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const raw = await response.text();
    const durationMs = Date.now() - startedAt;
    const ct = response.headers.get('content-type');
    const cl = response.headers.get('content-length');
    console.log(`↩️ ML responded for [${type}] status=${response.status} ct=${ct || 'n/a'} len=${cl || (raw ? raw.length : 0)} dur=${durationMs}ms`);
    if (!response.ok) {
      console.error(`❌ MarkLogic error for ${type}: ${response.status} - ${raw.substring(0, 500)}`);
      return res.status(response.status).json({ error: raw });
    }

    try {
      const json = raw ? JSON.parse(raw) : { rows: [] };
      const normalizedRows = normalizeMarkLogicRows(json);
      const sampleKeys = normalizedRows.length ? Object.keys(normalizedRows[0]).join(', ') : '';
      console.log(`✅ ${type} query OK. Rows returned: ${normalizedRows.length}${sampleKeys ? ` | keys: ${sampleKeys}` : ''}`);
      return res.json({ rows: normalizedRows });
    } catch (e) {
      console.error(`❌ Invalid JSON from MarkLogic for ${type}: ${e.message}. Raw length=${raw ? raw.length : 0}. First 400 chars: ${raw.substring(0, 400)}`);
      return res.status(502).json({ error: 'Invalid JSON from MarkLogic', detail: e.message, snippet: raw.substring(0, 400) });
    }
  } catch (err) {
    console.error(`❌ Analytics error [${type}]:`, err);
    // Handle abort/timeout specifically if needed, otherwise generic 500
    res.status(500).json({ error: err.message });
  }
});

// Normalize MarkLogic /v1/rows JSON into a list of plain JS objects
function normalizeMarkLogicRows(json) {
  if (!json || !json.rows) return [];

  const unwrap = (v) => {
    if (v == null) return v;
    if (Array.isArray(v)) return v.map(unwrap);
    if (typeof v === 'object') {
      if (Object.prototype.hasOwnProperty.call(v, 'value')) return unwrap(v.value);
      return v; // already plain object
    }
    return v;
  };

  const cols = Array.isArray(json.columns)
    ? json.columns.map((c) => c.name || c.columnName || c.column || c)
    : null;

  return json.rows.map((r) => {
    // Case: Optic-style { row: [ {name, value, type}, ... ] }
    if (r && typeof r === 'object' && Array.isArray(r.row)) {
      const obj = {};
      for (const cell of r.row) {
        const name = cell.name || cell.columnName || cell.column;
        if (name) obj[name] = unwrap(cell.value !== undefined ? cell.value : cell);
      }
      return obj;
    }
    // Case: rows are arrays with parallel columns metadata
    if (Array.isArray(r)) {
      const obj = {};
      if (cols && cols.length) {
        for (let i = 0; i < cols.length; i++) obj[cols[i]] = unwrap(r[i]);
      } else {
        r.forEach((cell, i) => (obj[`col${i}`] = unwrap(cell)));
      }
      return obj;
    }
    // Case: rows are objects keyed by column names with typed values
    if (r && typeof r === 'object') {
      const obj = {};
      for (const [k, v] of Object.entries(r)) obj[k] = unwrap(v);
      return obj;
    }
    // Fallback
    return { value: unwrap(r) };
  });
}

// Fetch full document content for a handful of hits and embed in results
async function enrichSearchResultsWithContent(raw) {
  if (!raw || !Array.isArray(raw.results) || raw.results.length === 0) return raw || {};
  const maxDocs = 8; // keep it snappy for demos
  const targets = raw.results.slice(0, maxDocs).map((r, i) => ({ idx: i, uri: r?.uri, res: r }));

  const getDoc = async (uri) => {
    if (!uri) return null;
    const url = `http://${mlHost}:${mlRestPort}/v1/documents?uri=${encodeURIComponent(uri)}`;
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${mlUser}:${mlPass}`).toString('base64'),
      },
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.warn(`   ✖ doc fetch ${uri} -> ${r.status}: ${t.slice(0,200)}`);
      return null;
    }
    try {
      return await r.json();
    } catch (e) {
      const t = await r.text().catch(() => '');
      console.warn(`   ✖ doc parse ${uri}: ${e?.message || e}. First 200: ${t.slice(0,200)}`);
      return null;
    }
  };

  // Simple concurrency limit
  const pool = 4;
  let idx = 0;
  const runners = new Array(Math.min(pool, targets.length)).fill(0).map(async () => {
    while (idx < targets.length) {
      const current = idx++;
      const { uri, res } = targets[current];
      if (!uri) continue;
      try {
        const doc = await getDoc(uri);
        if (doc) res.content = [doc]; // align with UI expectation: r.content[0]
      } catch {}
    }
  });
  await Promise.all(runners);
  return raw;
}

// --- Generic Proxy ---
// Direct proxy to MarkLogic for /v1/* paths
app.all(/\/v1\/.*/, (req, res) => {
  const options = {
    hostname: mlHost,
    port: mlRestPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${mlHost}:${mlRestPort}`,
      Authorization: 'Basic ' + Buffer.from(`${mlUser}:${mlPass}`).toString('base64'),
    },
  };
  const mlReq = http.request(options, (mlRes) => {
    res.statusCode = mlRes.statusCode;
    Object.keys(mlRes.headers).forEach((key) => res.setHeader(key, mlRes.headers[key]));
    mlRes.pipe(res);
  });
  mlReq.on('error', (e) => {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  });
  req.pipe(mlReq);
});

// Smart proxy for ML Search via /api/v1/search to avoid dependency on named options
app.all(/\/api\/v1\/search.*/, async (req, res) => {
  try {
    const incoming = new URL(`http://placeholder${req.url}`);
    const mlUrl = new URL(`http://${mlHost}:${mlRestPort}/v1/search`);
    incoming.searchParams.forEach((value, key) => {
      // We control options downstream; ignore any incoming value to avoid 500s
      if (key.toLowerCase() === 'options') return;
      mlUrl.searchParams.append(key, value);
    });
    if (!mlUrl.searchParams.has('format')) mlUrl.searchParams.set('format', 'json');

    // Log request metadata
    try {
      const qsp = [...incoming.searchParams.entries()].map(([k,v])=>`${k}=${v}`).join('&');
      console.log(`➡️  /api/v1/search ${req.method} ${incoming.pathname}?${qsp}`);
      console.log(`   headers: ct=${req.headers['content-type']||'n/a'} cl=${req.headers['content-length']||'n/a'}`);
    } catch {}

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    // Build request body from Express-parsed body (normalize to Combined Query format)
    let body;
    let contentType;
    let parsedBody;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (typeof req.body === 'string') {
        body = req.body;
        contentType = req.headers['content-type'] || 'application/json';
        try { parsedBody = JSON.parse(body); } catch {}
      } else if (req.is('application/json')) {
        parsedBody = req.body || {};
        contentType = 'application/json';
      } else {
        body = undefined;
      }
    }

    // Normalize to ML Combined Query: { search: { qtext, query } }
    if (parsedBody && contentType === 'application/json') {
      const qtext = extractQtext(parsedBody);
      const structQuery = parsedBody.search?.query || parsedBody.query || undefined;
      const combined = { search: {} };
      if (qtext) combined.search.qtext = qtext;
      if (structQuery) combined.search.query = structQuery;
      // If neither provided, fall back to GET below
      if (combined.search.qtext || combined.search.query) {
        body = JSON.stringify(combined);
      } else {
        body = undefined;
      }
    }

    // Log parsed/normalized body
    try {
      const preview = (body || '').toString().slice(0, 200);
      console.log(`   body: ${body ? `${preview}${body.length>200?' …':''}` : 'none'}`);
    } catch {}

    const start = Date.now();
    let resp;
    const qtextForFallback = extractQtext(parsedBody);
    console.log(`🔎 /api/v1/search starting (qtext="${(qtextForFallback||'').slice(0,64)}"...)`);
    // Attempt order:
    // 1) POST with named options (corticonml-options)
    // 2) POST without options, return-content=true
    // 3) GET with q=<qtext>, return-content=true
    let attempt = 1;
    try {
      const withOptions = new URL(mlUrl.toString());
      withOptions.searchParams.set('options', 'corticonml-options');
      console.log(`   attempt 1 -> ${withOptions}`);
      resp = await fetch(withOptions.toString(), {
        method: body ? 'POST' : 'GET',
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          Authorization: 'Basic ' + Buffer.from(`${mlUser}:${mlPass}`).toString('base64'),
        },
        body,
        signal: controller.signal,
      });
      attempt = 1;
      if (!resp.ok) throw new Error(`search with options failed: ${resp.status}`);
    } catch (e1) {
      console.warn(`   attempt 1 failed: ${e1?.message || e1}`);
      try {
        const noOptions = new URL(mlUrl.toString());
        noOptions.searchParams.delete('options');
        console.log(`   attempt 2 -> ${noOptions}`);
        resp = await fetch(noOptions.toString(), {
          method: body ? 'POST' : 'GET',
          headers: {
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: 'Basic ' + Buffer.from(`${mlUser}:${mlPass}`).toString('base64'),
          },
          body,
          signal: controller.signal,
        });
        attempt = 2;
        if (!resp.ok) throw new Error(`search without options failed: ${resp.status}`);
      } catch (e2) {
        console.warn(`   attempt 2 failed: ${e2?.message || e2}`);
        const fallback = new URL(mlUrl.toString());
        fallback.searchParams.delete('options');
        if (qtextForFallback) fallback.searchParams.set('q', qtextForFallback);
        console.log(`   attempt 3 -> ${fallback}`);
        resp = await fetch(fallback.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: 'Basic ' + Buffer.from(`${mlUser}:${mlPass}`).toString('base64'),
          },
          signal: controller.signal,
        });
        attempt = 3;
      }
    }

    clearTimeout(timeout);

    const text = await resp.text();
    const dur = Date.now() - start;
    console.log(`🔎 /api/v1/search [attempt ${attempt}] -> ML ${resp.status} in ${dur}ms (${mlUrl.search})`);
    if (!resp.ok) {
      console.error(`❌ ML search error (attempt ${attempt}): status=${resp.status} body=${text?.substring(0,300)}`);
      return res.status(resp.status).send(text || 'Search error');
    }
    // Try to enrich search results with full document content for demo reliability
    try {
      const rawJson = text ? JSON.parse(text) : {};
      const enriched = await enrichSearchResultsWithContent(rawJson);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(JSON.stringify(enriched));
    } catch (e) {
      console.warn(`⚠️ Could not enrich search results: ${e?.message || e}`);
      // Pass through JSON as-is
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(text || '{}');
    }
  } catch (e) {
    console.error(`❌ /api/v1/search proxy error:`, e);
    if (!res.headersSent) return res.status(500).json({ error: e.message || 'Proxy error' });
  }
});

function extractQtext(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (typeof obj.qtext === 'string' && obj.qtext.trim()) return obj.qtext.trim();
  if (obj.search && typeof obj.search.qtext === 'string' && obj.search.qtext.trim()) return obj.search.qtext.trim();
  return '';
}

app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});
