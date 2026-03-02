function buildQueryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string" && value.trim() === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

const DEBUG_BROWSER =
  (typeof import.meta !== "undefined" && import.meta.env && (
    import.meta.env.DEV ||
    String(import.meta.env.VITE_DEBUG_LOGGING || "").toLowerCase() === "true"
  )) ||
  (typeof window !== "undefined" && window.__DL_DEBUG__ === true);

export function debugLog(scope, message, extra) {
  if (!DEBUG_BROWSER) return;
  const ts = new Date().toISOString();
  if (extra === undefined) {
    console.log(`[DL UI][${scope}] ${ts} ${message}`);
  } else {
    console.log(`[DL UI][${scope}] ${ts} ${message}`, extra);
  }
}

export async function fetchJson(baseUrl, path, params, options = {}) {
  const url = `${baseUrl}${path}${buildQueryString(params)}`;
  const started = performance.now();
  debugLog("fetch", `GET ${url}`);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    },
    signal: options.signal
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = { ok: false, error: "Invalid JSON response", raw: text };
  }

  if (!response.ok) {
    const message = data?.errorResponse?.message || data?.message || `Request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = data;
    debugLog("fetch", `GET ${url} failed in ${Math.round(performance.now() - started)}ms`, {
      status: response.status,
      payload: data
    });
    throw err;
  }

  debugLog("fetch", `GET ${url} ok in ${Math.round(performance.now() - started)}ms`, {
    status: response.status
  });
  return data;
}

export async function postJson(baseUrl, path, body, options = {}) {
  const url = `${baseUrl}${path}`;
  const started = performance.now();
  debugLog("fetch", `POST ${url}`, body);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {})
    },
    body: JSON.stringify(body || {}),
    signal: options.signal
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = { ok: false, error: "Invalid JSON response", raw: text };
  }

  if (!response.ok) {
    const message = data?.errorResponse?.message || data?.message || `Request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = data;
    debugLog("fetch", `POST ${url} failed in ${Math.round(performance.now() - started)}ms`, {
      status: response.status,
      payload: data
    });
    throw err;
  }

  debugLog("fetch", `POST ${url} ok in ${Math.round(performance.now() - started)}ms`, {
    status: response.status
  });
  return data;
}

export function splitPairValue(rawValue) {
  const parts = String(rawValue || "").split(" | ");
  return {
    left: (parts.shift() || "").trim(),
    right: parts.join(" | ").trim()
  };
}

export function shortRulesheetName(value) {
  if (!value) return "(unknown)";
  const clean = String(value).replace(/\\/g, "/");
  const lastSlash = clean.lastIndexOf("/");
  return lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean;
}
