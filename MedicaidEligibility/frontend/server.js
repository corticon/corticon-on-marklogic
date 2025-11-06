/*
 * Copyright (c) 2024 MarkLogic Corporation
 * Licensed under the Apache License, Version 2.0 (the "License");
 * http://www.apache.org/licenses/LICENSE-2.0
 */

'use strict';

const express = require('express');
const http = require('http');
const cors = require('cors');
const marklogic = require('marklogic'); // 🔹 Add the MarkLogic Node.js Client

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

// 🔹 Create a MarkLogic client for analytics
const db = marklogic.createDatabaseClient({
  host: mlHost,
  port: mlRestPort,
  user: mlUser,
  password: mlPass,
  authType: 'digest'
});

// --------------------------------------------------
// 🔹 New Analytics API (for your React dashboard)
// --------------------------------------------------
// --------------------------------------------------
// 🔹 Analytics API via REST /v1/rows
// --------------------------------------------------
const https = require('https');

app.get('/api/analytics', async (req, res) => {
  const type = req.query.type;
  let sql;

switch (type) {
  case 'totalHouseholds':
    sql = `
      SELECT COUNT(*) AS total
      FROM household.household;
    `;
    break;

  case 'avgIncomeByState':
    sql = `
      SELECT state AS state, AVG(annualIncome) AS avgIncome
      FROM household.household
      WHERE state IS NOT NULL
      GROUP BY state
      ORDER BY state;
    `;
    break;

  case 'fplOver200':
    sql = `
      SELECT COUNT(*) AS over200
      FROM household.household
      WHERE householdPercentFPL > 2.0;
    `;
    break;

  case 'top10Income':
    sql = `
      SELECT householdId, state, annualIncome, householdPercentFPL
      FROM household.household
      WHERE annualIncome IS NOT NULL
      ORDER BY annualIncome DESC
      LIMIT 10;
    `;
    break;

  default:
    return res.status(400).json({ error: 'Unknown analytics type' });
}

  try {
    console.log(`(Analytics) Running SQL: ${sql.trim().slice(0, 80)}...`);

    const options = {
      hostname: mlHost,
      port: mlRestPort,
      path: '/v1/rows?format=json',
      method: 'POST',
      headers: {
        'Authorization':
          'Basic ' + Buffer.from(mlUser + ':' + mlPass).toString('base64'),
        'Content-Type': 'application/sql',
      },
    };

    const mlReq = http.request(options, (mlRes) => {
      let data = '';

      mlRes.on('data', (chunk) => {
        data += chunk;
      });

      mlRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          res.json(parsed);
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
  } catch (err) {
    console.error('(Analytics) Unexpected error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------
// Original Basic Auth Proxy (unchanged)
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
      'Authorization':
        'Basic ' + Buffer.from(mlUser + ':' + mlPass).toString('base64')
    }
  };

  const mlReq = http.request(options, (mlRes) => {
    res.statusCode = mlRes.statusCode;
    Object.keys(mlRes.headers).forEach((key) => {
      res.setHeader(key, mlRes.headers[key]);
    });
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
