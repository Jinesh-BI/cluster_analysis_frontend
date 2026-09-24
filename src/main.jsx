// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import posthog from "posthog-js";
import { PostHogErrorBoundary, PostHogProvider } from "@posthog/react";
import { posthogEnabled, posthogHost, posthogToken } from "./analytics/posthog";
import { theme } from "./theme";
import App from "./App";

if (!posthogToken && import.meta.env.DEV) {
  throw new Error(
    "VITE_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_PROJECT_TOKEN is configured"
  );
}

if (!posthogHost && import.meta.env.DEV) {
  throw new Error(
    "VITE_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_HOST is configured"
  );
}

if (posthogEnabled) {
  posthog.init(posthogToken, {
    api_host: posthogHost,
    defaults: "2026-05-30",
    logs: {
      serviceName: "regional-manager-frontend",
      environment: import.meta.env.MODE,
    },
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <PostHogErrorBoundary
        fallback={
          <div className="page" style={{ maxWidth: 420, marginTop: 80 }}>
            <h1>Something went wrong</h1>
            <p>This screen hit an unexpected error. Try reloading the page.</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        }
      >
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </PostHogErrorBoundary>
    </PostHogProvider>
  </React.StrictMode>
);
