// src/App.jsx
import ErrorBoundary from './components/ErrorBoundary';
import SearchWidget from './components/SearchWidget';

export default function App() {

  return (
    <calcite-shell>
      <calcite-shell-panel slot="panel-start" position="start" collapsed={false} width-scale="m">
        <SearchWidget />
      </calcite-shell-panel>

      <main style={{ padding: '1rem', width: '100%' }}>
        <ErrorBoundary>
        </ErrorBoundary>
      </main>
    </calcite-shell>
  );
}
