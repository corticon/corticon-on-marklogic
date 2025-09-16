// ui/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { MarkLogicProvider } from 'ml-fasttrack';

// Use proxy host/port
const host = import.meta.env.VITE_ML_HOST || 'localhost';
const port = parseInt(import.meta.env.VITE_ML_PORT, 10) || 4004; // proxy port
const optionsName = import.meta.env.VITE_ML_OPTIONS || 'corticonml-options';

console.log('Using MarkLogic proxy host/port/options:', host, port, optionsName);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
<MarkLogicProvider
  protocol="http"
  host={host}
  port={port}
  searchOptionsName={optionsName}
>

      <App />
    </MarkLogicProvider>
  </React.StrictMode>
);