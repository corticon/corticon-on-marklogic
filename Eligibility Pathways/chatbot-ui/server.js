// Eligibility Pathways/chatbot-ui/server.js
import express from "express";
import DigestClient from "digest-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const ML_HOST = process.env.ML_HOST || "localhost";
const ML_PORT = process.env.ML_PORT || "8004";
const ML_USER = process.env.ML_USER || "corticonml-admin";
const ML_PASS = process.env.ML_PASS || "corticonml-admin";

const CHATBOT_PORT = Number(process.env.CHATBOT_PORT || 4010);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const OPENAI_DEBUG = ["1", "true", "yes"].includes(
  String(process.env.OPENAI_DEBUG || "").toLowerCase()
);

// Hard safety clamp so the OpenAI request can't exceed context limits
function clampText(value, maxChars) {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length <= maxChars ? s : s.slice(0, maxChars) + "\n...[truncated by Node proxy]";
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/^\s*\d+\.\s*/gm, "")
    .replace(/`+/g, "")
    .trim();
}

const OPENAI_SYSTEM_PROMPT = `
You are a Medicaid Eligibility Expert. Your goal is to provide a Decision Rationale for agency staff.

You are given ONE Household JSON document from MarkLogic. Treat it as the ONLY source of truth.

NON-NEGOTIABLE GROUNDING RULES:
- Do not generalize or speculate. Every claim must be supported by fields or strings in the provided Household JSON.
- If the named person is not present in the Household JSON, say so and ask for householdId/personName (do NOT explain policy in the abstract).
- Use eligibilityNote and Message strings as primary rationale when present.
- When explaining why income appears high but eligibility exists, cite the exact fields used (e.g., excludedCOLAIncreases, wasSSIRecipient, lostSSIDueToCOLA) if present.
- If GA_PICKLE appears in classOfAssistance, explain it as COLA exclusion logic using the evidence present in the JSON.
- If multiple programs are eligible, justify selection using isSelected and priority fields (globalPriority/groupRank/priorityForGroup) if present.

FORMAT:
- Plain text only. Short paragraphs.
- First sentence must include the person's name and householdId.
`.trim();

const RESOURCE_URL = `http://${ML_HOST}:${ML_PORT}/v1/resources/chatbot`;
const client = new DigestClient(ML_USER, ML_PASS);

// --- Analytics proxy (MarkLogic Optic via resource extension) ---
async function mlGet(url) {
  const r = await client.fetch(url, { method: "GET" });
  const text = await r.text();
  if (r.status >= 400) {
    throw new Error(`MarkLogic analytics failed (${r.status}): ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

// Name extraction + household resolver (used for auto-grounding)
function extractNameFromQuery(q) {
  if (!q) return null;

  // Matches: "Lenette Fairbourne's income..." OR "Why didn't Lenette Fairbourne..."
  let m = String(q).match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)'s\b/);
  if (m) return { first: m[1], last: m[2] };

  // Fallback: first two TitleCase words
  m = String(q).match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/);
  if (m) return { first: m[1], last: m[2] };

  return null;
}

async function resolveHouseholdIdByName(first, last) {
  const url =
    `http://${ML_HOST}:${ML_PORT}/v1/resources/analytics` +
    `?rs:action=resolve-person&rs:first=${encodeURIComponent(first)}` +
    `&rs:last=${encodeURIComponent(last)}`;

  const r = await client.fetch(url, { method: "GET" });
  const text = await r.text();
  if (r.status >= 400) return null;

  const json = JSON.parse(text);
  const rows = json?.rows || [];
  const hh = rows[0]?.householdId || rows[0]?.["eligibility.coa.householdId"];
  return hh ? String(hh) : null;
}

// ---- Health ----
app.get("/api/health", (req, res) => {
  res.json({ ok: true, marklogic: `http://${ML_HOST}:${ML_PORT}` });
});

// ---- Analytics routes ----
app.get("/api/analytics/selected-coa", async (req, res) => {
  try {
    const url = `http://${ML_HOST}:${ML_PORT}/v1/resources/analytics?rs:action=selected-coa`;
    const data = await mlGet(url);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/analytics/evaluated-coa", async (req, res) => {
  try {
    const url = `http://${ML_HOST}:${ML_PORT}/v1/resources/analytics?rs:action=evaluated-coa`;
    const data = await mlGet(url);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/analytics/ineligibility-flags", async (req, res) => {
  try {
    const url = `http://${ML_HOST}:${ML_PORT}/v1/resources/analytics?rs:action=ineligibility-flags`;
    const data = await mlGet(url);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/analytics/top-rules", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 15);
    const url = `http://${ML_HOST}:${ML_PORT}/v1/resources/analytics?rs:action=top-rules&rs:limit=${encodeURIComponent(
      limit
    )}`;
    const data = await mlGet(url);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Drilldown: examples for a selected COA name
app.get("/api/analytics/examples", async (req, res) => {
  try {
    const name = String(req.query.name || "").trim();
    const limit = Number(req.query.limit || 10);
    if (!name) return res.status(400).json({ error: "Missing ?name=" });

    const url =
      `http://${ML_HOST}:${ML_PORT}/v1/resources/analytics?rs:action=examples` +
      `&rs:name=${encodeURIComponent(name)}` +
      `&rs:limit=${encodeURIComponent(limit)}`;

    const data = await mlGet(url);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Chat route ----
app.post("/api/chat", async (req, res) => {
  const body = req.body || {};
  const hasQuery = typeof body.query === "string" && body.query.trim().length > 0;

  const hasFilters = Boolean(
    body.householdId ||
      body.familyName || // NEW: allow familyName filter too
      body.personId ||
      body.personName ||
      body.personSsn ||
      body.programName ||
      body.programId
  );

  if (!hasQuery && !hasFilters) {
    return res.status(400).json({ error: "Provide a query or filters." });
  }

  // Auto-grounding: if user asked about a specific person but didn't supply householdId/personName
  if (!body.householdId && body.query) {
    const nm = extractNameFromQuery(String(body.query));
    if (nm) {
      const hh = await resolveHouseholdIdByName(nm.first, nm.last);
      if (hh) {
        body.householdId = hh;
        if (!body.personName) body.personName = `${nm.first} ${nm.last}`;
      }
    }
  }

  // Optional: auto-switch to trace mode if question asks for evidence/rules/why
  if (body.query && /trace|rulesheet|rule\s*\d|evidence|why/i.test(String(body.query))) {
    body.mode = "trace";
  }

  const requestBody = OPENAI_DEBUG ? { ...body, debug: true } : body;

  try {
    const response = await client.fetch(RESOURCE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const text = await response.text();

    let mlJson = null;
    try {
      mlJson = JSON.parse(text);
    } catch {
      mlJson = null;
    }
if (mlJson && mlJson.error && typeof mlJson.error === "string") {
  // return MarkLogic error directly (don’t send to OpenAI)
  return res.status(200).json({ output: mlJson.error, citations: [], source: "marklogic" });
}

    // If MarkLogic failed OR no OpenAI key, just pass through MarkLogic response
    if (!OPENAI_API_KEY || response.status >= 400) {
      res.status(response.status);
      res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
      return res.send(text);
    }

    const question = body.query
      ? String(body.query)
      : "Explain eligibility using the provided filters.";

    // ✅ IMPORTANT: only send a bounded, small subset to OpenAI
    // Never send huge `matches` arrays or entire doc payloads.
    const mlForPrompt =
      mlJson && typeof mlJson === "object"
        ? {
            output: mlJson.output,
            citations: mlJson.citations || [],
            // include a tiny bit of debug if you want, but keep it bounded
            debug: OPENAI_DEBUG ? { tokens: mlJson?.debug?.tokens } : undefined,
            serviceVersion: mlJson.serviceVersion
          }
        : { output: text };

    const MAX_ML_PROMPT_CHARS = Number(process.env.MAX_ML_PROMPT_CHARS || 20000);
    const mlPromptText = clampText(JSON.stringify(mlForPrompt), MAX_ML_PROMPT_CHARS);

    const llmPayload = {
      model: OPENAI_MODEL,
      instructions: OPENAI_SYSTEM_PROMPT,
      max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 500),
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: `User question:\n${question}` },
            {
              type: "input_text",
              text: `MarkLogic response (authoritative):\n${mlPromptText}`
            }
          ]
        }
      ]
    };

    const llmResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(llmPayload)
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text().catch(() => "");
      console.warn("[OpenAI] error:", llmResponse.status, errText.slice(0, 400));

      return res.status(502).json({
        error: "OpenAI request failed",
        status: llmResponse.status,
        detail: errText.slice(0, 800),
        citations: mlJson?.citations || [],
        marklogic_excerpt: clampText(text, 2000)
      });
    }

    const llmData = await llmResponse.json();

    let outputText = "";
    if (typeof llmData?.output_text === "string" && llmData.output_text.trim()) {
      outputText = llmData.output_text.trim();
    } else if (Array.isArray(llmData?.output)) {
      for (const item of llmData.output) {
        const parts = item?.content || [];
        for (const part of parts) {
          const value = part?.text?.value || part?.text || part?.value;
          if (typeof value === "string" && value.trim()) {
            outputText = value.trim();
            break;
          }
        }
        if (outputText) break;
      }
    }

    if (!outputText) outputText = "No LLM response text was returned.";
    outputText = stripMarkdown(outputText);

    const responsePayload = {
      output: outputText,
      citations: mlJson?.citations || [],
      source: "openai"
    };

    if (OPENAI_DEBUG) {
      responsePayload.marklogic = {
        status: response.status,
        parsed: mlJson,
        raw: text.slice(0, 5000)
      };
    }

    res.status(200).setHeader("Content-Type", "application/json");
    return res.send(JSON.stringify(responsePayload));
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach MarkLogic.", detail: err.message });
  }
});

app.listen(CHATBOT_PORT, () => {
  console.log(`Chatbot UI at http://localhost:${CHATBOT_PORT}`);
  console.log(`Proxying to ${RESOURCE_URL}`);
});
