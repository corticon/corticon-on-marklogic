/*
 * Copyright (c) 2024 MarkLogic
 * Apache 2.0
 */

'use strict';

const express = require('express');
const http = require('http');          // ✅ only once
const cors = require('cors');

// Constants
const PORT = 4001;
const HOST = '0.0.0.0';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Expose custom headers to the browser for analytics metadata
app.use(
  cors({
    exposedHeaders: [
      'X-Analytics-Duration',
      'X-Cache',
      'X-Analytics-Source',
    ],
  })
);

// --- MarkLogic Connection Details ---
const mlHost = process.env.ML_HOST || 'localhost';
const mlRestPort = process.env.ML_REST_PORT || 8004;
const mlUser = process.env.ML_USER || 'corticonml-admin';
const mlPass = process.env.ML_PASS || 'corticonml-admin';

// Simple in-memory cache for analytics responses
const ANALYTICS_CACHE_TTL_MS = parseInt(
  process.env.ANALYTICS_CACHE_TTL_MS || '60000',
  10
);
const analyticsCache = new Map(); // key -> { payload, ts }

/* --------------------------------------------------
   Robust Analytics API for the Dashboard
-------------------------------------------------- */
app.get('/api/analytics', async (req, res) => {
  const type = req.query.type;
  const noCache = req.query.nocache === '1' || req.query.nocache === 'true';
  const cacheKey = type;
  let sql;

  // Serve from cache when available and not bypassed
  if (!noCache) {
    const cached = analyticsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < ANALYTICS_CACHE_TTL_MS) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Analytics-Duration', '0');
      res.setHeader('X-Analytics-Source', 'cache');
      return res.json(cached.payload);
    }
  }

  switch (type) {
    case 'mostCommonAssistance':
      sql = `
        SELECT name AS assistanceProgram, COUNT(*) AS count
        FROM household.classOfAssistance
        WHERE name IS NOT NULL
        GROUP BY name
        ORDER BY count DESC
        LIMIT 10;
      `;
      break;

    case 'eligibilityByAgeGroup':
      sql = `
        SELECT
          CASE
            WHEN age < 19 THEN 'Child (0–18)'
            WHEN age BETWEEN 19 AND 64 THEN 'Adult (19–64)'
            ELSE 'Senior (65+)' END AS ageGroup,
          COUNT(*) AS individuals
        FROM household.individual
        WHERE age IS NOT NULL
        GROUP BY ageGroup
        ORDER BY individuals DESC;
      `;
      break;

    case 'nearMissFPL':
      sql = `
        SELECT householdId, state, annualIncome, householdPercentFPL
        FROM household.household
        WHERE householdPercentFPL BETWEEN 1.9 AND 2.1
          AND annualIncome IS NOT NULL
          AND state IS NOT NULL
        ORDER BY householdPercentFPL;
      `;
      break;

    case 'avgIncomeByFamilySize':
      sql = `
        SELECT size AS familySize, ROUND(AVG(annualIncome), 2) AS avgIncome
        FROM household.household
        WHERE size IS NOT NULL
          AND annualIncome IS NOT NULL
        GROUP BY size
        ORDER BY size;
      `;
      break;

    case 'topDenialReasons':
      sql = `
        SELECT n.text AS reason, COUNT(*) AS occurrences
        FROM household.eligibilityNote n
        WHERE LOWER(n.text) LIKE '%ineligible%' OR LOWER(n.text) LIKE '%denied%'
        GROUP BY n.text
        ORDER BY occurrences DESC
        LIMIT 10;
      `;
      break;

    default:
      return res.status(400).json({ error: 'Unknown analytics type' });
  }

  const started = Date.now();
  console.log(`(Analytics) Running SQL: ${sql.trim().slice(0, 120)}…`);

  try {
    const options = {
      hostname: mlHost,
      port: mlRestPort,
      path: '/v1/rows?format=json',
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${mlUser}:${mlPass}`).toString('base64'),
        'Content-Type': 'application/sql',
      },
    };

    const mlReq = http.request(options, (mlRes) => {
      let data = '';

      mlRes.on('data', (chunk) => (data += chunk));
      mlRes.on('end', () => {
        const ms = (Date.now() - started).toFixed(0);
        if (!data) {
          console.error('(Analytics) Empty response from MarkLogic');
          return res.status(502).json({ error: 'Empty response from MarkLogic' });
        }
        try {
          const parsed = JSON.parse(data);
          console.log(`(Analytics) OK ${type} in ${ms}ms`);
          // cache the successful response
          analyticsCache.set(cacheKey, { payload: parsed, ts: Date.now() });
          // expose timing + cache metadata
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Analytics-Duration', String(ms));
          res.setHeader('X-Analytics-Source', 'marklogic');
          res.json(parsed);
        } catch (e) {
          console.error(`(Analytics) Parse error after ${ms}ms:`, e.message);
          console.error('Raw (first 500 chars):', data.slice(0, 500));
          res.status(500).json({ error: 'Invalid JSON from MarkLogic', detail: e.message });
        }
      });
    });

    mlReq.on('error', (e) => {
      console.error('(Analytics) HTTP error:', e);
      res.status(500).json({ error: e.message });
    });

    // prevent “hang forever”
    mlReq.setTimeout(30000, () => {
      console.error('(Analytics) Timed out after 30s');
      mlReq.destroy();
      res.status(504).json({ error: 'Analytics request timed out' });
    });

    mlReq.write(sql);
    mlReq.end();
  } catch (err) {
    console.error('(Analytics) Unexpected error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* --------------------------------------------------
   Original Basic Auth Proxy (unchanged)
-------------------------------------------------- */
app.all(/\/v1\/.*/, (req, res) => {
  console.log(`(Basic Proxy) proxying ${req.method} ${req.url}`);
  const options = {
    hostname: mlHost,
    port: mlRestPort,
    path: req.url,
    method: req.method,
    headers: {
      'Content-Type': req.header('Content-Type') || 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${mlUser}:${mlPass}`).toString('base64'),
    },
  };

  const mlReq = http.request(options, (mlRes) => {
    res.statusCode = mlRes.statusCode;
    Object.keys(mlRes.headers).forEach((key) => res.setHeader(key, mlRes.headers[key]));
    mlRes.on('data', (d) => res.write(d));
    mlRes.on('end', () => res.end());
  });

  mlReq.on('error', (e) => {
    console.error(e);
    res.statusCode = 500;
    res.end(e.message);
  });

  if (req.body && Object.keys(req.body).length > 0) {
    mlReq.write(JSON.stringify(req.body));
  }
  mlReq.end();
});

/* -------------------------------------------------- */
app.listen(PORT, HOST);
console.log(`(Basic Proxy + Analytics API) Running on http://${HOST}:${PORT}`);
