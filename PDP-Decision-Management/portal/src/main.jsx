import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MarkLogicProvider, PaginationProvider } from 'ml-fasttrack'
import App from './App.jsx'
import '@progress/kendo-theme-default/dist/all.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/*
        MarkLogicProvider and PaginationProvider are intentionally kept for future
        ml-fasttrack hook usage. The current three pages call MarkLogic REST directly
        via their own mlFetch() helpers and do not consume these contexts at runtime.
      */}
      <MarkLogicProvider
        scheme={import.meta.env.VITE_ML_SCHEME}
        host={import.meta.env.VITE_ML_HOST}
        port={import.meta.env.VITE_ML_PORT}
        basePath={import.meta.env.VITE_ML_BASE_PATH}
        auth={{
          username: import.meta.env.VITE_ML_USERNAME,
          password: import.meta.env.VITE_ML_PASSWORD
        }}
        debug={true}
      >
        <PaginationProvider>
          <App />
        </PaginationProvider>
      </MarkLogicProvider>
    </BrowserRouter>
  </React.StrictMode>
)
