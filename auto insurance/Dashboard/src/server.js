// src/server.js
import express from "express";
import DigestClient from "digest-fetch";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve("./.env") });

const app = express();
app.use(express.json());

const ML_HOST = process.env.ML_HOST || "localhost";
const ML_PORT = process.env.ML_PORT || "8004";
const ML_USER = process.env.ML_USER || "admin";
const ML_PASS = process.env.ML_PASS || "password";
const MIDDLE_TIER_PORT = process.env.ML_MIDDLE_TIER_PORT || 4004;
const UI_ORIGIN = process.env.UI_ORIGIN || "http://localhost:5173";

// --- CORS ---
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", UI_ORIGIN);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// --- Proxy route ---
app.all("/v1/{*splat}", async (req, res) => {
  const url = `http://${ML_HOST}:${ML_PORT}${req.originalUrl}`;
  
  const client = new DigestClient(ML_USER, ML_PASS);
  
  const options = {
    method: req.method,
    headers: {
      "Content-Type": req.headers['content-type'] || "application/json"
    },
    body: (req.method !== "GET")
      ? JSON.stringify(req.body || {})
      : undefined
  };

  try {
    const response = await client.fetch(url, options);
    const data = await response.text();
    console.log(`[Proxy] ${req.method} ${url} => ${response.status}`);
    res.status(response.status).send(data);
  } catch (err) {
    console.error("[Proxy Error]", err);
    res.status(500).send({ error: err.message });
  }
});

// --- Health endpoint ---
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(MIDDLE_TIER_PORT, () => {
  console.log(`Proxy running at http://localhost:${MIDDLE_TIER_PORT} -> ${ML_HOST}:${ML_PORT}`);
});