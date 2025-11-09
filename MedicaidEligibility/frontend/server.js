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
const mlUser = process.env.ML_USER || 'corticonml-admin';
const mlPass = process.env.ML_PASS || 'corticonml-admin';

app.get("/api/analytics", async (req, res) => {
  const { type, householdId } = req.query;

  // NOTE: In MarkLogic SQL, it's safer to compare booleans explicitly like `col = true`
  // or use them in CASE statements without relying on implicit casting in all contexts.
  const queries = {
    programEligibilityStats: `
      SELECT
          coa.name AS Program_Name,
          COUNT(DISTINCT i.ssn) AS Total_Evaluated,
          SUM(CASE WHEN coa.incomeTestPassed = false THEN 1 ELSE 0 END) AS Failed_Income_Test,
          SUM(CASE WHEN coa.resourceTestPassed = false THEN 1 ELSE 0 END) AS Failed_Resource_Test
      FROM household.classOfAssistance AS coa
      JOIN household.individual AS i ON coa.individual_ssn = i.ssn AND coa.householdId = i.householdId
      GROUP BY coa.name
      ORDER BY Total_Evaluated DESC
    `,
    nearMissIncomeStats: `
      SELECT
          h.householdId,
          h.familySize,
          h.householdPercentFPL,
          coa.name AS Program_Denied_Income,
          h.monthlyIncome
      FROM household.household AS h
      JOIN household.classOfAssistance AS coa ON h.householdId = coa.householdId
      WHERE coa.incomeTestPassed = false
        AND h.householdPercentFPL >= 0.8  -- Broader range for demo
        AND h.householdPercentFPL <= 3.0
      ORDER BY h.householdPercentFPL ASC
      LIMIT 100
    `,
    ruleFiringStats: `
      SELECT
          ac.rulesheetName,
          ac.entityName,
          ac.attributeName,
          COUNT(*) AS Firing_Count
      FROM household.attributeChanges AS ac
      GROUP BY ac.rulesheetName, ac.entityName, ac.attributeName
      ORDER BY Firing_Count DESC
      LIMIT 50
    `,
    demographicTrends: `
       SELECT
           Demographic_Group,
           COUNT(DISTINCT ssn) AS Enrollment_Count
       FROM (
           SELECT
               i.ssn,
               CASE
                   WHEN i.age >= 65 THEN 'Senior (65+)'
                   WHEN i.isPregnant = true THEN 'Pregnant'
                   WHEN i.isBlind = true OR i.isDisabled = true THEN 'Disabled/Blind'
                   WHEN i.age < 19 THEN 'Child (<19)'
                   ELSE 'Other Adult'
               END AS Demographic_Group
           FROM household.individual AS i
       ) AS subquery
       GROUP BY Demographic_Group
       ORDER BY Enrollment_Count DESC
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

  let sql = queries[type];
  if (!sql) return res.status(400).json({ error: `Invalid analytics type: ${type}` });

  try {
    console.log(`🔍 Executing SQL for [${type}]...`);
    const url = `http://${mlHost}:${mlRestPort}/v1/rows?format=json`;
    // Use a slightly longer timeout for analytical queries
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/sql",
        "Accept": "application/json",
        Authorization: "Basic " + Buffer.from(`${mlUser}:${mlPass}`).toString("base64"),
      },
      body: sql,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
        const text = await response.text();
        console.error(`❌ MarkLogic error for ${type}: ${response.status} - ${text.substring(0, 300)}`);
        // Send back the MarkLogic error for easier debugging in frontend console
        return res.status(response.status).json({ error: text });
    }

    const json = await response.json();
    console.log(`✅ ${type} query OK. Rows returned: ${json.rows ? json.rows.length : 0}`);
    res.json(json);
  } catch (err) {
    console.error(`❌ Analytics error [${type}]:`, err);
    // Handle abort/timeout specifically if needed, otherwise generic 500
    res.status(500).json({ error: err.message });
  }
});

// --- Generic Proxy ---
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

app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});