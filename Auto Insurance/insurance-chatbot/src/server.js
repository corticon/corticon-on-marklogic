// src/server.js
import express from "express";
import DigestClient from "digest-fetch";
import dotenv from "dotenv";
import path from "path";
// import OpenAI from "openai"; // Not needed for fetch-based Responses calls

// System instructions for the insurance chatbot
const systemInstructions = `
You are the Corticon Policy Explainer for Auto Insurance integrated with MarkLogic and Corticon.js.
- Only answer using the specific policy JSON provided for the current question.
- If no policy JSON is present, respond with exactly:
"I can only provide information based on the specific policy data I have been given. Please ask about a specific policy by providing its ID."
- Explain discounts/surcharges by quoting messages from corticon.messages when present.
- Use concise Markdown with sections: Greeting, Summary, Detailed Breakdown, Corticon Explanations.
- Do not invent terms or data outside the provided policy JSON.
`;

dotenv.config({ path: path.resolve("./.env") });

const app = express();
app.use(express.json());

const ML_HOST = process.env.ML_HOST || "localhost";
const ML_PORT = process.env.ML_PORT || "8004";
const ML_USER = process.env.ML_USER || "admin";
const ML_PASS = process.env.ML_PASS || "password";
const MIDDLE_TIER_PORT = process.env.ML_MIDDLE_TIER_PORT || 4004;
const UI_ORIGIN = process.env.UI_ORIGIN || "http://localhost:5173";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPTIONS_NAME = process.env.VITE_ML_OPTIONS || "corticonml-options";

// const openai = new OpenAI({ apiKey: OPENAI_API_KEY }); // unused in this file

const client = new DigestClient(ML_USER, ML_PASS);

// --- CORS ---
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", UI_ORIGIN);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

async function resolvePolicyDoc(mlHost, mlPort, optionsName, digestClient, appIdCandidates) {
  for (const id of appIdCandidates) {
    const url = `http://${mlHost}:${mlPort}/v1/resources/${optionsName}?rs:action=getPolicy&rs:applicationId=${encodeURIComponent(id)}`;
    console.log("[Policy fetch try]", id, url);
    const r = await digestClient.fetch(url);
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.warn("[Policy fetch try] not ok:", r.status, body.slice(0, 200));
      continue;
    }
    try {
      const doc = await r.json();
      const payload = Array.isArray(doc?.payload) ? doc.payload[0] : (doc?.payload || null);
      if (payload) return { id, doc };
    } catch (e) {
      const t = await r.text().catch(() => "");
      console.warn("[Policy fetch try] non-JSON:", t.slice(0, 200));
    }
  }
  return null;
}

function pickPremiumContext(p) {
  if (!p) return null;
  return {
    applicationId: p.applicationId,
    state: p.state,
    netPremium: p.netPremium,
    isMultiCar: p.isMultiCar,
    discount: p.discount,
    drivers: (p.drivers || []).map(d => ({
      first: d.first, last: d.last, age: d.age,
      surcharge: d.surcharge, discount: d.discount
    })),
    vehicles: (p.vehicles || []).map(v => ({
      make: v.make, model: v.model, modelYear: v.modelYear,
      netPremium: v.netPremium,
      coverages: (v.coverages || []).map(c => ({
        part: c.part, baseRate: c.baseRate, discount: c.discount, discountTotal: c.discountTotal, premium: c.premium
      }))
    }))
  };
}

function filterPricingMessages(messages) {
  return (messages || []).filter(m => {
    const t = (m.text || "").toLowerCase();
    return /\bpremium|rate|discount|surcharge|good student|multi[-\s]?car|multi[-\s]?line|loyalty|oui\b/.test(t);
  }).slice(0, 50);
}

// --- RAG-Enabled Chatbot Route ---
app.post("/api/chat", async (req, res) => {
  // 1) Read message safely
  const message = typeof req.body === "string" ? req.body : req.body?.message;
  if (!message || typeof message !== "string") {
    return res.status(400).send({ error: "Message is required" });
  }
  console.log("[Chat] message:", message);

  try {
    const tokens = message.split(/[^A-Za-z0-9_-]+/).filter(Boolean);
    const candidates = tokens.filter(t => /[A-Za-z]/.test(t) && /\d/.test(t) && t.length >= 5);
    const resolved = await resolvePolicyDoc(ML_HOST, ML_PORT, OPTIONS_NAME, client, candidates);

    if (!resolved) {
        console.warn("[Chat] No policy document found for candidates; returning guardrail.");
        const r = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: process.env.OPENAI_MODEL || "gpt-4o-mini",
              instructions: systemInstructions + "\nAlways produce a concise Markdown answer; do not return an empty response.",
              input: [{ role: "user", content: [{ type: "input_text", text: message }] }]
            })
        });

if (!r.ok) {
  const errText = await r.text().catch(() => "");
  console.error("[OpenAI error]", r.status, errText.slice(0, 800));
  return res.status(502).send({ error: `OpenAI error ${r.status}: ${errText}` });
}

let data;
try {
  data = await r.json();
} catch (e) {
  const raw = await r.text().catch(() => "");
  console.error("[OpenAI parse error] raw:", raw.slice(0, 800));
  return res.status(502).send({ error: "OpenAI response parse error" });
}
console.log("[OpenAI Responses raw]", JSON.stringify(data, null, 2));

        let outputText = "";
        if (typeof data?.output_text === "string" && data.output_text.trim()) {
          outputText = data.output_text.trim();
        } else if (Array.isArray(data?.output)) {
          // Try to find the first text value anywhere in output[].content[]
          for (const item of data.output) {
            const parts = item?.content || [];
            for (const part of parts) {
              const val = part?.text?.value || part?.text || part?.value;
              if (typeof val === "string" && val.trim()) {
                outputText = val.trim();
                break;
              }
            }
            if (outputText) break;
          }
        } else if (data?.choices?.[0]?.message?.content) {
          outputText = String(data.choices[0].message.content).trim();
        }

        if (!outputText) {
          outputText = "I can only provide information based on the specific policy data I have been given. Please ask about a specific policy by providing its ID.";
        }
        return res.send({ reply: outputText });
    }

    const { id: applicationId, doc: policyDoc } = resolved;
    console.log("[Chat] resolved applicationId:", applicationId);

    const payloadArray = Array.isArray(policyDoc?.payload) ? policyDoc.payload : [];
    const payload = payloadArray.length ? payloadArray[0] : null;
    const msgsRoot = policyDoc?.corticon?.messages || {};
    const allMessages = Array.isArray(msgsRoot.message) ? msgsRoot.message : [];
    const metrics = policyDoc?.corticon?.Metrics;
    console.log("[Policy parsed] has payload:", !!payload, "messages:", allMessages.length, "metrics:", !!metrics);

    const minimalPayload = pickPremiumContext(payload);
    const filteredMessages = filterPricingMessages(allMessages);

const policyJsonForLLM = {
  applicationId,
  policy: payload,
  messages: allMessages
};
const developerBlocks = [
  { type: "input_text", text: "Policy JSON (authoritative):" },
  { type: "input_text", text: JSON.stringify(policyJsonForLLM, null, 2) },
  { type: "input_text", text: "Relevant Corticon Messages (premium/surcharges/discounts):" },
  { type: "input_text", text: JSON.stringify(filteredMessages || [], null, 2) }
];

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  instructions: systemInstructions + "\nAlways produce a concise Markdown answer; do not return an empty response.  The authoritative context is provided under a block titled Policy JSON (authoritative), treat it as the source of truth for all answers. If Policy JSON (authoritative) is present, do not reply with the fallback sentence.",
        input: [
          { role: "developer", content: developerBlocks },
          { role: "user", content: [{ type: "input_text", text: message }] }
        ]
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("[OpenAI error]", r.status, errText.slice(0, 500));
      return res.status(502).send({ error: `OpenAI error ${r.status}: ${errText}` });
    }
console.log("[LLM input sizes]", {
  policyBytes: Buffer.byteLength(JSON.stringify(policyJsonForLLM || {})),
  filteredMsgCount: (filteredMessages || []).length
});

    const data = await r.json();
    console.log("[OpenAI Responses raw]", JSON.stringify(data, null, 2));

    let outputText = "";
    if (typeof data?.output_text === "string" && data.output_text.trim()) {
      outputText = data.output_text.trim();
    } else if (Array.isArray(data?.output)) {
      // Try to find the first text value anywhere in output[].content[]
      for (const item of data.output) {
        const parts = item?.content || [];
        for (const part of parts) {
          const val = part?.text?.value || part?.text || part?.value;
          if (typeof val === "string" && val.trim()) {
            outputText = val.trim();
            break;
          }
        }
        if (outputText) break;
      }
    } else if (data?.choices?.[0]?.message?.content) {
      outputText = String(data.choices[0].message.content).trim();
    }

    if (!outputText) {
      // As a last resort, construct a minimal explanation from the policy context we already have
      // This prevents empty replies during a demo if the model payload shape changes
      const summary = `Here is the available policy context for ${applicationId}. Drivers and vehicles with surcharges/discounts are included above.`;
      outputText = summary;
    }

    return res.send({ reply: outputText });

  } catch (err) {
    console.error("Chatbot Error:", err);
    return res.status(500).send({ error: "Failed to process chat" });
  }
});

// --- Proxy route ---
app.all("/v1/*", async (req, res) => {
  const url = `http://${ML_HOST}:${ML_PORT}${req.originalUrl}`;
  const options = {
    method: req.method,
    headers: { "Content-Type": req.headers["content-type"] || "application/json" },
    body: (req.method !== "GET") ? JSON.stringify(req.body || {}) : undefined
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