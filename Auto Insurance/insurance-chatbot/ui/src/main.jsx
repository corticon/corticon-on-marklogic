// ui/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { MarkLogicProvider } from 'ml-fasttrack';
import './index.css';

function parseProxyUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  return {
    scheme: parsed.protocol.replace(':', ''),
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
    basePath: parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : ''
  };
}

const proxyBaseUrl = import.meta.env.VITE_PROXY_BASE_URL || 'http://localhost:4004';
const fastTrackOptions = import.meta.env.VITE_FT_OPTIONS || 'corticonml-options';
const fastTrackDebug = String(import.meta.env.VITE_FT_DEBUG || '').toLowerCase() === 'true';
const proxyConfig = parseProxyUrl(proxyBaseUrl);

console.log('Using MarkLogic proxy configuration:', {
  proxyBaseUrl,
  fastTrackOptions,
  fastTrackDebug,
  proxyConfig
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MarkLogicProvider
      scheme={proxyConfig.scheme}
      host={proxyConfig.host}
      port={proxyConfig.port}
      basePath={proxyConfig.basePath}
      options={fastTrackOptions}
      disableSearchOnChange={false}
      initSearch={false}
      debug={fastTrackDebug}
    >
      <App />
    </MarkLogicProvider>
  </React.StrictMode>
);