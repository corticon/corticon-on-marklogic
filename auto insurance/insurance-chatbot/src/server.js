// src/server.js
import express from "express";
import DigestClient from "digest-fetch";
import dotenv from "dotenv";
import path from "path";
import OpenAI from "openai";

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

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

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

// --- RAG-Enabled Chatbot Route ---
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).send({ error: "Message is required" });
  }

  try {
    const policyIdMatch = message.match(/[0-9A-Z]{20,}/);
    let finalPrompt;

    if (policyIdMatch) {
      const applicationId = policyIdMatch[0];
      console.log(`[Chatbot] Found policy ID: ${applicationId}. Fetching data...`);
      const url = `http://${ML_HOST}:${ML_PORT}/v1/resources/${OPTIONS_NAME}?rs:action=getPolicy&rs:applicationId=${encodeURIComponent(applicationId)}`;
      const policyResponse = await client.fetch(url);

      if (policyResponse.ok) {
        let policyData = await policyResponse.json(); // Use 'let' to allow modification
        console.log(`[Chatbot] Successfully fetched data for policy ${applicationId}.`);

        // --- FIX: REMOVE THE LARGE METRICS OBJECT TO REDUCE TOKEN COUNT ---
        if (policyData && policyData.corticon && policyData.corticon.Metrics) {
          delete policyData.corticon.Metrics;
          console.log('[Chatbot] Removed corticon.Metrics to reduce prompt size.');
        }

        finalPrompt = `You are a specialized data retrieval engine named the **Corticon Policy Explainer**. Your only function is to process and explain a single JSON document about an insurance policy.
          **CRITICAL DIRECTIVES:**
          1. **YOU HAVE NO EXTERNAL KNOWLEDGE.** Your entire universe of information is the single JSON document provided below under "Policy Data."
          2. **STRICTLY ADHERE TO THE DATA.** If the user asks a question that cannot be answered using *only* the provided JSON document, you MUST reply with the following exact sentence and nothing more: "I can only provide information based on the specific policy data I have been given. Please ask a question about the loaded policy by providing its ID."
          3. **DO NOT BE CONVERSATIONAL.** Do not apologize. Do not suggest other ways to find information.
          4. **FOCUS ON EXPLAINABILITY.** Your primary purpose is to explain the "why" behind the policy's details by directly referencing the \`corticon.messages\` array in the JSON.
          **RESPONSE FORMAT:**
          * **Greeting:** Start with "Here is the explanation for policy \`${applicationId}\`."
          * **Summary:** Provide a brief, one-paragraph summary of the policy.
          * **Detailed Breakdown:** Use Markdown headings for sections like \`### Driver Analysis\` and \`### Discounts and Surcharges\`.
          * **Corticon Explanations:** For every discount or surcharge, you must quote or reference the corresponding message from the \`corticon.messages\` array.
          **Policy Data:**
          ${JSON.stringify(policyData, null, 2)}
          **User's Question:**
          "${message}"`;
      } else {
        finalPrompt = `The user asked about policy "${applicationId}", but I could not retrieve the data. You must respond with only this exact phrase: "I can only provide information based on the specific policy data I have been given. Please ask about a specific policy by providing its ID."`;
      }
    } else {
      finalPrompt = `You are a specialized data retrieval engine. The user has asked a question but has not provided a policy ID. You must respond with only this exact phrase: "I can only provide information based on the specific policy data I have been given. Please ask about a specific policy by providing its ID." User's question: "${message}"`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: finalPrompt }],
    });

    const botMessage = completion.choices[0].message.content;
    res.send({ reply: botMessage });

  } catch (err) {
    console.error("[Chatbot Error]", err);
    res.status(500).send({ error: "Failed to get response from OpenAI" });
  }
});

// --- Proxy route ---
app.all('/v1/*', async (req, res) => {
  const url = `http://${ML_HOST}:${ML_PORT}${req.originalUrl}`;
  const options = {
    method: req.method,
    headers: { "Content-Type": req.headers['content-type'] || "application/json" },
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