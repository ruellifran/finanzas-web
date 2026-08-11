import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Error atrapado:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          fontFamily: "monospace", padding: 20, background: "#fff0f0",
          color: "#900", minHeight: "100vh", whiteSpace: "pre-wrap", fontSize: 13,
        }}>
          <h2 style={{ marginTop: 0 }}>Error al cargar la app</h2>
          <p>{String(this.state.error && this.state.error.message)}</p>
          <p style={{ opacity: 0.7 }}>{String(this.state.error && this.state.error.stack)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener("error", (e) => {
  const root = document.getElementById("root");
  if (root && !root.innerHTML) {
    root.innerHTML = `<div style="font-family:monospace;padding:20px;background:#fff0f0;color:#900;white-space:pre-wrap;font-size:13px;">Error global: ${e.message}\n${e.filename}:${e.lineno}</div>`;
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
