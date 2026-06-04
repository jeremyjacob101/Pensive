import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { AuthProvider } from "./context/AuthContext";
import { ConvexReactClient } from "convex/react";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import "./App.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL in environment.");
}

const convex = new ConvexReactClient(convexUrl);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ConvexAuthProvider>
  </StrictMode>,
);