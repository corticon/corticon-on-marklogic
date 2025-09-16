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
 * Search all policies for the map widget.
 * @param {string} qtext - A full-text query string.
 */
export async function searchPolicies(qtext) {
  if (typeof qtext !== 'string') {
    throw new Error('searchPolicies requires a string query argument.');
  }

  // Use the custom MarkLogic endpoint to handle the search
  const url = `${ML_PROXY_BASE}/resources/${OPTIONS_NAME}?rs:action=searchPolicies&rs:q=${encodeURIComponent(qtext)}`;  
  
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const errorData = await resp.json().catch(() => null);
      if (errorData && errorData.error) {
        throw new Error(`Custom search failed: ${errorData.error}`);
      }
      throw new Error(`Custom search failed. HTTP ${resp.status}`);
    }
    return resp.json();
  } catch (err) {
    console.error("[searchPolicies] Error:", err);
    throw err;
  }
}

/**
 * Search policies by Qtext for the search bar.
 * @param {string} qtext - A full-text query string.
 */
export async function searchPoliciesByQtext(qtext) {
  if (typeof qtext !== 'string') {
    throw new Error('searchPoliciesByQtext requires a string query argument.');
  }

  const url = `${ML_PROXY_BASE}/resources/${OPTIONS_NAME}?rs:action=searchPoliciesByQtext&rs:q=${encodeURIComponent(qtext)}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const errorData = await resp.json().catch(() => null);
      if (errorData && errorData.error) {
        throw new Error(`Custom search failed: ${errorData.error}`);
      }
      throw new Error(`Custom search failed. HTTP ${resp.status}`);
    }
    return resp.json();
  } catch (err) {
    console.error("[searchPoliciesByQtext] Error:", err);
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

    const url = `${ML_PROXY_BASE}/search?${params.toString()}&options=${encodeURIComponent(OPTIONS_NAME)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryBody || {})
    });

    if (!response.ok) {
      // Try to parse the error response from MarkLogic
      const errorData = await response.json().catch(() => null);
      if (errorData && errorData.errorResponse) {
        const { status, message } = errorData.errorResponse;
        throw new Error(`Search failed: ${status} - ${message}`);
      }
      throw new Error(`Search failed. HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("[searchDocuments] Error:", err);
    throw err;
  }
}
export async function getPolicy(applicationId) {
  const url = `${ML_PROXY_BASE}/resources/${OPTIONS_NAME}?rs:action=getPolicy&rs:applicationId=${encodeURIComponent(applicationId)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch policy ${applicationId}`);
  return resp.json();
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


const CHAT_API_BASE = `http://${ML_HOST}:${ML_PORT}/api`;

export async function sendMessage(message) {
  try {
    const response = await fetch(`${CHAT_API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error("Failed to send message");
    }
    return await response.json();
  } catch (err) {
    console.error("[sendMessage] Error:", err);
    throw err;
  }
}