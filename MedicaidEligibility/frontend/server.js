/*
 * Copyright (c) 2024 MarkLogic
 * Apache 2.0
 */

'use strict';

const express = require('express');
const http = require('http');          // ✅ only once
const cors = require('cors');
const fetch = require("node-fetch");
const { AbortSignal } = require("abort-controller");

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
app.get("/api/analytics", async (req, res) => {
  const { type } = req.query;
  const queries = {
    avgIncomeByFamilySize: `
      SELECT size AS familySize, ROUND(AVG(annualIncome) * 100) / 100 AS avgIncome
      FROM household.household
      WHERE size IS NOT NULL AND annualIncome IS NOT NULL
      GROUP BY size
      ORDER BY size;
    `,
    eligibilityByAgeGroup: `
      SELECT ageGroup, COUNT(*) AS individuals
      FROM (
        SELECT CASE
          WHEN age < 19 THEN 'Child (0–18)'
          WHEN age BETWEEN 19 AND 64 THEN 'Adult (19–64)'
          ELSE 'Senior (65+)' END AS ageGroup
        FROM household.individual
        WHERE age IS NOT NULL
      ) t
      GROUP BY ageGroup
      ORDER BY individuals DESC;
    `,
    nearMissFPL: `
      SELECT householdId, state, annualIncome, householdPercentFPL
      FROM household.household
      WHERE householdPercentFPL BETWEEN 1.9 AND 2.1
        AND annualIncome IS NOT NULL
        AND state IS NOT NULL
      ORDER BY householdPercentFPL;
    `,
    topDenialReasons: `
      SELECT text AS reason, COUNT(*) AS count
      FROM household.eligibilityNote
      WHERE text IS NOT NULL AND (
        LOWER(text) LIKE '%inelig%'
        OR LOWER(text) LIKE '%deni%'
        OR LOWER(text) LIKE '%not eligible%'
      )
      GROUP BY text
      ORDER BY count DESC
      LIMIT 10;
    `,
    mostCommonAssistance: `
      SELECT "group" AS assistanceGroup, COUNT(*) AS count
      FROM household.classOfAssistance
      WHERE "group" IS NOT NULL
      GROUP BY "group"
      ORDER BY count DESC
      LIMIT 10;
    `,

    /* New, data-supported analytics */
    ageDistribution: `
      SELECT ageGroup, COUNT(*) AS individuals
      FROM (
        SELECT CASE
          WHEN age < 19 THEN 'Child (0–18)'
          WHEN age BETWEEN 19 AND 64 THEN 'Adult (19–64)'
          ELSE 'Senior (65+)' END AS ageGroup
        FROM household.individual
        WHERE age IS NOT NULL
      ) t
      GROUP BY ageGroup
      ORDER BY individuals DESC;
    `,

    sizeDistribution: `
      SELECT size, COUNT(*) AS households
      FROM household.household
      WHERE size IS NOT NULL
      GROUP BY size
      ORDER BY size;
    `,

    incomeBuckets: `
      SELECT incomeBucket, COUNT(*) AS households
      FROM (
        SELECT CASE
          WHEN annualIncome < 10000 THEN '<10k'
          WHEN annualIncome < 25000 THEN '10–25k'
          WHEN annualIncome < 50000 THEN '25–50k'
          WHEN annualIncome < 75000 THEN '50–75k'
          WHEN annualIncome < 100000 THEN '75–100k'
          ELSE '100k+' END AS incomeBucket
        FROM household.household
        WHERE annualIncome IS NOT NULL
      ) t
      GROUP BY incomeBucket
      ORDER BY households DESC;
    `,

    topProgramNames: `
      SELECT name AS program, COUNT(*) AS count
      FROM household.classOfAssistance
      WHERE name IS NOT NULL
      GROUP BY name
      ORDER BY count DESC
      LIMIT 20;
    `,

    programGroupCounts: `
      SELECT "group" AS assistanceGroup, COUNT(*) AS count
      FROM household.classOfAssistance
      WHERE "group" IS NOT NULL
      GROUP BY "group"
      ORDER BY count DESC
      LIMIT 20;
    `,

    incomeTestOutcomeByGroup: `
      SELECT "group",
        SUM(CASE WHEN incomeTestPassed = 'true' THEN 1 ELSE 0 END) AS pass,
        SUM(CASE WHEN incomeTestPassed = 'false' THEN 1 ELSE 0 END) AS fail,
        SUM(CASE WHEN incomeTestPassed IS NULL THEN 1 ELSE 0 END) AS unknown
      FROM household.classOfAssistance
      WHERE "group" IS NOT NULL
      GROUP BY "group"
      ORDER BY pass DESC;
    `,

    relationTop: `
      SELECT relationToApplicant, COUNT(*) AS individuals
      FROM household.individual
      WHERE relationToApplicant IS NOT NULL
      GROUP BY relationToApplicant
      ORDER BY individuals DESC
      LIMIT 20;
    `,

    fplBandDistribution: `
      SELECT fplBand, COUNT(*) AS households
      FROM (
        SELECT CASE
          WHEN householdPercentFPL < 1 THEN '<100%'
          WHEN householdPercentFPL < 1.38 THEN '100–138%'
          WHEN householdPercentFPL < 2 THEN '138–200%'
          WHEN householdPercentFPL < 3 THEN '200–300%'
          ELSE '300%+' END AS fplBand
        FROM household.household
        WHERE householdPercentFPL IS NOT NULL
      ) t
      GROUP BY fplBand
      ORDER BY households DESC;
    `,

    /* A. Pathways Activity Requirement Impact
       Individuals who failed only due to qualifying-activity requirement
       Approximation: Pathways COA present, incomeTestPassed true, resourceTestPassed true/null, eligibleViaPath false */
    pathwaysActivityFailures: `
      SELECT t.ageGroup AS ageGroup, COUNT(*) AS count
      FROM (
        SELECT i.householdId, i.ssn,
               CASE
                 WHEN i.age < 19 THEN 'Under 19'
                 WHEN i.age BETWEEN 19 AND 64 THEN '19–64'
                 ELSE '65+' END AS ageGroup
        FROM household.classOfAssistance c
        JOIN household.individual i ON i.ssn = c.individual_ssn
        WHERE LOWER(c.name) LIKE '%pathways%'
          AND c.incomeTestPassed = 'true'
          AND (c.resourceTestPassed = 'true' OR c.resourceTestPassed IS NULL)
          AND c.eligibleViaPath = 'false'
      ) AS t
      WHERE EXISTS (
        SELECT 1 FROM household.ruleMessage m
        WHERE m.householdId = t.householdId
          AND LOWER(m.rulesheetName) = 'financial eligibility'
          AND m.ruleNumber = '8'
      )
      GROUP BY t.ageGroup
      ORDER BY count DESC;
    `,

    /* B. Near Miss Financial Ineligibility (<5% over threshold where incomeTestPassed = FALSE) */
    nearMissIncome: `
      SELECT h.householdId, h.state, h.annualIncome, c.name AS program, c.incomeThreshold,
             ROUND(((h.annualIncome - c.incomeThreshold) * 10000) / c.incomeThreshold) / 100 AS overPercent
      FROM household.household h
      JOIN household.classOfAssistance c ON c.householdId = h.householdId
      WHERE c.incomeThreshold IS NOT NULL AND c.incomeThreshold > 0
        AND h.annualIncome IS NOT NULL
        AND h.annualIncome > c.incomeThreshold
        AND ((h.annualIncome - c.incomeThreshold) / c.incomeThreshold) <= 0.05
        AND (c.incomeTestPassed = 'false' OR c.incomeTestPassed IS NULL)
      ORDER BY overPercent ASC
      LIMIT 100;
    `,

    /* C. Program Determination Specificity (Tie-Breakers) */
    tieBreakerOutcomes: `
      SELECT stats.householdId, stats.first, stats.last, stats.eligiblePrograms,
             winner."group" AS chosenGroup, stats.minPriority
      FROM (
        SELECT i.ssn, i.householdId, i.first, i.last,
               COUNT(*) AS eligiblePrograms, MIN(c.priorityForGroup) AS minPriority
        FROM household.individual i
        JOIN household.classOfAssistance c ON i.ssn = c.individual_ssn
        WHERE c.eligibleViaPath = 'true'
        GROUP BY i.ssn, i.householdId, i.first, i.last
        HAVING COUNT(*) > 2
      ) AS stats
      JOIN household.classOfAssistance AS winner
        ON winner.individual_ssn = stats.ssn AND winner.priorityForGroup = stats.minPriority
      ORDER BY stats.eligiblePrograms DESC
      LIMIT 100;
    `,

    /* Business Insight A: Churn Risk (Pickle or Disabled Adult Child) */
    churnPrograms: `
      SELECT name AS program, COUNT(*) AS count
      FROM household.classOfAssistance
      WHERE eligibleViaPath = 'true'
        AND LOWER(name) IN ('pickle', 'disabled adult child')
      GROUP BY name
      ORDER BY count DESC;
    `,

    /* Business Insight B: Household Composition Complexity */
    complexHouseholds: `
      SELECT h.state AS state, COUNT(DISTINCT h.householdId) AS households
      FROM household.household h
      JOIN household.individual i ON i.householdId = h.householdId
      WHERE h.size > 4
        AND LOWER(i.relationToApplicant) NOT IN ('child','parent','dependent child','parent/caretaker','caretaker','caretakerrelative')
      GROUP BY h.state
      ORDER BY households DESC;
    `,
  };

  let sql = queries[type];
  if (type === 'ruleUsageHeatmap') {
    sql = `
      SELECT rulesheetName, ruleNumber, COUNT(*) AS count
      FROM household.ruleMessage
      WHERE rulesheetName IS NOT NULL AND ruleNumber IS NOT NULL
      GROUP BY rulesheetName, ruleNumber
      ORDER BY count DESC
      LIMIT 200;
    `;
  }
  if (type === 'ruleUsageHeatmapMetrics') {
    sql = `
      SELECT rulesheetName, ruleNumber, COUNT(*) AS count
      FROM household.ruleMetricAttribute
      WHERE rulesheetName IS NOT NULL AND ruleNumber IS NOT NULL
      GROUP BY rulesheetName, ruleNumber
      ORDER BY count DESC
      LIMIT 200;
    `;
  }
  if (type === 'ruleLineage') {
    const hh = parseInt(req.query.householdId, 10);
    if (!hh) return res.status(400).json({ error: 'householdId required' });
    sql = `
      SELECT rulesheetName, ruleNumber, severity, text
      FROM household.ruleMessage
      WHERE householdId = ${hh}
      ORDER BY rulesheetName, ruleNumber;
    `;
  }
  if (type === 'ruleLineageMetrics') {
    const hh = parseInt(req.query.householdId, 10);
    if (!hh) return res.status(400).json({ error: 'householdId required' });
    sql = `
      SELECT rulesheetName, ruleNumber, entityName, attributeName, afterValue, sequence
      FROM household.ruleMetricAttribute
      WHERE householdId = ${hh}
      ORDER BY sequence;
    `;
  }
  if (!sql) return res.status(400).json({ error: "Invalid analytics type" });

  try {
    const url = `http://${mlHost}:${mlRestPort}/v1/rows?format=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/sql",
        Authorization:
          "Basic " + Buffer.from(`${mlUser}:${mlPass}`).toString("base64"),
      },
      body: sql,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await response.text();
    console.log("📊 Raw response text:", text);

    if (!text || !text.trim()) {
      console.warn(`⚠️ Empty response body for ${type}`);
      return res.status(200).json({ rows: [] });
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      console.error(`❌ JSON parse failed for ${type}:`, text);
      throw err;
    }

    console.log(`✅ ${type} query OK (${text.length} bytes)`);
    res.json(json);
  } catch (err) {
    console.error(`❌ Analytics error [${type}]:`, err);
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
