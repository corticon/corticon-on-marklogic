const config = {};

config.project = {
  name: "Decision Ledger Medicaid UI"
};

config.server = {
  port: 14001,
  host: "0.0.0.0"
};

// If your proxy runs on the same machine as MarkLogic, keep localhost.
config.marklogic = {
  host: "localhost",
  restPort: 8003,
  authentication: "digest" // proxy itself uses basic auth header to ML; browser calls the proxy
};

// Use a MarkLogic REST app-reader (or app-admin during development).
config.user = {
  username: "${MARKLOGIC_APP_READER_USERNAME}",
  password: "${MARKLOGIC_APP_READER_PASSWORD}"
};

config.cache = {
  analyticsTtlMs: Number(process.env.ANALYTICS_CACHE_TTL_MS || 15000),
  analyticsMaxEntries: Number(process.env.ANALYTICS_CACHE_MAX_ENTRIES || 200),
  chatbotTtlMs: Number(process.env.CHATBOT_CACHE_TTL_MS || 300000),
  chatbotMaxEntries: Number(process.env.CHATBOT_CACHE_MAX_ENTRIES || 200)
};

config.chatbot = {
  cacheCannedOnly: String(process.env.CHATBOT_CACHE_CANNED_ONLY || "true").toLowerCase() !== "false",
  skipOpenAiForCannedPrompts: String(process.env.CHATBOT_SKIP_OPENAI_FOR_CANNED || "false").toLowerCase() !== "false",
  prewarmCannedPrompts: String(process.env.CHATBOT_PREWARM_CANNED || "true").toLowerCase() !== "false",
  prewarmDelayMs: Number(process.env.CHATBOT_PREWARM_DELAY_MS || 1500),
  // Optional override: concatenate custom canned prompts with "||".
  quickPrompts: (process.env.CHATBOT_QUICK_PROMPTS
    ? String(process.env.CHATBOT_QUICK_PROMPTS).split("||").map((s) => s.trim()).filter(Boolean)
    : [
      "Common ineligibility reasons",
      "Common ineligibility reasons in West Virginia",
      "Why HH-12 ineligible?",
      "Population commonalities by state",
      "Amort family determination overview"
    ])
};

config.chatSessions = {
  ttlMs: Number(process.env.CHAT_SESSION_TTL_MS || 3600000),
  maxTurns: Number(process.env.CHAT_SESSION_MAX_TURNS || 20),
  maxSessions: Number(process.env.CHAT_SESSION_MAX_SESSIONS || 200)
};

// Optional: enable proxy-side MarkLogic retrieval + OpenAI answer synthesis at /api/chatbot.
config.openai = {
  apiKey: process.env.OPENAI_API_KEY || "",
  model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 30000)
};

if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = config;
}
