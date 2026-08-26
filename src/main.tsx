import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { SchoolProvider } from "./context/SchoolContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SchoolProvider>
          <App />
        </SchoolProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
