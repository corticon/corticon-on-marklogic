// src/components/ErrorBoundary.jsx
import React from "react";

/**
 * Simple error boundary to catch React render errors
 * ---------------------------------------------------
 * Prevents the app from crashing when a component throws.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "1rem",
            borderRadius: "8px",
            margin: "1rem",
            fontFamily: "sans-serif",
          }}
        >
          <h3>Something went wrong 😔</h3>
          <p>{this.state.error?.message}</p>
          <p>Please refresh or try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
