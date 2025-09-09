// src/api/marklogicService.js

// Build the proxy base from env so local overrides work in Vite
const ML_HOST = import.meta.env.VITE_ML_HOST || "localhost";
const ML_PORT = import.meta.env.VITE_ML_PORT || "4004"; // middle tier port
const ML_PROXY_BASE = `http://${ML_HOST}:${ML_PORT}/v1`;

// Options resource name
const OPTIONS_NAME = import.meta.env.VITE_ML_OPTIONS || "corticonml-options";

// Convenience base URL for resource calls
const RESOURCE_BASE = `${ML_PROXY_BASE}/resources/${OPTIONS_NAME}`;

/**
 * Fetch a single document by URI
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

// Search policies using the REST resource
export async function searchPolicies(q) {
  const url = `${RESOURCE_BASE}?rs:action=searchPolicies&rs:q=${encodeURIComponent(q)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to search policies`);
  return resp.json(); // { results: [...], count: n }
}

// Fetch a policy by applicationId
export async function getPolicy(applicationId) {
  const url = `${RESOURCE_BASE}?rs:action=getPolicy&rs:applicationId=${applicationId}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch policy ${applicationId}`);
  return resp.json();
}

/**
 * General document search
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

/**
 * Convenience qtext search
 */
export async function searchByQtext(qtext, options = {}) {
  return searchDocuments({ qtext: qtext || "" }, options);
}

/**
 * Convenience search by applicationId
 */
export async function searchByApplicationId(applicationId, options = {}) {
  const query = {
    query: {
      queries: [
        {
          "value-query": {
            "json-property": "applicationId",
            text: [applicationId]
          }
        }
      ]
    }
  };
  return searchDocuments(query, options);
}
