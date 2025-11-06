/*
 * Copyright (c) 2024 MarkLogic Corporation
 * Licensed under the Apache License, Version 2.0 (the "License");
 * http://www.apache.org/licenses/LICENSE-2.0
 */

'use strict';

const express = require('express');
const http = require('http');
const cors = require('cors');

// Constants
const PORT = 4001;
const HOST = '0.0.0.0';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// --- MarkLogic Connection Details ---
const mlHost = process.env.ML_HOST || 'localhost';
const mlRestPort = process.env.ML_REST_PORT || 8004;
const mlUser = process.env.ML_USER || 'corticonml-admin';
const mlPass = process.env.ML_PASS || 'corticonml-admin';

// --------------------------------------------------
// 🔹 Analytics API using MarkLogic /v1/rows
// --------------------------------------------------
app.get('/api/analytics', async (req, res) => {
  const type = req.query.type;
  let sql;

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
            WHEN age < 19 THEN 'Child (0-18)'
            WHEN age BETWEEN 19 AND 64 THEN 'Adult (19-64)'
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
        ORDER BY householdPercentFPL;
      `;
      break;

    case 'avgIncomeByFamilySize':
      sql = `
        SELECT familySize, ROUND(AVG(annualIncome), 2) AS avgIncome
        FROM household.household
        WHERE familySize IS NOT NULL
        GROUP BY familySize
        ORDER BY familySize;
      `;
      break;

    case 'topDenialReasons':
      sql = `
        SELECT text AS reason, COUNT(*) AS occurrences
        FROM household.eligibilityNote
        WHERE text LIKE '%ineligible%' OR text LIKE '%denied%'
        GROUP BY text
        ORDER BY occurrences DESC
        LIMIT 10;
      `;
      break;

    default:
      return res.status(400).json({ error: 'Unknown analytics type' });
  }

  console.log(`(Analytics) Running SQL: ${sql.trim().slice(0, 80)}...`);

  const options = {
    hostname: mlHost,
    port: mlRestPort,
    path: '/v1/rows?format=json',
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(mlUser + ':' + mlPass).toString('base64'),
      'Content-Type': 'application/sql',
    },
  };

  const mlReq = http.request(options, (mlRes) => {
    let data = '';
    mlRes.on('data', (chunk) => (data += chunk));
    mlRes.on('end', () => {
      try {
        res.json(JSON.parse(data));
      } catch (e) {
        console.error('(Analytics) Failed to parse:', e);
        res.status(500).json({ error: 'Invalid JSON from MarkLogic', raw: data });
      }
    });
  });

  mlReq.on('error', (e) => {
    console.error('(Analytics) HTTP error:', e);
    res.status(500).json({ error: e.message });
  });

  mlReq.write(sql);
  mlReq.end();
});


// --------------------------------------------------
// Basic Auth Proxy for MarkLogic FastTrack
// --------------------------------------------------
app.all(/\/v1\/.*/, (req, res) => {
  console.log(`(Basic Proxy) proxying ${req.method} ${req.url}`);
  const options = {
    hostname: mlHost,
    port: mlRestPort,
    path: req.url,
    method: req.method,
    headers: {
      'Content-Type': req.header('Content-Type') || 'application/json',
      'Authorization': 'Basic ' + Buffer.from(mlUser + ':' + mlPass).toString('base64'),
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

// --------------------------------------------------
app.listen(PORT, HOST);
console.log(`(Basic Proxy + Analytics API) Running on http://${HOST}:${PORT}`);
