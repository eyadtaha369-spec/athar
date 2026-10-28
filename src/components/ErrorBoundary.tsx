import { Component, type ReactNode } from "react";

/**
 * If anything on a page crashes, show what happened and a way back,
 * instead of leaving a blank screen (especially in the iPhone Home Screen app, which has no reload button).
 */
type State = { error: Error | null };

const clearAdminSession = () => {
  try { sessionStorage.clear(); } catch { /* ignore */ }
  try { ["athar:admin-push-asked"].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
};

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    try {
      sessionStorage.setItem("athar:last-error", JSON.stringify({
        message: String(error?.message || error), where: String(info?.componentStack || "").trim().split("\n").slice(0, 4).join(" ← "),
        at: new Date().toISOString(), page: location.pathname, ua: navigator.userAgent,
      }));
    } catch { /* ignore */ }
    console.error("ATHAR crashed:", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const where = (() => { try { return JSON.parse(sessionStorage.getItem("athar:last-error") || "{}").where || ""; } catch { return ""; } })();
    return (
      <div style={{ minHeight: "100vh", background: "#E8E1D6", color: "#1A1A1A", display: "grid", placeItems: "center", padding: "24px 16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ maxWidth: 420, width: "100%", background: "#F3EEE6", borderRadius: 16, padding: 24, border: "1px solid #B7B0A6" }}>
          <p style={{ fontWeight: 700, fontSize: 20, margin: 0 }}>Something went wrong on this page</p>
          <p style={{ color: "#66615A", fontSize: 14, marginTop: 8 }}>Reload to try again. If it keeps happening, send a screenshot of this box to support.</p>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, background: "#E8E1D6", borderRadius: 8, padding: 10, marginTop: 12, maxHeight: 180, overflow: "auto" }}>
            {String(error.message || error)}{where ? `\n\nin ${where}` : ""}
          </pre>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button onClick={() => location.reload()} style={{ height: 44, padding: "0 18px", borderRadius: 8, background: "#1A1A1A", color: "#E8E1D6", border: 0, fontWeight: 600 }}>Reload</button>
            <button onClick={() => { clearAdminSession(); location.reload(); }} style={{ height: 44, padding: "0 14px", borderRadius: 8, background: "transparent", border: "1px solid #B7B0A6", color: "#1A1A1A" }}>Sign out and reload</button>
          </div>
        </div>
      </div>
    );
  }
}
