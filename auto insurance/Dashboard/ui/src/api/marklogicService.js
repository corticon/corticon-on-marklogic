// src/api/marklogicService.js

// Build the proxy base from env so local overrides work in Vite
const ML_HOST = import.meta.env.VITE_ML_HOST || "localhost";
const ML_PORT = import.meta.env.VITE_ML_PORT || "4004"; // middle tier port
const ML_PROXY_BASE = `http://${ML_HOST}:${ML_PORT}/v1`;

// Ensure declared const; use env or default
const OPTIONS_NAME = import.meta.env.VITE_ML_OPTIONS || "corticonml-options";

/**
 * Fetch a single document by URI
 * @param {string} uri - e.g. "/data/policy-input/01K4AYBA202YG995ETCDXZV62D.json"
 */
export async function getDocument(uri) {
  try {
    const response = await fetch(
      `${ML_PROXY_BASE}/documents?uri=${encodeURIComponent(uri)}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch document. HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("[getDocument] Error:", err);
    throw err;
  }
}

/**
 * Search documents with a MarkLogic query.
 * queryBody example:
 * { qtext: "virginia" }
 * { query: { queries: [{ "range-constraint-query": { "constraint-name":"state","value":["Virginia"] } }] } }
 * options: { format?: "json"|"xml", pageLength?: number, start?: number }
 */
export async function searchDocuments(queryBody, options = {}) {
  try {
    const params = new URLSearchParams({
      format: options.format || "json",
      pageLength: String(options.pageLength || 10),
      start: String(options.start || 1)
    });

    // Always include the named options so constraints/facets match server config
    const url = `${ML_PROXY_BASE}/search?${params.toString()}&options=${encodeURIComponent(OPTIONS_NAME)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryBody || {})
    });

    if (!response.ok) {
      throw new Error(`Search failed. HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("[searchDocuments] Error:", err);
    throw err;
  }
}

/**
 * Convenience: qtext-only search
 */
export async function searchByQtext(qtext, options = {}) {
  return searchDocuments({ qtext: qtext || "" }, options);
}

/**
 * Convenience: search by policy ID
 */
export async function searchByApplicationId (applicationId, options = {}) {
  const query = {
    "query": {
      "queries": [
        {
          "value-query": {
            "json-property": "applicationId",
            "text": [applicationId] 
          }
        }
      ]
    }
  };
  // Pass the 'query' object directly
  return searchDocuments(query, options);
}