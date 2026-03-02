import React from "react";
import ReactDOM from "react-dom/client";
import { MarkLogicProvider } from "ml-fasttrack";
import App from "./App";
import "./index.css";
import { debugLog } from "./lib/api";

function parseProxyUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  return {
    scheme: parsed.protocol.replace(":", ""),
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : (parsed.protocol === "https:" ? 443 : 80),
    basePath: parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : ""
  };
}

const proxyBaseUrl = import.meta.env.VITE_PROXY_BASE_URL || "http://localhost:14001";
const fastTrackOptions = import.meta.env.VITE_FT_OPTIONS || "search-options";
const fastTrackDebug = String(import.meta.env.VITE_FT_DEBUG || "").toLowerCase() === "true";
const proxyConfig = parseProxyUrl(proxyBaseUrl);

debugLog("boot", "Initializing UI", {
  proxyBaseUrl,
  fastTrackOptions,
  fastTrackDebug,
  proxyConfig
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MarkLogicProvider
      scheme={proxyConfig.scheme}
      host={proxyConfig.host}
      port={proxyConfig.port}
      basePath={proxyConfig.basePath}
      options={fastTrackOptions}
      disableSearchOnChange={true}
      initSearch={false}
      debug={fastTrackDebug}
    >
      <App proxyBaseUrl={proxyBaseUrl} />
    </MarkLogicProvider>
  </React.StrictMode>
);
