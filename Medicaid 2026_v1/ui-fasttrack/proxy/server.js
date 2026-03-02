const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const crypto = require("node:crypto");
const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");

const config = require("./config");
const { handleSearchRes } = require("./handlers");

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

const mlHost = config.marklogic.host;
const mlPort = config.marklogic.restPort;
const restUrl = `http://${mlHost}:${mlPort}`;
const basicAuthHeader = `Basic ${Buffer.from(`${config.user.username}:${config.user.password}`).toString("base64")}`;
let reqSeq = 0;
const analyticsCache = new Map();
const analyticsInFlight = new Map();
const chatbotCache = new Map();
const chatbotInFlight = new Map();
const chatSessions = new Map();

function nowMs() {
  return Date.now();
}

function logLine(label, details) {
  console.log(`[proxy:${label}] ${details}`);
}

function normalizeQuestionForCache(question) {
  return String(question || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function chatbotQuickPrompts() {
  return (config.chatbot && Array.isArray(config.chatbot.quickPrompts) && config.chatbot.quickPrompts.length)
    ? config.chatbot.quickPrompts
    : [
      "Common ineligibility reasons",
      "Common ineligibility reasons in West Virginia",
      "Why HH-12 ineligible?",
      "Population commonalities by state",
      "Amort family determination overview"
    ];
}

function isCannedPrompt(question) {
  const target = normalizeQuestionForCache(question);
  const prompts = chatbotQuickPrompts();
  for (let i = 0; i < prompts.length; i++) {
    if (normalizeQuestionForCache(prompts[i]) === target) return true;
  }
  return false;
}

function chatbotCacheEnabled() {
  return Boolean(config.cache && Number(config.cache.chatbotTtlMs || 0) > 0);
}

function chatbotCacheTtlMs() {
  return Math.max(0, Number(config.cache && config.cache.chatbotTtlMs) || 0);
}

function chatbotCacheMaxEntries() {
  return Math.max(1, Number(config.cache && config.cache.chatbotMaxEntries) || 200);
}

function chatbotCacheCannedOnly() {
  const value = config.chatbot && config.chatbot.cacheCannedOnly;
  return value === undefined ? true : Boolean(value);
}

function chatbotSkipOpenAiForCannedPrompts() {
  const value = config.chatbot && config.chatbot.skipOpenAiForCannedPrompts;
  return value === undefined ? false : Boolean(value);
}

function shouldCacheChatbotQuestion(question) {
  if (!chatbotCacheEnabled()) return false;
  if (chatbotCacheCannedOnly()) return isCannedPrompt(question);
  return true;
}

function shouldSkipOpenAiForQuestion(question) {
  if (chatbotSkipOpenAiForCannedPrompts() && isCannedPrompt(question)) return true;
  return false;
}

function chatbotPrewarmEnabled() {
  const value = config.chatbot && config.chatbot.prewarmCannedPrompts;
  return value === undefined ? true : Boolean(value);
}

function chatbotPrewarmDelayMs() {
  return Math.max(0, Number(config.chatbot && config.chatbot.prewarmDelayMs) || 1500);
}

function chatbotCacheKey(question, options) {
  const norm = normalizeQuestionForCache(question);
  const llmMode = options && options.skipOpenAi ? "no-llm" : `llm:${(config.openai && config.openai.model) || "none"}`;
  return `${llmMode}|${norm}`;
}

function pruneChatbotCache(now) {
  const ttl = chatbotCacheTtlMs();
  for (const [key, entry] of chatbotCache.entries()) {
    if (!entry || !entry.expiresAt || entry.expiresAt <= now) chatbotCache.delete(key);
  }
  const maxEntries = chatbotCacheMaxEntries();
  if (chatbotCache.size <= maxEntries) return;
  const items = Array.from(chatbotCache.entries())
    .sort((a, b) => (a[1].storedAt || 0) - (b[1].storedAt || 0));
  while (chatbotCache.size > maxEntries && items.length) {
    const [key] = items.shift();
    chatbotCache.delete(key);
  }
}

async function prewarmCannedChatbotPrompts(baseUrl) {
  if (!chatbotPrewarmEnabled()) {
    logLine("chat-prewarm", "disabled");
    return;
  }
  if (!chatbotCacheEnabled()) {
    logLine("chat-prewarm", "skipped (chatbot cache disabled)");
    return;
  }

  const prompts = chatbotQuickPrompts();
  logLine("chat-prewarm", `start prompts=${prompts.length}`);

  for (let i = 0; i < prompts.length; i++) {
    const q = prompts[i];
    if (!shouldCacheChatbotQuestion(q)) continue;
    const cacheKey = chatbotCacheKey(q, { skipOpenAi: shouldSkipOpenAiForQuestion(q) });
    const existing = chatbotCache.get(cacheKey);
    if (existing && existing.expiresAt > nowMs()) {
      logLine("chat-prewarm", `hit ${cacheKey}`);
      continue;
    }

    const started = nowMs();
    try {
      const resp = await fetch(`${baseUrl}/api/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: q, newSession: true })
      });
      const text = await resp.text();
      if (!resp.ok) {
        logLine("chat-prewarm", `fail status=${resp.status} q="${q.slice(0, 80)}" body=${text.slice(0, 160)}`);
      } else {
        logLine("chat-prewarm", `ok ${nowMs() - started}ms q="${q.slice(0, 80)}"`);
      }
    } catch (e) {
      logLine("chat-prewarm", `error q="${q.slice(0, 80)}" err=${e.message}`);
    }
  }
  logLine("chat-prewarm", "done");
}

function analyticsCacheKey(req) {
  return `${req.method} ${req.originalUrl}`;
}

function analyticsCacheEnabled() {
  return Boolean(config.cache && Number(config.cache.analyticsTtlMs) > 0);
}

function analyticsCacheTtlMs() {
  return Math.max(0, Number(config.cache && config.cache.analyticsTtlMs) || 0);
}

function analyticsCacheMaxEntries() {
  return Math.max(1, Number(config.cache && config.cache.analyticsMaxEntries) || 200);
}

function shouldBypassAnalyticsCache(req) {
  const q = req.query || {};
  const v = q["cache"] ?? q["rs:cache"] ?? q["rs:cacheEnabled"];
  if (v === undefined || v === null) return false;
  const s = String(v).toLowerCase();
  return s === "false" || s === "0" || s === "no" || s === "off";
}

function analyticsUpstreamPath(req) {
  const original = new URL(req.originalUrl, "http://proxy.local");
  const removeKeys = ["cache", "rs:cache", "rs:cacheEnabled"];
  removeKeys.forEach((k) => original.searchParams.delete(k));
  const qs = original.searchParams.toString();
  return `${original.pathname}${qs ? `?${qs}` : ""}`;
}

function pruneAnalyticsCache(now) {
  const ttl = analyticsCacheTtlMs();
  for (const [key, entry] of analyticsCache.entries()) {
    if (!entry || !entry.expiresAt || entry.expiresAt <= now) analyticsCache.delete(key);
  }

  const maxEntries = analyticsCacheMaxEntries();
  if (analyticsCache.size <= maxEntries) return;

  const items = Array.from(analyticsCache.entries())
    .sort((a, b) => (a[1].storedAt || 0) - (b[1].storedAt || 0));
  while (analyticsCache.size > maxEntries && items.length) {
    const item = items.shift();
    analyticsCache.delete(item[0]);
  }
}

function chatSessionConfig() {
  return {
    ttlMs: Math.max(60000, Number(config.chatSessions && config.chatSessions.ttlMs) || 3600000),
    maxTurns: Math.max(1, Number(config.chatSessions && config.chatSessions.maxTurns) || 20),
    maxSessions: Math.max(1, Number(config.chatSessions && config.chatSessions.maxSessions) || 200)
  };
}

function generateSessionId() {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function pruneChatSessions(now) {
  const cfg = chatSessionConfig();
  for (const [sid, session] of chatSessions.entries()) {
    if (!session || !session.updatedAt || (now - session.updatedAt) > cfg.ttlMs) {
      chatSessions.delete(sid);
    }
  }
  if (chatSessions.size <= cfg.maxSessions) return;
  const ordered = Array.from(chatSessions.entries())
    .sort((a, b) => (a[1].updatedAt || 0) - (b[1].updatedAt || 0));
  while (chatSessions.size > cfg.maxSessions && ordered.length) {
    const item = ordered.shift();
    chatSessions.delete(item[0]);
  }
}

function getOrCreateChatSession(sessionId, options) {
  const now = nowMs();
  const cfg = chatSessionConfig();
  pruneChatSessions(now);

  let session = null;
  let effectiveId = null;
  if (sessionId) {
    effectiveId = String(sessionId);
    session = chatSessions.get(effectiveId) || null;
  }

  if (!session || (options && options.reset)) {
    effectiveId = generateSessionId();
    session = {
      sessionId: effectiveId,
      createdAt: now,
      updatedAt: now,
      turns: []
    };
    chatSessions.set(effectiveId, session);
    return { session, isNew: true };
  }

  session.updatedAt = now;
  if (!Array.isArray(session.turns)) session.turns = [];
  chatSessions.set(effectiveId, session);
  return { session, isNew: false };
}

function sessionMeta(session) {
  return {
    sessionId: session.sessionId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    turnCount: Array.isArray(session.turns) ? session.turns.length : 0
  };
}

function appendChatTurn(session, turn) {
  const now = nowMs();
  const cfg = chatSessionConfig();
  if (!Array.isArray(session.turns)) session.turns = [];
  session.turns.push({
    turnId: `turn_${now}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    ...turn
  });
  if (session.turns.length > cfg.maxTurns) {
    session.turns = session.turns.slice(session.turns.length - cfg.maxTurns);
  }
  session.updatedAt = now;
  chatSessions.set(session.sessionId, session);
}

function compactRetrievalForSession(retrieval) {
  return {
    intent: retrieval && retrieval.intent || null,
    matchCount: retrieval && retrieval.matchCount || 0,
    responseDraft: retrieval && retrieval.responseDraft || null,
    topReasons: retrieval && retrieval.analytics && Array.isArray(retrieval.analytics.topIneligibilityReasons) ? retrieval.analytics.topIneligibilityReasons.slice(0, 3) : [],
    topRulesheets: retrieval && retrieval.ruleInfluence && Array.isArray(retrieval.ruleInfluence.topRulesheets) ? retrieval.ruleInfluence.topRulesheets.slice(0, 3) : [],
    matches: retrieval && Array.isArray(retrieval.matches) ? retrieval.matches.slice(0, 5) : []
  };
}

function buildChatbotResponsePayload(args) {
  const {
    retrieval,
    answerText,
    llm,
    session,
    sessionHistoryUsed,
    question,
    retrievalQuestion,
    retrievalFallbackUsed,
    startMs,
    cache
  } = args;

  return {
    ...retrieval,
    responseDraft: answerText || retrieval.responseDraft || "",
    answerText: answerText || null,
    sessionId: session.sessionId,
    session: sessionMeta(session),
    sessionHistoryUsed: sessionHistoryUsed || 0,
    retrieval: {
      originalQuestion: question,
      effectiveQuestion: retrievalQuestion,
      retryWithSessionContext: Boolean(retrievalFallbackUsed)
    },
    llm: llm,
    cache: cache || { enabled: false },
    proxy: {
      route: "/api/chatbot",
      durationMs: nowMs() - startMs
    }
  };
}

function reusableChatbotCachePayload(args) {
  return {
    retrieval: args.retrieval,
    answerText: args.answerText || null,
    llm: args.llm,
    retrievalQuestion: args.retrievalQuestion,
    retrievalFallbackUsed: Boolean(args.retrievalFallbackUsed)
  };
}

function recentSessionHistory(session, limit) {
  if (!session || !Array.isArray(session.turns)) return [];
  const n = Math.max(1, limit || 6);
  return session.turns.slice(Math.max(0, session.turns.length - n)).map((turn) => ({
    user: turn.userQuestion || "",
    assistant: turn.answerText || turn.responseDraft || "",
    intent: turn.intent || null,
    matchCount: turn.matchCount || 0
  }));
}

function shouldRetryRetrievalWithSession(question, retrieval, session) {
  if (!session || !Array.isArray(session.turns) || !session.turns.length) return false;
  if (!question || String(question).trim().length > 120) return false;
  if (!retrieval) return false;
  const noMatches = !retrieval.matchCount && !(retrieval.analytics && retrieval.analytics.topIneligibilityReasons && retrieval.analytics.topIneligibilityReasons.length);
  if (!noMatches) return false;
  return true;
}

function buildSessionAwareRetrievalQuestion(question, session) {
  const history = recentSessionHistory(session, 2);
  if (!history.length) return question;
  const last = history[history.length - 1];
  if (!last || !last.user) return question;
  return `${last.user}\nFollow-up: ${question}`;
}

function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch (e) {
    return null;
  }
}

function extractOpenAiText(payload) {
  if (!payload) return "";
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();

  var out = [];
  var output = Array.isArray(payload.output) ? payload.output : [];
  for (var i = 0; i < output.length; i++) {
    var item = output[i] || {};
    var content = Array.isArray(item.content) ? item.content : [];
    for (var j = 0; j < content.length; j++) {
      var part = content[j] || {};
      if (typeof part.text === "string" && part.text.trim()) out.push(part.text.trim());
    }
  }
  return out.join("\n\n").trim();
}

async function fetchMarkLogicJson(path, options) {
  const start = nowMs();
  const response = await fetch(`${restUrl}${path}`, {
    method: (options && options.method) || "GET",
    headers: {
      Accept: "application/json",
      Authorization: basicAuthHeader,
      ...(options && options.body ? { "Content-Type": "application/json" } : {})
    },
    body: options && options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const data = safeJsonParse(text) || { raw: text };
  logLine("ml", `${(options && options.method) || "GET"} ${path} -> ${response.status} (${nowMs() - start}ms)`);

  if (!response.ok) {
    const err = new Error(data?.errorResponse?.message || data?.message || `MarkLogic request failed (${response.status})`);
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  return data;
}

async function callOpenAi(question, retrievalPayload, options) {
  const apiKey = config.openai && config.openai.apiKey;
  if (!apiKey) {
    return {
      enabled: false,
      used: false,
      reason: "OPENAI_API_KEY not configured",
      answerText: null
    };
  }

  const controller = new AbortController();
  const timeoutMs = (config.openai && config.openai.timeoutMs) || 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = nowMs();

  try {
    const sessionHistory = Array.isArray(options && options.sessionHistory) ? options.sessionHistory : [];
    const promptContext = {
      intent: retrievalPayload.intent || null,
      matchCount: retrievalPayload.matchCount || 0,
      matches: Array.isArray(retrievalPayload.matches) ? retrievalPayload.matches.slice(0, 10) : [],
      analytics: retrievalPayload.analytics || null,
      ruleInfluence: retrievalPayload.ruleInfluence || null,
      suggestedActions: retrievalPayload.suggestedActions || [],
      citations: retrievalPayload.citations || [],
      sessionHistory: sessionHistory
    };

    const resp = await fetch(`${config.openai.baseUrl}/responses`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.openai.model,
        instructions: [
          "You are a Medicaid eligibility support assistant for operations analysts and customer support agents.",
          "Use only the supplied retrieval context from MarkLogic.",
          "If the context is insufficient, say so explicitly and suggest a follow-up filter/query.",
          "Do not invent household facts or legal policy requirements."
        ].join(" "),
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: `Question: ${question}` },
              { type: "input_text", text: sessionHistory.length ? `Recent conversation history (JSON): ${JSON.stringify(sessionHistory)}` : "Recent conversation history (JSON): []" },
              { type: "input_text", text: `Retrieved context (JSON): ${JSON.stringify(promptContext)}` }
            ]
          }
        ],
        max_output_tokens: 700
      })
    });

    const text = await resp.text();
    const payload = safeJsonParse(text) || { raw: text };
    const durationMs = nowMs() - start;

    if (!resp.ok) {
      logLine("openai", `responses -> ${resp.status} (${durationMs}ms)`);
      return {
        enabled: true,
        used: false,
        reason: payload?.error?.message || `OpenAI request failed (${resp.status})`,
        model: config.openai.model,
        durationMs,
        raw: payload
      };
    }

    const answerText = extractOpenAiText(payload);
    logLine("openai", `responses -> ${resp.status} (${durationMs}ms) model=${config.openai.model}`);
    return {
      enabled: true,
      used: true,
      model: config.openai.model,
      durationMs,
      answerText: answerText || null,
      responseId: payload.id || null
    };
  } catch (e) {
    return {
      enabled: true,
      used: false,
      reason: e.name === "AbortError" ? "OpenAI request timed out" : e.message,
      model: config.openai.model,
      durationMs: nowMs() - start
    };
  } finally {
    clearTimeout(timeout);
  }
}

function createTimedProxyLogMiddleware() {
  return function proxyReqTimer(req, res, next) {
    const id = ++reqSeq;
    req._proxyReqId = id;
    req._proxyStartMs = nowMs();
    logLine("req", `#${id} ${req.method} ${req.originalUrl}`);
    res.on("finish", () => {
      const dur = req._proxyStartMs ? (nowMs() - req._proxyStartMs) : 0;
      logLine("res", `#${id} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${dur}ms)`);
    });
    next();
  };
}

app.use(createTimedProxyLogMiddleware());

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    project: config.project.name,
    proxyTarget: restUrl,
    openaiConfigured: Boolean(config.openai && config.openai.apiKey)
  });
});

app.get("/api/endpoints", (req, res) => {
  res.json({
    ok: true,
    endpoints: {
      determinations: {
        method: "GET",
        path: "/v1/resources/eligibilityDeterminations",
        examples: [
          "/v1/resources/eligibilityDeterminations?rs:page=1&rs:pageLength=25",
          "/v1/resources/eligibilityDeterminations?rs:eligibility=Ineligible&rs:state=West%20Virginia"
        ]
      },
      analytics: {
        method: "GET",
        path: "/v1/resources/analytics",
        actions: [
          "dashboard",
          "summary",
          "ineligibility-reasons",
          "geographic-commonalities",
          "cohort-commonalities",
          "rules-by-program"
        ]
      },
      chatbot: {
        methods: ["GET", "POST"],
        path: "/v1/resources/chatbot"
      },
      openaiChatbot: {
        method: "POST",
        path: "/api/chatbot",
        description: "Proxy orchestration: MarkLogic retrieval + optional OpenAI answer synthesis"
      }
    }
  });
});

app.get("/v1/resources/analytics", async (req, res) => {
  const key = analyticsCacheKey(req);
  const ttlMs = analyticsCacheTtlMs();
  const cacheEnabled = analyticsCacheEnabled() && !shouldBypassAnalyticsCache(req);
  const now = nowMs();

  if (cacheEnabled) {
    const cached = analyticsCache.get(key);
    if (cached && cached.expiresAt > now) {
      logLine("cache", `HIT ${key} (age=${now - cached.storedAt}ms ttl=${ttlMs}ms)`);
      res.setHeader("x-proxy-cache", "HIT");
      return res.json(cached.payload);
    }
    if (cached) {
      logLine("cache", `STALE ${key}`);
      analyticsCache.delete(key);
    } else {
      logLine("cache", `MISS ${key}`);
    }

    if (analyticsInFlight.has(key)) {
      logLine("cache", `WAIT ${key}`);
      try {
        const payload = await analyticsInFlight.get(key);
        res.setHeader("x-proxy-cache", "HIT-INFLIGHT");
        return res.json(payload);
      } catch (e) {
        return res.status(e.status || 502).json({
          ok: false,
          error: e.message || "Analytics request failed",
          details: e.payload || null
        });
      }
    }
  } else {
    logLine("cache", `BYPASS ${key}`);
  }

  const promise = (async () => {
    const payload = await fetchMarkLogicJson(analyticsUpstreamPath(req));
    if (cacheEnabled) {
      analyticsCache.set(key, {
        storedAt: nowMs(),
        expiresAt: nowMs() + ttlMs,
        payload: payload
      });
      pruneAnalyticsCache(nowMs());
    }
    return payload;
  })();

  if (cacheEnabled) analyticsInFlight.set(key, promise);

  try {
    const payload = await promise;
    res.setHeader("x-proxy-cache", cacheEnabled ? "MISS" : "BYPASS");
    return res.json(payload);
  } catch (e) {
    return res.status(e.status || 502).json({
      ok: false,
      error: e.message || "Analytics request failed",
      details: e.payload || null
    });
  } finally {
    if (cacheEnabled) analyticsInFlight.delete(key);
  }
});

app.post("/api/chatbot", async (req, res) => {
  const start = nowMs();
  const question = String(req.body?.query || req.body?.question || req.body?.prompt || "").trim();
  if (!question) {
    return res.status(400).json({
      ok: false,
      error: "Request body requires 'query' (or 'question'/'prompt')"
    });
  }

  try {
    const requestedSessionId = req.body?.sessionId ? String(req.body.sessionId) : "";
    const resetSession = Boolean(req.body?.resetSession || req.body?.newSession);
    const sessionState = getOrCreateChatSession(requestedSessionId, { reset: resetSession });
    const session = sessionState.session;
    const sessionHistory = recentSessionHistory(session, 6);
    const forceOpenAi = Boolean(req.body?.forceOpenAi || req.body?.useOpenAi === true);
    const skipOpenAi = !forceOpenAi && shouldSkipOpenAiForQuestion(question);
    const cacheEligible = shouldCacheChatbotQuestion(question);
    const cacheKey = cacheEligible ? chatbotCacheKey(question, { skipOpenAi }) : null;
    const cacheTtl = chatbotCacheTtlMs();

    const finalizeAndRespond = (basePayload, cacheInfo) => {
      appendChatTurn(session, {
        userQuestion: question,
        retrievalQuestion: basePayload.retrievalQuestion,
        retrievalFallbackUsed: basePayload.retrievalFallbackUsed,
        intent: basePayload.retrieval.intent || null,
        matchCount: basePayload.retrieval.matchCount || 0,
        retrievalSummary: compactRetrievalForSession(basePayload.retrieval),
        responseDraft: basePayload.retrieval.responseDraft || "",
        answerText: basePayload.answerText || "",
        llm: {
          enabled: Boolean(basePayload.llm && basePayload.llm.enabled),
          used: Boolean(basePayload.llm && basePayload.llm.used),
          model: basePayload.llm && basePayload.llm.model || null,
          durationMs: basePayload.llm && basePayload.llm.durationMs || null
        }
      });

      const responsePayload = buildChatbotResponsePayload({
        retrieval: basePayload.retrieval,
        answerText: basePayload.answerText,
        llm: basePayload.llm,
        session: session,
        sessionHistoryUsed: sessionHistory.length,
        question: question,
        retrievalQuestion: basePayload.retrievalQuestion,
        retrievalFallbackUsed: basePayload.retrievalFallbackUsed,
        startMs: start,
        cache: cacheInfo
      });

      if (cacheInfo && cacheInfo.status) {
        res.setHeader("x-proxy-chat-cache", cacheInfo.status);
      }
      return res.json(responsePayload);
    };

    if (cacheEligible) {
      const now = nowMs();
      const cached = chatbotCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        logLine("chat-cache", `HIT ${cacheKey} (age=${now - cached.storedAt}ms ttl=${cacheTtl}ms)`);
        return finalizeAndRespond(cached.payload, {
          enabled: true,
          eligible: true,
          key: cacheKey,
          status: "HIT",
          ageMs: now - cached.storedAt
        });
      }
      if (cached) chatbotCache.delete(cacheKey);

      if (chatbotInFlight.has(cacheKey)) {
        logLine("chat-cache", `WAIT ${cacheKey}`);
        try {
          const payload = await chatbotInFlight.get(cacheKey);
          return finalizeAndRespond(payload, {
            enabled: true,
            eligible: true,
            key: cacheKey,
            status: "HIT-INFLIGHT"
          });
        } catch (e) {
          throw e;
        }
      }
      logLine("chat-cache", `MISS ${cacheKey}`);
    } else {
      logLine("chat-cache", `BYPASS question="${question.slice(0, 80)}"`);
    }

    const buildBasePayloadPromise = (async () => {
      logLine("chat", `retrieval start session=${session.sessionId} question="${question.slice(0, 120)}"`);
      let retrievalQuestion = question;
      let retrieval = await fetchMarkLogicJson("/v1/resources/chatbot", {
        method: "POST",
        body: { query: retrievalQuestion }
      });
      let retrievalFallbackUsed = false;

      if (shouldRetryRetrievalWithSession(question, retrieval, session)) {
        const retryQuestion = buildSessionAwareRetrievalQuestion(question, session);
        if (retryQuestion && retryQuestion !== question) {
          logLine("chat", `retrieval retry-with-session session=${session.sessionId}`);
          retrieval = await fetchMarkLogicJson("/v1/resources/chatbot", {
            method: "POST",
            body: { query: retryQuestion }
          });
          retrievalQuestion = retryQuestion;
          retrievalFallbackUsed = true;
        }
      }

      let openai;
      if (skipOpenAi) {
        openai = {
          enabled: Boolean(config.openai && config.openai.apiKey),
          used: false,
          reason: "Skipped OpenAI for canned prompt fast path",
          model: config.openai && config.openai.model || null,
          durationMs: 0,
          fastPath: true
        };
        logLine("chat", `openai skipped fast-path session=${session.sessionId}`);
      } else {
        openai = await callOpenAi(question, retrieval, {
          sessionHistory: sessionHistory,
          sessionId: session.sessionId
        });
      }

      const answerText = openai.used && openai.answerText ? openai.answerText : (retrieval.responseDraft || "");
      return reusableChatbotCachePayload({
        retrieval,
        answerText,
        llm: openai,
        retrievalQuestion,
        retrievalFallbackUsed
      });
    })();

    if (cacheEligible) chatbotInFlight.set(cacheKey, buildBasePayloadPromise);

    try {
      const basePayload = await buildBasePayloadPromise;
      if (cacheEligible) {
        chatbotCache.set(cacheKey, {
          storedAt: nowMs(),
          expiresAt: nowMs() + cacheTtl,
          payload: basePayload
        });
        pruneChatbotCache(nowMs());
      }

      return finalizeAndRespond(basePayload, {
        enabled: cacheEligible,
        eligible: cacheEligible,
        key: cacheKey,
        status: cacheEligible ? "MISS" : "BYPASS"
      });
    } finally {
      if (cacheEligible) chatbotInFlight.delete(cacheKey);
    }
  } catch (e) {
    res.status(e.status || 502).json({
      ok: false,
      error: e.message || "Chatbot proxy request failed",
      details: e.payload || null,
      sessionId: req.body?.sessionId || null,
      proxy: { route: "/api/chatbot", durationMs: nowMs() - start }
    });
  }
});

function joinProxyPath(prefix, path) {
  var p = String(path || "");
  if (p === "/" || p === "") return prefix;
  return `${prefix}${p}`;
}

function createTransformProxy(label, upstreamPrefix, transformFn) {
  return createProxyMiddleware({
    target: restUrl,
    changeOrigin: true,
    auth: `${config.user.username}:${config.user.password}`,
    pathRewrite(path) {
      return joinProxyPath(upstreamPrefix, path);
    },
    selfHandleResponse: true,
    proxyTimeout: 120000,
    timeout: 120000,
    onProxyReq(proxyReq, req) {
      logLine(label, `upstream ${req.method} ${req.originalUrl}`);
    },
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      const started = req._proxyStartMs || nowMs();
      const upstreamStatus = proxyRes && proxyRes.statusCode;
      try {
        const out = transformFn(responseBuffer, proxyRes, req, res);
        logLine(label, `done ${req.method} ${req.originalUrl} -> ${upstreamStatus} (${nowMs() - started}ms)`);
        return out;
      } catch (e) {
        logLine(label, `transform-error ${req.method} ${req.originalUrl}: ${e.message}`);
        res.statusCode = 502;
        return JSON.stringify({
          ok: false,
          error: "Proxy response transform failed",
          details: e.message
        });
      }
    }),
    onError(err, req, res) {
      logLine(label, `proxy-error ${req.method} ${req.originalUrl}: ${err.message}`);
      res.status(502).json({ ok: false, error: "Proxy error", details: err.message });
    }
  });
}

// Only search needs response interception/parsing. Documents are streamed directly to avoid
// buffering large decision payloads and timing out/empty replies.
app.use("/v1/search", createTransformProxy("search", "/v1/search", handleSearchRes));
app.use("/v1/documents", createProxyMiddleware({
  target: restUrl,
  changeOrigin: true,
  auth: `${config.user.username}:${config.user.password}`,
  pathRewrite(path) {
    return joinProxyPath("/v1/documents", path);
  },
  proxyTimeout: 120000,
  timeout: 120000,
  onProxyReq(proxyReq, req) {
    logLine("docs", `upstream ${req.method} ${req.originalUrl}`);
  },
  onProxyRes(proxyRes, req) {
    logLine("docs", `upstream-res ${req.method} ${req.originalUrl} -> ${proxyRes.statusCode}`);
  },
  onError(err, req, res) {
    logLine("docs", `proxy-error ${req.method} ${req.originalUrl}: ${err.message}`);
    res.status(502).json({ ok: false, error: "Proxy error", details: err.message });
  }
}));

app.use("/v1", createProxyMiddleware({
  target: restUrl,
  changeOrigin: true,
  auth: `${config.user.username}:${config.user.password}`,
  pathRewrite(path) {
    return joinProxyPath("/v1", path);
  },
  proxyTimeout: 120000,
  timeout: 120000,
  onProxyReq(proxyReq, req) {
    logLine("v1", `upstream ${req.method} ${req.originalUrl}`);
  },
  onProxyRes(proxyRes, req) {
    logLine("v1", `upstream-res ${req.method} ${req.originalUrl} -> ${proxyRes.statusCode}`);
  },
  onError(err, req, res) {
    logLine("v1", `proxy-error ${req.method} ${req.originalUrl}: ${err.message}`);
    res.status(502).json({ ok: false, error: "Proxy error", details: err.message });
  }
}));

const host = (config.server && config.server.host) || "0.0.0.0";
const port = (config.server && config.server.port) || 14001;

app.listen(port, host, () => {
  console.log(`FastTrack proxy listening on http://${host}:${port}`);
  console.log(`Proxying MarkLogic REST to ${restUrl}`);
  console.log(`OpenAI relay ${config.openai && config.openai.apiKey ? "enabled" : "disabled"} (model=${config.openai.model})`);
  const prewarmBaseUrl = `http://127.0.0.1:${port}`;
  setTimeout(() => {
    prewarmCannedChatbotPrompts(prewarmBaseUrl).catch((e) => {
      logLine("chat-prewarm", `unexpected-error ${e.message}`);
    });
  }, chatbotPrewarmDelayMs());
});
