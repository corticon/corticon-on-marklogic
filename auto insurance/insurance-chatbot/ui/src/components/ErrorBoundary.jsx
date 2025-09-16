// src/components/ErrorBoundary.jsx
import React from 'react';
export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, err: null }; }
  static getDerivedStateFromError(err){ return { hasError: true, err }; }
  componentDidCatch(err, info){ console.error('ErrorBoundary', err, info); }
  render(){ return this.state.hasError ? <calcite-notice kind="danger" open icon><div slot="message">Something went wrong.</div></calcite-notice> : this.props.children; }
}
