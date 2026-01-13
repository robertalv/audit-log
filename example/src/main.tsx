import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App.jsx";
import "./index.css";

const address = import.meta.env.VITE_CONVEX_URL;

if (!address) {
  document.getElementById("root")!.innerHTML = `
    <div style="color: #ff4444; background: #0a0a0a; padding: 2rem; font-family: monospace; min-height: 100vh;">
      <h1 style="color: #00ff00;">Error: VITE_CONVEX_URL not set</h1>
      <p>Please set the VITE_CONVEX_URL environment variable.</p>
    </div>
  `;
} else {
  const convex = new ConvexReactClient(address);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </StrictMode>,
  );
}
