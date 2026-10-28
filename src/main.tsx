import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import App from "./App";
import { StoreProvider } from "./lib/store";
import { ErrorBoundary } from "./components/ErrorBoundary";
// English display face (Google Fonts "Anton", self-hosted). Arabic Ruq'ah is declared in index.css.
import "@fontsource/anton/latin-400.css";
import "./index.css";

// The single-file preview build runs inside a sandboxed frame, so it routes in memory.
const Router = __SINGLE__ ? MemoryRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Router>
        <StoreProvider>
          <App />
        </StoreProvider>
      </Router>
    </ErrorBoundary>
  </React.StrictMode>
);
